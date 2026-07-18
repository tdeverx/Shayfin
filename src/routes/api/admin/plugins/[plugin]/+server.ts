import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore, PluginIntegrationNameSchema } from '$lib/server/config';
import { errorResponse, parseJson } from '$lib/server/errors';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const PluginUpdateSchema = z.object({
	enabled: z.boolean(),
	unlockNotifications: z.boolean().optional()
});

export const PUT: RequestHandler = async ({ request, params, fetch }) => {
	try {
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		const plugin = PluginIntegrationNameSchema.parse(params.plugin);
		const saved = await store.setPluginIntegration(
			plugin,
			PluginUpdateSchema.parse(await parseJson(request))
		);
		return json(saved);
	} catch (error) {
		return errorResponse(error);
	}
};
