import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore, IntegrationNameSchema } from '$lib/server/config';
import type { CapabilityState } from '$lib/server/contracts';
import { errorResponse } from '$lib/server/errors';
import { integrationJson, requireIntegration } from '$lib/server/integrations';
import { integrationLabel } from '$lib/server/settings';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, fetch }) => {
	try {
		const service = IntegrationNameSchema.parse(params.service);
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		const integration = await requireIntegration(store, service);

		try {
			await integrationJson(
				integration,
				service === 'seerr' ? '/api/v1/status' : '/api/v3/system/status',
				{},
				fetch
			);
			return json({
				status: 'available',
				message: `${integrationLabel(service)} is connected.`
			} satisfies CapabilityState);
		} catch {
			return json({
				status: 'degraded',
				message: `${integrationLabel(service)} could not be reached or rejected its API key.`
			} satisfies CapabilityState);
		}
	} catch (error) {
		return errorResponse(error);
	}
};
