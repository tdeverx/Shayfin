import { getConfigStore } from '$lib/server/config';
import { probeJellyfin } from '$lib/server/jellyfin';
import { APP_VERSION } from '$lib/server/version';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
	let config;
	try {
		config = await getConfigStore().read();
	} catch {
		return json(
			{ status: 'unready', version: APP_VERSION, checks: { config: false, jellyfin: false } },
			{ status: 503 }
		);
	}
	if (!config.jellyfin) {
		return json(
			{
				status: 'setup_required',
				version: APP_VERSION,
				checks: { config: true, jellyfin: false }
			},
			{ status: 503 }
		);
	}
	try {
		await probeJellyfin(config.jellyfin.internalUrl ?? config.jellyfin.publicUrl, fetch);
		return json({
			status: 'ready',
			version: APP_VERSION,
			checks: { config: true, jellyfin: true }
		});
	} catch {
		return json(
			{ status: 'unready', version: APP_VERSION, checks: { config: true, jellyfin: false } },
			{ status: 503 }
		);
	}
};
