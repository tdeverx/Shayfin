import type { Api } from '@jellyfin/sdk';
import { describe, expect, it, vi } from 'vitest';
import { PluginHttpClient, capabilityStatusForHttp } from './capabilities.js';

function fakeApi(): Api {
	return {
		basePath: 'https://media.example/jellyfin',
		accessToken: 'token',
		authorizationHeader: 'MediaBrowser Token="token"'
	} as Api;
}

describe('plugin capability handling', () => {
	it('treats 403 and 404 as gracefully unavailable', async () => {
		expect(capabilityStatusForHttp(403)).toBe('unavailable');
		expect(capabilityStatusForHttp(404)).toBe('unavailable');
		const fetchImpl = vi.fn(
			async () => new Response('<html>not installed</html>', { status: 404 })
		);
		const result = await new PluginHttpClient(fakeApi(), fetchImpl).json('/plugin', {
			decode: () => ({ unsafe: true })
		});
		expect(result).toMatchObject({ status: 'unavailable', statusCode: 404 });
		expect(result.data).toBeUndefined();
	});

	it('rejects successful injected HTML instead of exposing it', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response('<script>alert(1)</script>', {
					status: 200,
					headers: { 'content-type': 'text/html' }
				})
		);
		const result = await new PluginHttpClient(fakeApi(), fetchImpl).json('/plugin', {
			decode: (value) => value
		});
		expect(result.status).toBe('degraded');
		expect(result.data).toBeUndefined();
	});
});
