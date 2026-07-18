import { describe, expect, it } from 'vitest';
import type { Api } from '@jellyfin/sdk';
import { themeSongStreamUrl } from './media.js';

describe('themeSongStreamUrl', () => {
	it('requests a browser-safe MP3 transcode instead of trusting a misleading source extension', () => {
		const api = {
			basePath: 'http://jellyfin.test/base',
			accessToken: 'test-token',
			deviceInfo: { id: 'test-device' }
		} as Api;

		const url = new URL(themeSongStreamUrl(api, 'theme song', 'user-1'));

		expect(url.pathname).toBe('/base/Audio/theme%20song/universal');
		expect(url.searchParams.get('AudioCodec')).toBe('mp3');
		expect(url.searchParams.get('TranscodingContainer')).toBe('mp3');
		expect(url.searchParams.get('TranscodingProtocol')).toBe('http');
		expect(url.searchParams.get('UserId')).toBe('user-1');
		expect(url.searchParams.has('Static')).toBe(false);
	});
});
