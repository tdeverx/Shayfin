import { describe, expect, it, vi } from 'vitest';
import { browserNetworkCompatibility, publicNetworkProbe } from './network';

describe('network diagnostics', () => {
	it('detects mixed content and builds a Jellyfin WebSocket URL with a base path', () => {
		expect(
			browserNetworkCompatibility('https://shayfin.example.test', 'http://media.test/jellyfin/')
		).toEqual({
			mixedContent: true,
			websocketUrl: 'ws://media.test/jellyfin/socket'
		});
	});

	it('simulates the browser origin when checking Jellyfin CORS', async () => {
		const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
			expect(new Headers(init?.headers).get('origin')).toBe('https://shayfin.test');
			expect(init?.redirect).toBe('manual');
			if (init?.method === 'OPTIONS') {
				expect(new Headers(init.headers).get('access-control-request-headers')).toBe(
					'authorization,x-emby-token'
				);
				return new Response(null, {
					status: 204,
					headers: {
						'Access-Control-Allow-Origin': 'https://shayfin.test',
						'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
						'Access-Control-Allow-Headers': 'Authorization, X-Emby-Token'
					}
				});
			}
			return new Response('{}', {
				status: 200
			});
		}) as unknown as typeof fetch;

		await expect(
			publicNetworkProbe('http://jellyfin:8096', 'https://shayfin.test', fetcher)
		).resolves.toEqual({
			reachable: true,
			cors: 'allowed',
			allowOrigin: 'https://shayfin.test'
		});
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
