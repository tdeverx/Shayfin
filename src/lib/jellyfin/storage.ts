import type { JellyfinSession } from './types.js';

export const STORAGE_PREFIX = 'shayfin:jellyfin';

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface ServerStorageKeys {
	root: string;
	token: string;
	deviceId: string;
	serverUrl: string;
	userId: string;
}

export const ACTIVE_SERVER_KEY = `${STORAGE_PREFIX}:active-server`;
export const BROWSER_DEVICE_KEY = `${STORAGE_PREFIX}:device-id`;

function browserStorage(): StorageLike | undefined {
	if (typeof window === 'undefined') return undefined;

	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

function safeStorage(storage?: StorageLike): StorageLike | undefined {
	return storage ?? browserStorage();
}

function safeGet(storage: StorageLike, key: string): string | null {
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

function safeSet(storage: StorageLike, key: string, value: string): boolean {
	try {
		storage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

function safeRemove(storage: StorageLike, key: string): void {
	try {
		storage.removeItem(key);
	} catch {
		// Storage can be disabled by the browser. Logout should still complete.
	}
}

function randomDeviceId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}

	return `shayfin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizedServerId(serverId: string): string {
	const trimmed = serverId.trim();
	if (!trimmed) throw new Error('A Jellyfin ServerId is required');
	return encodeURIComponent(trimmed);
}

export function storageKeysForServer(serverId: string): ServerStorageKeys {
	const root = `${STORAGE_PREFIX}:server:${normalizedServerId(serverId)}`;
	return {
		root,
		token: `${root}:access-token`,
		deviceId: `${root}:device-id`,
		serverUrl: `${root}:url`,
		userId: `${root}:user-id`
	};
}

export function getOrCreateDeviceId(serverId?: string, storage?: StorageLike): string {
	const target = safeStorage(storage);
	if (!target) return randomDeviceId();

	const keys = serverId ? storageKeysForServer(serverId) : undefined;
	const stored = (keys && safeGet(target, keys.deviceId)) || safeGet(target, BROWSER_DEVICE_KEY);
	const deviceId = stored || randomDeviceId();

	safeSet(target, BROWSER_DEVICE_KEY, deviceId);
	if (keys) safeSet(target, keys.deviceId, deviceId);
	return deviceId;
}

export function persistSession(session: JellyfinSession, storage?: StorageLike): boolean {
	const target = safeStorage(storage);
	if (!target) return false;

	const keys = storageKeysForServer(session.serverId);
	const writes = [
		safeSet(target, keys.token, session.accessToken),
		safeSet(target, keys.deviceId, session.deviceId),
		safeSet(target, keys.serverUrl, session.serverUrl),
		safeSet(target, keys.userId, session.userId),
		safeSet(target, BROWSER_DEVICE_KEY, session.deviceId),
		safeSet(target, ACTIVE_SERVER_KEY, session.serverId)
	];

	return writes.every(Boolean);
}

export function readStoredSession(
	serverId?: string,
	storage?: StorageLike
): JellyfinSession | null {
	const target = safeStorage(storage);
	if (!target) return null;

	const selectedServerId = serverId?.trim() || safeGet(target, ACTIVE_SERVER_KEY)?.trim();
	if (!selectedServerId) return null;

	const keys = storageKeysForServer(selectedServerId);
	const accessToken = safeGet(target, keys.token);
	const deviceId = safeGet(target, keys.deviceId);
	const serverUrl = safeGet(target, keys.serverUrl);
	const userId = safeGet(target, keys.userId);

	if (!accessToken || !deviceId || !serverUrl || !userId) return null;
	return { serverId: selectedServerId, serverUrl, userId, accessToken, deviceId };
}

export function clearStoredCredentials(serverId: string, storage?: StorageLike): void {
	const target = safeStorage(storage);
	if (!target) return;

	const keys = storageKeysForServer(serverId);
	safeRemove(target, keys.token);
	safeRemove(target, keys.userId);
	if (safeGet(target, ACTIVE_SERVER_KEY) === serverId) safeRemove(target, ACTIVE_SERVER_KEY);
	// Keep the URL and namespaced device id so the same browser remains the same Jellyfin device.
}
