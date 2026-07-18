import { randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ApiError } from './errors';
import { EncryptedSecretSchema, SecretVault, type EncryptedSecret } from './secret-vault';
import { normalizeServiceUrl } from './url';

export const CONFIG_SCHEMA_VERSION = 1 as const;
export const IntegrationNameSchema = z.enum(['seerr', 'sonarr', 'radarr']);
export type IntegrationName = z.infer<typeof IntegrationNameSchema>;
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
			sonarr: StoredIntegrationSchema.optional(),
			radarr: StoredIntegrationSchema.optional()
		})
		.default({}),
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
	return { schemaVersion: CONFIG_SCHEMA_VERSION, integrations: {}, plugins: {} };
}

function migrateConfig(raw: unknown): AppConfig {
	if (typeof raw !== 'object' || raw === null) {
		throw new Error('Shayfin configuration is not a JSON object.');
	}

	const version = Reflect.get(raw, 'schemaVersion');
	if (version !== CONFIG_SCHEMA_VERSION) {
		throw new Error(`Unsupported Shayfin configuration schema: ${String(version)}`);
	}

	return AppConfigSchema.parse(raw);
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
			return migrateConfig(JSON.parse(await readFile(this.configPath, 'utf8')));
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

	async setIntegration(
		name: IntegrationName,
		input: { enabled: boolean; url: string; apiKey?: string | null }
	): Promise<StoredIntegration> {
		let saved!: StoredIntegration;
		await this.update(async (config) => {
			const previous = config.integrations[name];
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
				...(name === 'seerr' &&
				previous?.userMappings &&
				!endpointChanged &&
				input.apiKey === undefined
					? { userMappings: previous.userMappings }
					: {})
			};
			config.integrations[name] = saved;
			return config;
		});
		return saved;
	}

	async resolveIntegration(
		name: IntegrationName
	): Promise<(Omit<StoredIntegration, 'apiKey'> & { apiKey: string }) | undefined> {
		const integration = (await this.read()).integrations[name];
		if (!integration?.enabled || !integration.apiKey) return undefined;
		return { ...integration, apiKey: await this.vault.decrypt(integration.apiKey) };
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
