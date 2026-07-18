import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore } from '$lib/server/config';
import { errorResponse } from '$lib/server/errors';
import { requireIntegration } from '$lib/server/integrations';
import { resolveSeerrUserId, seerrSearch } from '$lib/server/seerr';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const QuerySchema = z.string().trim().min(1).max(200);

export const GET: RequestHandler = async ({ request, url, fetch }) => {
	try {
		const query = QuerySchema.parse(url.searchParams.get('q'));
		const store = getConfigStore();
		const auth = await authenticateRequest(request, { store, fetcher: fetch });
		const integration = await requireIntegration(store, 'seerr');
		const userId = await resolveSeerrUserId(store, auth.user.Id, fetch);
		return json({ results: await seerrSearch(integration, userId, query, fetch) });
	} catch (error) {
		return errorResponse(error);
	}
};
