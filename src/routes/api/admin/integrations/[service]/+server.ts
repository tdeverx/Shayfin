import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore, IntegrationNameSchema } from '$lib/server/config';
import { errorResponse, parseJson } from '$lib/server/errors';
import { maskIntegration } from '$lib/server/settings';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const IntegrationUpdateSchema = z.object({
	enabled: z.boolean(),
	url: z.string().min(1).max(2048),
	apiKey: z.string().min(1).max(4096).nullish().optional()
});

export const GET: RequestHandler = async ({ request, params, fetch }) => {
	try {
		const service = IntegrationNameSchema.parse(params.service);
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		return json(maskIntegration((await store.read()).integrations[service]));
	} catch (error) {
		return errorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ request, params, fetch }) => {
	try {
		const service = IntegrationNameSchema.parse(params.service);
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		const body = IntegrationUpdateSchema.parse(await parseJson(request));
		const saved = await store.setIntegration(service, body);
		return json(maskIntegration(saved));
	} catch (error) {
		return errorResponse(error);
	}
};
