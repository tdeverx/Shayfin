import { describe, expect, it } from 'vitest';
import {
	ACTIVE_SERVER_KEY,
	BROWSER_DEVICE_KEY,
	clearStoredCredentials,
	getOrCreateDeviceId,
	persistSession,
	readStoredSession,
	storageKeysForServer,
	type StorageLike
} from './storage.js';

class MemoryStorage implements StorageLike {
	readonly values = new Map<string, string>();
	getItem(key: string) {
		return this.values.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		this.values.set(key, value);
	}
	removeItem(key: string) {
		this.values.delete(key);
	}
}

describe('Jellyfin storage', () => {
	it('builds isolated keys for each Jellyfin ServerId', () => {
		const first = storageKeysForServer('server/a');
		const second = storageKeysForServer('server-b');
		expect(first.token).toBe('shayfin:jellyfin:server:server%2Fa:access-token');
		expect(first.token).not.toBe(second.token);
		expect(first.deviceId).toContain('server%2Fa');
	});

	it('keeps a stable browser device id and copies it into a server namespace', () => {
		const storage = new MemoryStorage();
		const pending = getOrCreateDeviceId(undefined, storage);
		const namespaced = getOrCreateDeviceId('server-a', storage);
		expect(namespaced).toBe(pending);
		expect(storage.getItem(BROWSER_DEVICE_KEY)).toBe(pending);
		expect(storage.getItem(storageKeysForServer('server-a').deviceId)).toBe(pending);
	});

	it('persists and restores credentials without retaining them on logout', () => {
		const storage = new MemoryStorage();
		const session = {
			serverId: 'server-a',
			serverUrl: 'https://media.example/jellyfin',
			userId: 'user-a',
			accessToken: 'secret-token',
			deviceId: 'device-a'
		};
		expect(persistSession(session, storage)).toBe(true);
		expect(storage.getItem(ACTIVE_SERVER_KEY)).toBe('server-a');
		expect(readStoredSession(undefined, storage)).toEqual(session);

		clearStoredCredentials('server-a', storage);
		expect(readStoredSession('server-a', storage)).toBeNull();
		expect(storage.getItem(storageKeysForServer('server-a').deviceId)).toBe('device-a');
	});
});
