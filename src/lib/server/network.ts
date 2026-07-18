import { joinServiceUrl } from './url';

export interface BrowserNetworkCompatibility {
	mixedContent: boolean;
	websocketUrl: string;
}

export function browserNetworkCompatibility(
	appOrigin: string,
	jellyfinPublicUrl: string
): BrowserNetworkCompatibility {
	const app = new URL(appOrigin);
	const jellyfin = new URL(jellyfinPublicUrl);
	const websocket = new URL(jellyfinPublicUrl);
	websocket.protocol = websocket.protocol === 'https:' ? 'wss:' : 'ws:';
	websocket.pathname = `${websocket.pathname.replace(/\/+$/, '')}/socket`;
	websocket.search = '';
	websocket.hash = '';

	return {
		mixedContent: app.protocol === 'https:' && jellyfin.protocol === 'http:',
		websocketUrl: websocket.toString()
	};
}

export async function publicNetworkProbe(
	baseUrl: string,
	origin: string,
	fetcher: typeof fetch = fetch
): Promise<{
	reachable: boolean;
	cors: 'allowed' | 'blocked' | 'unknown';
	allowOrigin?: string;
}> {
	try {
		const url = joinServiceUrl(baseUrl, '/System/Info/Public');
		const [response, preflight] = await Promise.all([
			fetcher(url, {
				headers: { Accept: 'application/json', Origin: origin },
				redirect: 'manual',
				signal: AbortSignal.timeout(5_000)
			}),
			fetcher(url, {
				method: 'OPTIONS',
				headers: {
					Origin: origin,
					'Access-Control-Request-Method': 'GET',
					'Access-Control-Request-Headers': 'authorization,x-emby-token'
				},
				redirect: 'manual',
				signal: AbortSignal.timeout(5_000)
			})
		]);
		const allowOrigin = preflight.headers.get('access-control-allow-origin') ?? undefined;
		const allowMethods = preflight.headers.get('access-control-allow-methods')?.toLowerCase() ?? '';
		const allowHeaders = preflight.headers.get('access-control-allow-headers')?.toLowerCase() ?? '';
		const originAllowed = allowOrigin === '*' || allowOrigin === origin;
		const methodAllowed =
			allowMethods === '*' || allowMethods.split(',').some((v) => v.trim() === 'get');
		const requestedHeadersAllowed =
			allowHeaders === '*' ||
			(['authorization', 'x-emby-token'] as const).every((header) =>
				allowHeaders.split(',').some((value) => value.trim() === header)
			);
		return {
			reachable: response.ok,
			cors:
				preflight.ok && originAllowed && methodAllowed && requestedHeadersAllowed
					? 'allowed'
					: 'blocked',
			allowOrigin
		};
	} catch {
		return { reachable: false, cors: 'unknown' };
	}
}
