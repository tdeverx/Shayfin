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

interface DownloadCapability extends CapabilityState {
	service: 'seerr' | 'sonarr' | 'radarr';
	instanceId?: string;
	instanceLabel?: string;
}

const ownershipCache = new Map<string, { value: NormalizedMediaRequest[]; storedAt: number }>();
const OWNERSHIP_TTL_MS = 60_000;

export const GET: RequestHandler = async ({ request, fetch }) => {
	try {
		const store = getConfigStore();
		const auth = await authenticateRequest(request, { store, fetcher: fetch });
		const isAdmin = auth.user.Policy.IsAdministrator;
		const capabilities: DownloadCapability[] = [
			{ service: 'seerr', ...unavailable('Seerr is not configured.') }
		];
		const seerrCapability = capabilities[0];

		let ownRequests: NormalizedMediaRequest[] | undefined;
		if (!isAdmin) {
			const seerr = await store.resolveSeerrIntegration();
			if (!seerr) {
				return json({ downloads: [], capabilities });
			}
			try {
				const cacheKey = `${seerr.url}:${auth.user.Id}`;
				const cached = ownershipCache.get(cacheKey);
				if (cached && Date.now() - cached.storedAt < OWNERSHIP_TTL_MS) {
					ownRequests = cached.value;
				} else {
					const userId = await resolveSeerrUserId(store, auth.user.Id, fetch);
					ownRequests = await seerrRequests(seerr, userId, { take: 1000 }, fetch);
					ownershipCache.set(cacheKey, { value: ownRequests, storedAt: Date.now() });
				}
				Object.assign(seerrCapability, { status: 'available', message: undefined });
			} catch {
				Object.assign(seerrCapability, {
					status: 'degraded',
					message: 'Downloads are hidden because request ownership could not be verified.'
				});
				return json({ downloads: [], capabilities });
			}
		} else if (await store.resolveSeerrIntegration()) {
			Object.assign(seerrCapability, { status: 'available', message: undefined });
		}

		const downloads: DownloadProgress[] = [];
		await Promise.all(
			(['sonarr', 'radarr'] as const).map(async (service) => {
				let instances;
				try {
					instances = await store.resolveServarrInstances(service);
				} catch {
					capabilities.push({
						service,
						status: 'misconfigured',
						message: `${service === 'sonarr' ? 'Sonarr' : 'Radarr'} credentials could not be read.`
					});
					return;
				}
				if (!instances.length) {
					capabilities.push({
						service,
						...unavailable(
							`No enabled ${service === 'sonarr' ? 'Sonarr' : 'Radarr'} instances are configured.`
						)
					});
					return;
				}
				await Promise.all(
					instances.map(async (instance) => {
						const capability: DownloadCapability = {
							service,
							instanceId: instance.id,
							instanceLabel: instance.label,
							status: 'available'
						};
						capabilities.push(capability);
						try {
							downloads.push(...(await fetchServarrQueue(service, instance, fetch)));
						} catch {
							Object.assign(capability, {
								status: 'degraded',
								message: `${instance.label} queue data is unavailable.`
							});
						}
					})
				);
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
