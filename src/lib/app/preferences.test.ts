import { describe, expect, it } from 'vitest';
import {
	DEFAULT_BROWSER_PREFERENCES,
	decodeBrowserPreferences,
	preferencesKey
} from './preferences';

describe('browser preferences', () => {
	it('uses safe defaults for corrupt values', () => {
		expect(decodeBrowserPreferences({ playback: { quality: { maxResolution: 999 } } })).toEqual(
			DEFAULT_BROWSER_PREFERENCES
		);
	});

	it('keeps valid quality and behavior settings', () => {
		expect(
			decodeBrowserPreferences({
				playback: {
					quality: { maxResolution: 1080, maxBitrateMbps: 20 },
					autoplayNext: false
				},
				experience: { themeAudio: false }
			})
		).toMatchObject({
			playback: { quality: { maxResolution: 1080, maxBitrateMbps: 20 }, autoplayNext: false },
			experience: { themeAudio: false }
		});
	});

	it('isolates storage by server and user', () => {
		expect(preferencesKey('server-a', 'user-a')).not.toBe(preferencesKey('server-b', 'user-a'));
		expect(preferencesKey('server-a', 'user-a')).not.toBe(preferencesKey('server-a', 'user-b'));
	});
});
