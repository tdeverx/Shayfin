import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore } from '$lib/server/config';
import { errorResponse, parseJson } from '$lib/server/errors';
import { requireSeerrIntegration } from '$lib/server/integrations';
import { createSeerrRequest, resolveSeerrUserId, seerrRequests } from '$lib/server/seerr';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const ListQuerySchema = z.object({
	take: z.coerce.number().int().min(1).max(1000).default(50),
	skip: z.coerce.number().int().min(0).default(0)
});

const CreateRequestSchema = z.object({
	mediaType: z.enum(['movie', 'tv']),
	mediaId: z.number().int().positive(),
	seasons: z.union([z.array(z.number().int().min(0)).min(1), z.literal('all')]).optional(),
	is4k: z.boolean().optional()
});

async function context(request: Request, fetcher: typeof fetch) {
	const store = getConfigStore();
	const auth = await authenticateRequest(request, { store, fetcher });
	const integration = await requireSeerrIntegration(store);
	const userId = await resolveSeerrUserId(store, auth.user.Id, fetcher);
	return { integration, userId };
}

export const GET: RequestHandler = async ({ request, url, fetch }) => {
	try {
		const query = ListQuerySchema.parse({
			take: url.searchParams.get('take') ?? undefined,
			skip: url.searchParams.get('skip') ?? undefined
		});
		const { integration, userId } = await context(request, fetch);
		return json({ results: await seerrRequests(integration, userId, query, fetch) });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body = CreateRequestSchema.parse(await parseJson(request));
		const { integration, userId } = await context(request, fetch);
		const created = await createSeerrRequest(integration, userId, body, fetch);
		return json(created, { status: 201 });
	} catch (error) {
		return errorResponse(error);
	}
};
