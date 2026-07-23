import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore } from '$lib/server/config';
import { errorResponse } from '$lib/server/errors';
import { requireSeerrIntegration } from '$lib/server/integrations';
import { getJellyfinUsers } from '$lib/server/jellyfin';
import { syncSeerrUsers } from '$lib/server/seerr';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const store = getConfigStore();
		const auth = await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		const users = await getJellyfinUsers(auth.jellyfinUrl, auth.token, fetch);
		const result = await syncSeerrUsers(
			store,
			await requireSeerrIntegration(store),
			users.map((user) => user.Id),
			fetch
		);
		return json({ total: users.length, ...result });
	} catch (cause) {
		return errorResponse(cause);
	}
};
