import { getConfigStore, type ConfigStore } from './config';
import { ApiError } from './errors';
import { getJellyfinMe, type JellyfinUser } from './jellyfin';

export interface AuthenticatedRequest {
	token: string;
	user: JellyfinUser;
	jellyfinUrl: string;
}

export function bearerToken(request: Request): string {
	const authorization = request.headers.get('authorization');
	const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
	if (!match) {
		throw new ApiError(401, 'missing_bearer_token', 'A Jellyfin Bearer token is required.');
	}
	return match[1];
}

export async function authenticateRequest(
	request: Request,
	options: {
		requireAdmin?: boolean;
		store?: ConfigStore;
		fetcher?: typeof fetch;
	} = {}
): Promise<AuthenticatedRequest> {
	const token = bearerToken(request);
	const config = await (options.store ?? getConfigStore()).read();
	if (!config.jellyfin) {
		throw new ApiError(503, 'setup_required', 'Shayfin has not been configured yet.');
	}

	const jellyfinUrl = config.jellyfin.internalUrl ?? config.jellyfin.publicUrl;
	const user = await getJellyfinMe(jellyfinUrl, token, options.fetcher);
	if (options.requireAdmin && !user.Policy.IsAdministrator) {
		throw new ApiError(403, 'administrator_required', 'Jellyfin administrator access is required.');
	}

	return { token, user, jellyfinUrl };
}
