import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore, ServarrServiceSchema } from '$lib/server/config';
import type { CapabilityState } from '$lib/server/contracts';
import { errorResponse } from '$lib/server/errors';
import { integrationJson } from '$lib/server/integrations';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, fetch }) => {
	try {
		const service = ServarrServiceSchema.parse(params.service);
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		const instance = (await store.resolveServarrInstances(service)).find(
			(entry) => entry.id === params.id
		);
		if (!instance)
			return json({
				status: 'misconfigured',
				message: 'Enable this instance and store an API key before testing.'
			} satisfies CapabilityState);
		try {
			await integrationJson(instance, '/api/v3/system/status', {}, fetch);
			return json({
				status: 'available',
				message: `${instance.label} is connected.`
			} satisfies CapabilityState);
		} catch {
			return json({
				status: 'degraded',
				message: `${instance.label} could not be reached or rejected its API key.`
			} satisfies CapabilityState);
		}
	} catch (cause) {
		return errorResponse(cause);
	}
};
