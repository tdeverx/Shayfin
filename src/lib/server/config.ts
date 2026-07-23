import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ApiError } from './errors';
import { EncryptedSecretSchema, SecretVault, type EncryptedSecret } from './secret-vault';
import { normalizeServiceUrl } from './url';

export const CONFIG_SCHEMA_VERSION = 2 as const;
export const ServarrServiceSchema = z.enum(['sonarr', 'radarr']);
export type ServarrService = z.infer<typeof ServarrServiceSchema>;
export const PluginIntegrationNameSchema = z.enum([
	'homeScreenSections',
	'mediaBarEnhanced',
	'achievementBadges',
	'getAvatar'
]);
export type PluginIntegrationName = z.infer<typeof PluginIntegrationNameSchema>;

export type { EncryptedSecret } from './secret-vault';

const StoredIntegrationSchema = z.object({
	enabled: z.boolean().default(false),
	url: z.string(),
	apiKey: EncryptedSecretSchema.optional(),
	userMappings: z.record(z.string(), z.number().int().positive()).optional()
});

export type StoredIntegration = z.infer<typeof StoredIntegrationSchema>;

const StoredServarrInstanceSchema = z.object({
	id: z.string().uuid(),
	label: z.string().trim().min(1).max(80),
	enabled: z.boolean().default(false),
	url: z.string(),
	apiKey: EncryptedSecretSchema.optional()
});

export type StoredServarrInstance = z.infer<typeof StoredServarrInstanceSchema>;
export type ResolvedServarrInstance = Omit<StoredServarrInstance, 'apiKey'> & { apiKey: string };

