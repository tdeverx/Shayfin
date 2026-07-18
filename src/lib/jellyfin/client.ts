import { Jellyfin, type Api } from '@jellyfin/sdk';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api.js';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto.js';
import {
	clearStoredCredentials,
	getOrCreateDeviceId,
	persistSession,
	readStoredSession,
	type StorageLike
} from './storage.js';
import type { JellyfinConnection, JellyfinSession, RestoredJellyfinConnection } from './types.js';

export const CLIENT_NAME = 'Shayfin';
export const CLIENT_VERSION = '0.0.1';

export function normalizeServerUrl(value: string): string {
	let candidate = value.trim();
	if (!candidate) throw new Error('A Jellyfin server URL is required');
	if (!/^https?:\/\//i.test(candidate)) candidate = `http://${candidate}`;

	const url = new URL(candidate);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('Jellyfin must use an http or https URL');
	}

	url.hash = '';
	url.search = '';
	return url.toString().replace(/\/$/, '');
}

export function createApiClient(
	serverUrl: string,
	options: { deviceId?: string; accessToken?: string } = {}
): Api {
	const deviceId = options.deviceId || getOrCreateDeviceId();
	const jellyfin = new Jellyfin({
		clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
		deviceInfo: { name: browserDeviceName(), id: deviceId }
	});

	return jellyfin.createApi(normalizeServerUrl(serverUrl), options.accessToken);
}

function browserDeviceName(): string {
	if (typeof navigator === 'undefined') return 'Shayfin browser';
	return navigator.platform || 'Shayfin browser';
}

export async function authenticate(options: {
	serverUrl: string;
	username: string;
	password?: string;
	storage?: StorageLike;
}): Promise<JellyfinConnection> {
	const serverUrl = normalizeServerUrl(options.serverUrl);
	const deviceId = getOrCreateDeviceId(undefined, options.storage);
	const api = createApiClient(serverUrl, { deviceId });
	const response = await getUserApi(api).authenticateUserByName({
		authenticateUserByName: { Username: options.username.trim(), Pw: options.password || '' }
	});
	const { AccessToken: accessToken, ServerId: serverId, User: user } = response.data;

	if (!accessToken || !serverId || !user?.Id) {
		throw new Error('Jellyfin returned an incomplete authentication response');
	}

	const session: JellyfinSession = {
		serverId,
		serverUrl,
		userId: user.Id,
		accessToken,
		deviceId
	};
	getOrCreateDeviceId(serverId, options.storage);
	persistSession(session, options.storage);
	return { api, session, user };
}

export function restoreApiClient(
	serverId?: string,
	storage?: StorageLike
): RestoredJellyfinConnection | null {
	const session = readStoredSession(serverId, storage);
	if (!session) return null;

	return {
		api: createApiClient(session.serverUrl, {
			deviceId: session.deviceId,
			accessToken: session.accessToken
		}),
		session
	};
}

export async function getCurrentUser(api: Api): Promise<UserDto> {
	const response = await getUserApi(api).getCurrentUser();
	return response.data;
}

export function isAdministrator(user: UserDto | null | undefined): boolean {
	return user?.Policy?.IsAdministrator === true;
}

export async function logout(api: Api, serverId: string, storage?: StorageLike): Promise<void> {
	try {
		await getSessionApi(api).reportSessionEnded();
	} catch {
		// Local logout must still succeed when the server is offline.
	} finally {
		api.accessToken = '';
		clearStoredCredentials(serverId, storage);
	}
}
