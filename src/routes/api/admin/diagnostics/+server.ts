import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore } from '$lib/server/config';
import { errorResponse } from '$lib/server/errors';
import { probeJellyfin } from '$lib/server/jellyfin';
import { browserNetworkCompatibility, publicNetworkProbe } from '$lib/server/network';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url, fetch }) => {
	try {
		const store = getConfigStore();
		await authenticateRequest(request, { requireAdmin: true, store, fetcher: fetch });
		const config = await store.read();
		if (!config.jellyfin) throw new Error('Authenticated without a configured server.');

		const origin = url.origin;
		const internalUrl = config.jellyfin.internalUrl ?? config.jellyfin.publicUrl;
		const [publicProbe, internalProbe] = await Promise.all([
			publicNetworkProbe(config.jellyfin.publicUrl, origin, fetch),
			probeJellyfin(internalUrl, fetch)
				.then(() => ({ reachable: true }))
				.catch(() => ({ reachable: false }))
		]);
		const compatibility = browserNetworkCompatibility(origin, config.jellyfin.publicUrl);

		return json({
			origin,
			deployment: {
				protocol: url.protocol.replace(':', ''),
				host: url.hostname,
				port: url.port || (url.protocol === 'https:' ? '443' : '80')
			},
			jellyfin: {
				publicUrl: config.jellyfin.publicUrl,
				internalUrl,
				publicReachableFromContainer: publicProbe.reachable,
				internalReachableFromContainer: internalProbe.reachable,
				cors: publicProbe.cors,
				corsAllowOrigin: publicProbe.allowOrigin,
				mixedContent: compatibility.mixedContent,
				websocketUrl: compatibility.websocketUrl
			}
		});
	} catch (error) {
		return errorResponse(error);
	}
};
