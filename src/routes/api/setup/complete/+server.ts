import { CONFIG_SCHEMA_VERSION, getConfigStore } from '$lib/server/config';
import { ApiError, errorResponse, parseJson } from '$lib/server/errors';
import { getJellyfinMe, validateJellyfinEndpoints } from '$lib/server/jellyfin';
import { normalizeServiceUrl } from '$lib/server/url';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const SetupSchema = z.object({
	jellyfinPublicUrl: z.string().min(1).max(2048),
	jellyfinInternalUrl: z.string().max(2048).nullish(),
	jellyfinToken: z.string().min(1).max(4096)
});

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body = SetupSchema.parse(await parseJson(request));
		const store = getConfigStore();
		if ((await store.read()).jellyfin) {
			throw new ApiError(409, 'already_configured', 'Shayfin setup has already been completed.');
		}

		const publicUrl = normalizeServiceUrl(body.jellyfinPublicUrl);
		const internalUrl = body.jellyfinInternalUrl?.trim()
			? normalizeServiceUrl(body.jellyfinInternalUrl)
			: undefined;
		const validationUrl = internalUrl ?? publicUrl;
		const [user, server] = await Promise.all([
			getJellyfinMe(validationUrl, body.jellyfinToken, fetch),
			validateJellyfinEndpoints(publicUrl, internalUrl, body.jellyfinToken, fetch)
		]);
		if (!user.Policy.IsAdministrator) {
			throw new ApiError(
				403,
				'administrator_required',
				'A Jellyfin administrator must complete setup.'
			);
		}

		await store.update((config) => {
			if (config.jellyfin) {
				throw new ApiError(409, 'already_configured', 'Shayfin setup has already been completed.');
			}
			return {
				schemaVersion: CONFIG_SCHEMA_VERSION,
				jellyfin: {
					publicUrl,
					internalUrl,
					serverId: server.id,
					serverName: server.name,
					serverVersion: server.version
				},
				integrations: config.integrations,
				plugins: config.plugins
			};
		});

		return json(
			{
				configured: true,
				jellyfin: { publicUrl, server }
			},
			{ status: 201 }
		);
	} catch (error) {
		return errorResponse(error);
	}
};
