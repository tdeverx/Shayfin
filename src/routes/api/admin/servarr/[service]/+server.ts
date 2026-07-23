import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore, ServarrServiceSchema } from '$lib/server/config';
import { errorResponse, parseJson } from '$lib/server/errors';
import { maskServarrInstance } from '$lib/server/settings';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const CreateSchema = z.object({
	label: z.string().trim().min(1).max(80),
	enabled: z.boolean(),
	url: z.string().min(1).max(2048),
	apiKey: z.string().min(1).max(4096)
});

export const GET: RequestHandler = async ({ request, params, fetch }) => {
	try {
		const service = ServarrServiceSchema.parse(params.service);
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		return json((await store.read()).integrations[service].map(maskServarrInstance));
	} catch (cause) {
		return errorResponse(cause);
	}
};

export const POST: RequestHandler = async ({ request, params, fetch }) => {
	try {
		const service = ServarrServiceSchema.parse(params.service);
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		return json(
			maskServarrInstance(
				await store.createServarrInstance(service, CreateSchema.parse(await parseJson(request)))
			)
		);
	} catch (cause) {
		return errorResponse(cause);
	}
};
