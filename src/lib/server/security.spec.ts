import { describe, expect, it, vi } from 'vitest';
import { integrationRequest } from './integrations';
import { getJellyfinMe, validateJellyfinEndpoints } from './jellyfin';

describe('credential-bearing server requests', () => {
	it('never follows Jellyfin redirects while carrying a user token', async () => {
		const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
			expect(init?.redirect).toBe('manual');
			expect(new Headers(init?.headers).get('x-emby-token')).toBe('secret');
			return new Response(null, { status: 302, headers: { location: 'https://evil.test' } });
		}) as unknown as typeof fetch;

		await expect(getJellyfinMe('https://jellyfin.test', 'secret', fetcher)).rejects.toMatchObject({
			code: 'jellyfin_error'
		});
	});

	it('never follows integration redirects while carrying an API key', async () => {
		const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
			expect(init?.redirect).toBe('manual');
			expect(new Headers(init?.headers).get('x-api-key')).toBe('secret');
			return new Response(null, { status: 302, headers: { location: 'https://evil.test' } });
		}) as unknown as typeof fetch;

		const response = await integrationRequest(
			{ enabled: true, url: 'https://seerr.test', apiKey: 'secret' },
			'/api/v1/status',
			{},
			fetcher
		);
		expect(response.status).toBe(302);
	});

	it('rejects public and internal URLs that identify different Jellyfin servers', async () => {
		const fetcher = vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			const id = url.startsWith('https://public.test') ? 'public-id' : 'internal-id';
			return Response.json({ Id: id, ServerName: id, Version: '10.11.0' });
		}) as unknown as typeof fetch;

		await expect(
			validateJellyfinEndpoints(
				'https://public.test',
				'http://internal.test:8096',
				'secret',
				fetcher
			)
		).rejects.toMatchObject({ code: 'jellyfin_identity_mismatch' });
	});
});
