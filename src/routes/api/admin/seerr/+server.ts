import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore } from '$lib/server/config';
import { errorResponse, parseJson } from '$lib/server/errors';
import { maskIntegration } from '$lib/server/settings';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const UpdateSchema = z.object({
	enabled: z.boolean(),
	url: z.string().min(1).max(2048),
	apiKey: z.string().min(1).max(4096).nullish().optional()
});

export const GET: RequestHandler = async ({ request, fetch }) => {
	try {
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		return json(maskIntegration((await store.read()).integrations.seerr));
	} catch (cause) {
		return errorResponse(cause);
	}
};

export const PUT: RequestHandler = async ({ request, fetch }) => {
	try {
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		return json(
			maskIntegration(await store.setSeerrIntegration(UpdateSchema.parse(await parseJson(request))))
		);
	} catch (cause) {
		return errorResponse(cause);
	}
};
