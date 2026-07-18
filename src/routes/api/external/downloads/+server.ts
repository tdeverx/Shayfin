import { authenticateRequest } from '$lib/server/auth';
import { getConfigStore } from '$lib/server/config';
import type {
	CapabilityState,
	DownloadProgress,
	NormalizedMediaRequest
} from '$lib/server/contracts';
import { errorResponse } from '$lib/server/errors';
import { resolveSeerrUserId, seerrRequests } from '$lib/server/seerr';
import { fetchServarrQueue, filterDownloadsForRequests } from '$lib/server/servarr';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function unavailable(message: string): CapabilityState {
	return { status: 'unavailable', message };
}

export const GET: RequestHandler = async ({ request, fetch }) => {
	try {
		const store = getConfigStore();
		const auth = await authenticateRequest(request, { store, fetcher: fetch });
		const isAdmin = auth.user.Policy.IsAdministrator;
		const capabilities: Record<'seerr' | 'sonarr' | 'radarr', CapabilityState> = {
			seerr: unavailable('Seerr is not configured.'),
			sonarr: unavailable('Sonarr is not configured.'),
			radarr: unavailable('Radarr is not configured.')
		};

		let ownRequests: NormalizedMediaRequest[] | undefined;
		if (!isAdmin) {
			const seerr = await store.resolveIntegration('seerr');
			if (!seerr) {
				return json({ downloads: [], capabilities });
			}
			try {
				const userId = await resolveSeerrUserId(store, auth.user.Id, fetch);
				ownRequests = await seerrRequests(seerr, userId, { take: 1000 }, fetch);
				capabilities.seerr = { status: 'available' };
			} catch {
				capabilities.seerr = {
					status: 'degraded',
					message: 'Downloads are hidden because request ownership could not be verified.'
				};
				return json({ downloads: [], capabilities });
			}
		} else if (await store.resolveIntegration('seerr')) {
			capabilities.seerr = { status: 'available' };
		}

		const downloads: DownloadProgress[] = [];
		await Promise.all(
			(['sonarr', 'radarr'] as const).map(async (service) => {
				let integration;
				try {
					integration = await store.resolveIntegration(service);
				} catch {
					capabilities[service] = {
						status: 'misconfigured',
						message: `${service === 'sonarr' ? 'Sonarr' : 'Radarr'} credentials could not be read.`
					};
					return;
				}
				if (!integration) return;
				try {
					downloads.push(...(await fetchServarrQueue(service, integration, fetch)));
					capabilities[service] = { status: 'available' };
				} catch {
					capabilities[service] = {
						status: 'degraded',
						message: `${service === 'sonarr' ? 'Sonarr' : 'Radarr'} queue data is unavailable.`
					};
				}
			})
		);

		const visibleDownloads = ownRequests
			? filterDownloadsForRequests(downloads, ownRequests)
			: downloads;
		return json({
			downloads: visibleDownloads.sort((left, right) => left.title.localeCompare(right.title)),
			capabilities
		});
	} catch (error) {
		return errorResponse(error);
	}
};