const AppConfigSchema = z.object({
	schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
	jellyfin: z
		.object({
			publicUrl: z.string(),
			internalUrl: z.string().optional(),
			serverId: z.string().min(1),
			serverName: z.string().min(1),
			serverVersion: z.string().optional()
		})
		.optional(),
	integrations: z
		.object({
			seerr: StoredIntegrationSchema.optional(),
			sonarr: z.array(StoredServarrInstanceSchema).default([]),
			radarr: z.array(StoredServarrInstanceSchema).default([])
		})
		.default({ sonarr: [], radarr: [] }),
	plugins: z
		.object({
			homeScreenSections: z.object({ enabled: z.boolean().default(true) }).optional(),
			mediaBarEnhanced: z.object({ enabled: z.boolean().default(true) }).optional(),
			achievementBadges: z
				.object({
					enabled: z.boolean().default(true),
					unlockNotifications: z.boolean().default(true)
				})
				.optional(),
			getAvatar: z.object({ enabled: z.boolean().default(true) }).optional()
		})
		.default({})
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

function emptyConfig(): AppConfig {
	return {
		schemaVersion: CONFIG_SCHEMA_VERSION,
		integrations: { sonarr: [], radarr: [] },
		plugins: {}
	};
}

const AppConfigV1Schema = z.object({
	schemaVersion: z.literal(1),
	jellyfin: AppConfigSchema.shape.jellyfin,
	integrations: z
		.object({
			seerr: StoredIntegrationSchema.optional(),
			sonarr: StoredIntegrationSchema.optional(),
			radarr: StoredIntegrationSchema.optional()
		})
		.default({}),
	plugins: AppConfigSchema.shape.plugins
});

function migrateConfig(raw: unknown): { config: AppConfig; migrated: boolean } {
	if (typeof raw !== 'object' || raw === null) {
		throw new Error('Shayfin configuration is not a JSON object.');
	}

	const version = Reflect.get(raw, 'schemaVersion');
	if (version === CONFIG_SCHEMA_VERSION) {
		return { config: AppConfigSchema.parse(raw), migrated: false };
	}
	if (version === 1) {
		const legacy = AppConfigV1Schema.parse(raw);
		return {
			config: AppConfigSchema.parse({
				schemaVersion: CONFIG_SCHEMA_VERSION,
				...(legacy.jellyfin ? { jellyfin: legacy.jellyfin } : {}),
				integrations: { seerr: legacy.integrations.seerr, sonarr: [], radarr: [] },
				plugins: legacy.plugins
			}),
			migrated: true
		};
	}
	throw new Error(`Unsupported Shayfin configuration schema: ${String(version)}`);
}

export function getDataDirectory(): string {
	return process.env.SHAYFIN_DATA_DIR?.trim() || '/data';
}

export class ConfigStore {
	readonly vault: SecretVault;
	private updateQueue: Promise<void> = Promise.resolve();

	constructor(readonly directory = getDataDirectory()) {
		this.vault = new SecretVault(directory);
	}

	private get configPath(): string {
		return path.join(this.directory, 'config.json');
	}

	async read(): Promise<AppConfig> {
		try {
			const migrated = migrateConfig(JSON.parse(await readFile(this.configPath, 'utf8')));
			if (migrated.migrated) await this.write(migrated.config);
			return migrated.config;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyConfig();
			throw error;
		}
	}

	async exists(): Promise<boolean> {
		try {
			await stat(this.configPath);
			return true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
			throw error;
		}
	}

	async write(config: AppConfig): Promise<void> {
		const validated = AppConfigSchema.parse(config);
		await mkdir(this.directory, { recursive: true, mode: 0o700 });
		await this.vault.initialize();
		const temporaryPath = path.join(
			this.directory,
			`.config.json.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
		);
		const handle = await open(temporaryPath, 'wx', 0o600);

		try {
			await handle.writeFile(`${JSON.stringify(validated, null, 2)}\n`, 'utf8');
			await handle.sync();
		} finally {
			await handle.close();
		}

		try {
			await rename(temporaryPath, this.configPath);
			await chmod(this.configPath, 0o600);
		} catch (error) {
			await rm(temporaryPath, { force: true });
			throw error;
		}
	}

	update(mutator: (current: AppConfig) => AppConfig | Promise<AppConfig>): Promise<AppConfig> {
		let resolveOperation!: (value: AppConfig) => void;
		let rejectOperation!: (reason?: unknown) => void;
		const operation = new Promise<AppConfig>((resolve, reject) => {
			resolveOperation = resolve;
			rejectOperation = reject;
		});

		this.updateQueue = this.updateQueue
			.then(async () => {
				const current = await this.read();
				const next = await mutator(structuredClone(current));
				await this.write(next);
				resolveOperation(next);
			})
			.catch((error) => {
				rejectOperation(error);
			});

		return operation;
	}

	async setSeerrIntegration(input: {
		enabled: boolean;
		url: string;
		apiKey?: string | null;
	}): Promise<StoredIntegration> {
		let saved!: StoredIntegration;
		await this.update(async (config) => {
			const previous = config.integrations.seerr;
			const normalizedUrl = normalizeServiceUrl(input.url);
			const endpointChanged = previous !== undefined && previous.url !== normalizedUrl;
			if (endpointChanged && input.apiKey === undefined) {
				throw new ApiError(
					400,
					'integration_api_key_required',
					'A new API key is required when an integration URL changes.'
				);
			}
			let apiKey: EncryptedSecret | undefined;
			if (typeof input.apiKey === 'string') {
				apiKey = await this.vault.encrypt(input.apiKey);
			} else if (input.apiKey === undefined && !endpointChanged) {
				apiKey = previous?.apiKey;
			}

			saved = {
				enabled: input.enabled,
				url: normalizedUrl,
				...(apiKey ? { apiKey } : {}),
				...(previous?.userMappings && !endpointChanged && input.apiKey === undefined
					? { userMappings: previous.userMappings }
					: {})
			};
			config.integrations.seerr = saved;
			return config;
		});
		return saved;
	}

	async resolveSeerrIntegration(): Promise<
		(Omit<StoredIntegration, 'apiKey'> & { apiKey: string }) | undefined
	> {
		const integration = (await this.read()).integrations.seerr;
		if (!integration?.enabled || !integration.apiKey) return undefined;
		return { ...integration, apiKey: await this.vault.decrypt(integration.apiKey) };
	}

	async createServarrInstance(
		service: ServarrService,
		input: { label: string; enabled: boolean; url: string; apiKey: string }
	): Promise<StoredServarrInstance> {
		let saved!: StoredServarrInstance;
		await this.update(async (config) => {
			const label = input.label.trim();
			if (
				config.integrations[service].some(
					(instance) => instance.label.toLocaleLowerCase() === label.toLocaleLowerCase()
				)
			) {
				throw new ApiError(
					409,
					'servarr_label_taken',
					`A ${service} instance named “${label}” already exists.`
				);
			}
			saved = {
				id: randomUUID(),
				label,
				enabled: input.enabled,
				url: normalizeServiceUrl(input.url),
				apiKey: await this.vault.encrypt(input.apiKey)
			};
			config.integrations[service].push(saved);
			return config;
		});
		return saved;
	}

	async updateServarrInstance(
		service: ServarrService,
		id: string,
		input: { label: string; enabled: boolean; url: string; apiKey?: string | null }
	): Promise<StoredServarrInstance> {
		let saved!: StoredServarrInstance;
		await this.update(async (config) => {
			const index = config.integrations[service].findIndex((instance) => instance.id === id);
			if (index === -1)
				throw new ApiError(
					404,
					'servarr_instance_not_found',
					'That Servarr instance no longer exists.'
				);
			const previous = config.integrations[service][index];
			const label = input.label.trim();
			if (
				config.integrations[service].some(
					(instance) =>
						instance.id !== id && instance.label.toLocaleLowerCase() === label.toLocaleLowerCase()
				)
			) {
				throw new ApiError(
					409,
					'servarr_label_taken',
					`A ${service} instance named “${label}” already exists.`
				);
			}
			const url = normalizeServiceUrl(input.url);
			if (url !== previous.url && input.apiKey === undefined) {
				throw new ApiError(
					400,
					'integration_api_key_required',
					'A new API key is required when an integration URL changes.'
				);
			}
			let apiKey = previous.apiKey;
			if (typeof input.apiKey === 'string') apiKey = await this.vault.encrypt(input.apiKey);
			saved = { id, label, enabled: input.enabled, url, ...(apiKey ? { apiKey } : {}) };
			config.integrations[service][index] = saved;
			return config;
		});
		return saved;
	}

	async deleteServarrInstance(service: ServarrService, id: string): Promise<void> {
		await this.update((config) => {
			const instances = config.integrations[service];
			if (!instances.some((instance) => instance.id === id)) {
				throw new ApiError(
					404,
					'servarr_instance_not_found',
					'That Servarr instance no longer exists.'
				);
			}
			config.integrations[service] = instances.filter((instance) => instance.id !== id);
			return config;
		});
	}

	async resolveServarrInstances(service: ServarrService): Promise<ResolvedServarrInstance[]> {
		return Promise.all(
			(await this.read()).integrations[service]
				.filter((instance) => instance.enabled && instance.apiKey)
				.map(async (instance) => ({
					...instance,
					apiKey: await this.vault.decrypt(instance.apiKey!)
				}))
		);
	}

	async setPluginIntegration(
		name: PluginIntegrationName,
		input: { enabled: boolean; unlockNotifications?: boolean }
	): Promise<AppConfig['plugins'][PluginIntegrationName]> {
		let saved: AppConfig['plugins'][PluginIntegrationName];
		await this.update((config) => {
			saved =
				name === 'achievementBadges'
					? {
							enabled: input.enabled,
							unlockNotifications: input.unlockNotifications ?? true
						}
					: { enabled: input.enabled };
			config.plugins[name] = saved as never;
			return config;
		});
		return saved;
	}
}

let defaultStore: ConfigStore | undefined;

export function getConfigStore(): ConfigStore {
	const desiredDirectory = getDataDirectory();
	if (!defaultStore || defaultStore.directory !== desiredDirectory) {
		defaultStore = new ConfigStore(desiredDirectory);
	}
	return defaultStore;
}
