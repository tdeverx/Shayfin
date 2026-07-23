import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore } from '$lib/server/config';
import type { CapabilityState } from '$lib/server/contracts';
import { errorResponse } from '$lib/server/errors';
import { integrationJson, requireSeerrIntegration } from '$lib/server/integrations';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		try {
			await integrationJson(await requireSeerrIntegration(store), '/api/v1/status', {}, fetch);
			return json({
				status: 'available',
				message: 'Seerr is connected.'
			} satisfies CapabilityState);
		} catch {
			return json({
				status: 'degraded',
				message: 'Seerr could not be reached or rejected its API key.'
			} satisfies CapabilityState);
		}
	} catch (cause) {
		return errorResponse(cause);
	}
};
