import type { ConfigStore, StoredIntegration } from './config';
import { ApiError } from './errors';

export type ResolvedIntegration = Omit<StoredIntegration, 'apiKey'> & { apiKey: string };

export async function requireSeerrIntegration(store: ConfigStore): Promise<ResolvedIntegration> {
	const integration = await store.resolveSeerrIntegration();
	if (!integration) {
		throw new ApiError(424, 'seerr_not_configured', 'Seerr is not configured.');
	}
	return integration;
}

export async function integrationRequest(
	integration: ResolvedIntegration,
	path: string,
	options: RequestInit & { userId?: number } = {},
	fetcher: typeof fetch = fetch
): Promise<Response> {
	const headers = new Headers(options.headers);
	headers.set('Accept', 'application/json');
	headers.set('X-Api-Key', integration.apiKey);
	if (options.userId !== undefined) headers.set('X-API-User', String(options.userId));
	if (options.body !== undefined && !headers.has('content-type')) {
		headers.set('Content-Type', 'application/json');
	}

	const url = new URL(path.replace(/^\/+/, ''), `${integration.url}/`).toString();
	try {
		return await fetcher(url, {
			...options,
			headers,
			redirect: 'manual',
			signal: options.signal ?? AbortSignal.timeout(10_000)
		});
	} catch {
		throw new ApiError(
			502,
			'integration_unreachable',
			'The external service could not be reached.'
		);
	}
}

export async function integrationJson(
	integration: ResolvedIntegration,
	path: string,
	options: RequestInit & { userId?: number } = {},
	fetcher: typeof fetch = fetch
): Promise<unknown> {
	const response = await integrationRequest(integration, path, options, fetcher);
	if (response.status === 401 || response.status === 403) {
		throw new ApiError(
			502,
			'integration_unauthorized',
			'The external service rejected its API key.'
		);
	}
	if (!response.ok) {
		throw new ApiError(
			502,
			'integration_error',
			`The external service returned an unexpected ${response.status} response.`
		);
	}
	if (response.status === 204) return undefined;
	return response.json();
}
