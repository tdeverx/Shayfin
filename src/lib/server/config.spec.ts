import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG_SCHEMA_VERSION, ConfigStore } from './config';

const directories: string[] = [];

async function temporaryStore(): Promise<ConfigStore> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'shayfin-config-'));
	directories.push(directory);
	return new ConfigStore(directory);
}

afterEach(async () => {
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('ConfigStore', () => {
	it('encrypts integration secrets with a mode 0600 key', async () => {
		const store = await temporaryStore();
		await store.setSeerrIntegration({
			enabled: true,
			url: 'http://localhost:5055/',
			apiKey: 'not-plaintext'
		});

		const persisted = await readFile(path.join(store.directory, 'config.json'), 'utf8');
		const keyStats = await stat(path.join(store.directory, 'secret.key'));
		const resolved = await store.resolveSeerrIntegration();

		expect(persisted).not.toContain('not-plaintext');
		expect(resolved?.apiKey).toBe('not-plaintext');
		expect(keyStats.mode & 0o777).toBe(0o600);
	});

	it('serializes concurrent updates and leaves only a complete atomic config', async () => {
		const store = await temporaryStore();
		await Promise.all([
			store.createServarrInstance('sonarr', {
				label: 'Main Sonarr',
				enabled: true,
				url: 'http://sonarr.test:8989',
				apiKey: 'sonarr-secret'
			}),
			store.createServarrInstance('radarr', {
				label: 'Main Radarr',
				enabled: true,
				url: 'http://radarr.test:7878',
				apiKey: 'radarr-secret'
			})
		]);

		const config = await store.read();
		const entries = await readdir(store.directory);
		const persisted = JSON.parse(await readFile(path.join(store.directory, 'config.json'), 'utf8'));

		expect(config.integrations.sonarr[0]?.url).toBe('http://sonarr.test:8989');
		expect(config.integrations.radarr[0]?.url).toBe('http://radarr.test:7878');
		expect(entries.some((entry) => entry.endsWith('.tmp'))).toBe(false);
		expect(persisted.schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
	});

	it('rejects a configuration from an unsupported future schema', async () => {
		const store = await temporaryStore();
		await writeFile(
			path.join(store.directory, 'config.json'),
			JSON.stringify({ schemaVersion: 999, integrations: {} })
		);

		await expect(store.read()).rejects.toThrow('Unsupported Shayfin configuration schema');
	});

	it('requires a new key and clears Seerr mappings when an endpoint changes', async () => {
		const store = await temporaryStore();
		await store.setSeerrIntegration({
			enabled: true,
			url: 'https://seerr-one.test',
			apiKey: 'first-key'
		});
		await store.update((config) => {
			config.integrations.seerr!.userMappings = { jellyfinUser: 7 };
			return config;
		});

		await expect(
			store.setSeerrIntegration({ enabled: true, url: 'https://seerr-two.test' })
		).rejects.toMatchObject({ code: 'integration_api_key_required' });

		await store.setSeerrIntegration({
			enabled: true,
			url: 'https://seerr-two.test',
			apiKey: 'second-key'
		});
		const config = await store.read();
		expect(config.integrations.seerr?.userMappings).toBeUndefined();
		expect((await store.resolveSeerrIntegration())?.apiKey).toBe('second-key');
	});

	it('defaults plugin capabilities on and persists explicit overrides', async () => {
		const store = await temporaryStore();
		await store.write({
			schemaVersion: CONFIG_SCHEMA_VERSION,
			integrations: { sonarr: [], radarr: [] },
			plugins: {}
		});
		expect((await store.read()).plugins.achievementBadges).toBeUndefined();

		await store.setPluginIntegration('achievementBadges', {
			enabled: false,
			unlockNotifications: false
		});
		expect((await store.read()).plugins.achievementBadges).toEqual({
			enabled: false,
			unlockNotifications: false
		});
	});

	it('upgrades v1 by preserving Jellyfin and Seerr while resetting Servarr instances', async () => {
		const store = await temporaryStore();
		await writeFile(
			path.join(store.directory, 'config.json'),
			JSON.stringify({
				schemaVersion: 1,
				jellyfin: {
					publicUrl: 'https://jellyfin.test',
					serverId: 'server',
					serverName: 'Jellyfin'
				},
				integrations: {
					seerr: { enabled: false, url: 'https://seerr.test' },
					sonarr: { enabled: true, url: 'https://sonarr.test' }
				},
				plugins: {}
			})
		);
		const config = await store.read();
		expect(config.schemaVersion).toBe(2);
		expect(config.jellyfin?.serverId).toBe('server');
		expect(config.integrations.seerr?.url).toBe('https://seerr.test');
		expect(config.integrations.sonarr).toEqual([]);
		expect(
			JSON.parse(await readFile(path.join(store.directory, 'config.json'), 'utf8')).schemaVersion
		).toBe(2);
	});

	it('requires unique instance labels and preserves encrypted keys on update', async () => {
		const store = await temporaryStore();
		const instance = await store.createServarrInstance('radarr', {
			label: 'Movies',
			enabled: true,
			url: 'https://radarr.test',
			apiKey: 'secret'
		});
		await expect(
			store.createServarrInstance('radarr', {
				label: 'movies',
				enabled: true,
				url: 'https://two.test',
				apiKey: 'secret'
			})
		).rejects.toMatchObject({ code: 'servarr_label_taken' });
		await store.updateServarrInstance('radarr', instance.id, {
			label: 'Movies',
			enabled: false,
			url: 'https://radarr.test'
		});
		expect(await store.resolveServarrInstances('radarr')).toEqual([]);
		await store.updateServarrInstance('radarr', instance.id, {
			label: 'Movies',
			enabled: true,
			url: 'https://radarr.test'
		});
		expect((await store.resolveServarrInstances('radarr'))[0]?.apiKey).toBe('secret');
	});
});
