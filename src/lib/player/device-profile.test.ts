import { describe, expect, it } from 'vitest';
import { qualityBitrate, qualityCodecProfiles } from './device-profile';

describe('playback quality profile', () => {
	it('maps browser quality bitrate to Jellyfin bits per second', () => {
		expect(qualityBitrate({ maxResolution: 'auto', maxBitrateMbps: 'auto' })).toBe(120_000_000);
		expect(qualityBitrate({ maxResolution: 1080, maxBitrateMbps: 20 })).toBe(20_000_000);
	});

	it('adds required dimensions only for capped resolution', () => {
		expect(qualityCodecProfiles({ maxResolution: 'auto', maxBitrateMbps: 20 })).toEqual([]);
		expect(qualityCodecProfiles({ maxResolution: 720, maxBitrateMbps: 20 })[0]?.Conditions).toEqual(
			[
				{ Condition: 'LessThanEqual', Property: 'Width', Value: '1280', IsRequired: true },
				{ Condition: 'LessThanEqual', Property: 'Height', Value: '720', IsRequired: true }
			]
		);
	});
});
