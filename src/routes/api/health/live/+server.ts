import { getConfigStore } from '$lib/server/config';
import { getSetupToken } from '$lib/server/setup';
import { APP_VERSION } from '$lib/server/version';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		if (!(await getConfigStore().read()).jellyfin) getSetupToken();
	} catch {
		// Liveness intentionally stays independent from configuration readiness.
	}
	return json({ status: 'ok', version: APP_VERSION, timestamp: new Date().toISOString() });
};
