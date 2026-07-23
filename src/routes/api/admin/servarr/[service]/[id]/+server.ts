import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore, ServarrServiceSchema } from '$lib/server/config';
import { errorResponse, parseJson } from '$lib/server/errors';
import { maskServarrInstance } from '$lib/server/settings';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const UpdateSchema = z.object({
	label: z.string().trim().min(1).max(80),
	enabled: z.boolean(),
	url: z.string().min(1).max(2048),
	apiKey: z.string().min(1).max(4096).nullish().optional()
});

export const PUT: RequestHandler = async ({ request, params, fetch }) => {
	try {
		const service = ServarrServiceSchema.parse(params.service);
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		return json(
			maskServarrInstance(
				await store.updateServarrInstance(
					service,
					params.id,
					UpdateSchema.parse(await parseJson(request))
				)
			)
		);
	} catch (cause) {
		return errorResponse(cause);
	}
};

export const DELETE: RequestHandler = async ({ request, params, fetch }) => {
	try {
		const service = ServarrServiceSchema.parse(params.service);
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		await store.deleteServarrInstance(service, params.id);
		return json({ deleted: true });
	} catch (cause) {
		return errorResponse(cause);
	}
};
