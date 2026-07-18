import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore } from '$lib/server/config';
import { ApiError, errorResponse, parseJson } from '$lib/server/errors';
import { getJellyfinMe, validateJellyfinEndpoints } from '$lib/server/jellyfin';
import { maskAdminSettings } from '$lib/server/settings';
import { normalizeServiceUrl } from '$lib/server/url';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const SettingsUpdateSchema = z.object({
	jellyfinPublicUrl: z.string().min(1).max(2048),
	jellyfinInternalUrl: z.string().max(2048).nullish()
});

export const GET: RequestHandler = async ({ request, fetch }) => {
	try {
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		return json(maskAdminSettings(await store.read()));
	} catch (error) {
		return errorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ request, fetch }) => {
	try {
		const store = getConfigStore();
		const auth = await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		const body = SettingsUpdateSchema.parse(await parseJson(request));
		const publicUrl = normalizeServiceUrl(body.jellyfinPublicUrl);
		const internalUrl = body.jellyfinInternalUrl?.trim()
			? normalizeServiceUrl(body.jellyfinInternalUrl)
			: undefined;
		const validationUrl = internalUrl ?? publicUrl;
		const [user, server] = await Promise.all([
			getJellyfinMe(validationUrl, auth.token, fetch),
			validateJellyfinEndpoints(publicUrl, internalUrl, auth.token, fetch)
		]);
		if (!user.Policy.IsAdministrator) {
			throw new ApiError(
				403,
				'administrator_required',
				'Jellyfin administrator access is required.'
			);
		}

		const updated = await store.update((config) => {
			config.jellyfin = {
				publicUrl,
				internalUrl,
				serverId: server.id,
				serverName: server.name,
				serverVersion: server.version
			};
			return config;
		});
		return json(maskAdminSettings(updated));
	} catch (error) {
		return errorResponse(error);
	}
};
