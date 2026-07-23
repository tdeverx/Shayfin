import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateRequest, bearerToken } from './auth';
import { CONFIG_SCHEMA_VERSION, ConfigStore } from './config';

const directories: string[] = [];

async function configuredStore(): Promise<ConfigStore> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'shayfin-auth-'));
	directories.push(directory);
	const store = new ConfigStore(directory);
	await store.write({
		schemaVersion: CONFIG_SCHEMA_VERSION,
		jellyfin: {
			publicUrl: 'https://public.example.test',
			internalUrl: 'http://jellyfin:8096',
			serverId: 'server-1',
			serverName: 'Home'
		},
		integrations: { sonarr: [], radarr: [] },
		plugins: {}
	});
	return store;
}

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Jellyfin bearer authorization', () => {
	it('requires an unambiguous Bearer token', () => {
		expect(() => bearerToken(new Request('http://shayfin.test'))).toThrow('Bearer token');
		expect(
			bearerToken(
				new Request('http://shayfin.test', { headers: { authorization: 'Bearer jellyfin-token' } })
			)
		).toBe('jellyfin-token');
	});

	it('revalidates the token against the internal Jellyfin URL', async () => {
		const store = await configuredStore();
		const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			expect(String(input)).toBe('http://jellyfin:8096/Users/Me');
			expect(new Headers(init?.headers).get('x-emby-token')).toBe('jellyfin-token');
			return Response.json({ Id: 'user-1', Name: 'Admin', Policy: { IsAdministrator: true } });
		}) as unknown as typeof fetch;
		const request = new Request('http://shayfin.test/api/admin/settings', {
			headers: { authorization: 'Bearer jellyfin-token' }
		});

		const authenticated = await authenticateRequest(request, {
			requireAdmin: true,
			store,
			fetcher
		});

		expect(authenticated.user.Id).toBe('user-1');
		expect(authenticated.jellyfinUrl).toBe('http://jellyfin:8096');
	});

	it('rejects a valid non-administrator from an admin route', async () => {
		const store = await configuredStore();
		const fetcher = vi.fn(async () =>
			Response.json({ Id: 'user-2', Name: 'Viewer', Policy: { IsAdministrator: false } })
		) as unknown as typeof fetch;
		const request = new Request('http://shayfin.test/api/admin/settings', {
			headers: { authorization: 'Bearer viewer-token' }
		});

		await expect(
			authenticateRequest(request, { requireAdmin: true, store, fetcher })
		).rejects.toMatchObject({ status: 403, code: 'administrator_required' });
	});
});
