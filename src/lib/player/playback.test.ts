import { describe, expect, it } from 'vitest';
import {
	buildPlaybackProgressPayload,
	buildPlaybackStopPayload,
	formatPlayerTime,
	secondsToTicks,
	selectActiveSegment,
	selectMediaSource,
	selectPlaybackRoute,
	shouldUseNativeHls,
	ticksToSeconds
} from './playback.js';
import type { PlayerMediaSegment, PlayerMediaSource } from './types.js';

describe('Jellyfin ticks', () => {
	it('converts between seconds and Jellyfin ticks', () => {
		expect(secondsToTicks(12.3456789)).toBe(123_456_789);
		expect(ticksToSeconds(123_456_789)).toBeCloseTo(12.3456789);
	});

	it('clamps invalid and negative positions to zero', () => {
		expect(secondsToTicks(-4)).toBe(0);
		expect(secondsToTicks(Number.NaN)).toBe(0);
		expect(ticksToSeconds(undefined)).toBe(0);
	});

	it('formats short and long durations for the controls', () => {
		expect(formatPlayerTime(65.9)).toBe('1:05');
		expect(formatPlayerTime(3_661)).toBe('1:01:01');
	});
});

describe('playback route selection', () => {
	const baseInput = {
		serverUrl: 'https://media.example.test/jellyfin',
		accessToken: 'secret token',
		itemId: 'item/id',
		deviceId: 'browser-device',
		playSessionId: 'play-session'
	};

	it('builds an authenticated static stream for direct play', () => {
		const route = selectPlaybackRoute({
			...baseInput,
			mediaSource: { Id: 'source-1', SupportsDirectPlay: true }
		});
		const url = new URL(route.url);

		expect(route.playMethod).toBe('DirectPlay');
		expect(route.isHls).toBe(false);
		expect(url.pathname).toBe('/jellyfin/Videos/item%2Fid/stream');
		expect(url.searchParams.get('Static')).toBe('true');
		expect(url.searchParams.get('mediaSourceId')).toBe('source-1');
		expect(url.searchParams.get('api_key')).toBe('secret token');
	});

	it('uses a negotiated HLS route for a transcode', () => {
		const route = selectPlaybackRoute({
			...baseInput,
			mediaSource: {
				Id: 'source-2',
				SupportsTranscoding: true,
				TranscodingSubProtocol: 'hls',
				TranscodingUrl: 'Videos/item/master.m3u8?PlaySessionId=play-session'
			}
		});
		const url = new URL(route.url);

		expect(route.playMethod).toBe('Transcode');
		expect(route.isHls).toBe(true);
		expect(url.pathname).toBe('/jellyfin/Videos/item/master.m3u8');
		expect(url.searchParams.get('api_key')).toBe('secret token');
	});

	it('identifies a negotiated remux as direct stream', () => {
		const route = selectPlaybackRoute({
			...baseInput,
			mediaSource: {
				SupportsDirectStream: true,
				TranscodingUrl: '/Videos/item/master.m3u8'
			}
		});

		expect(route.playMethod).toBe('DirectStream');
		expect(route.isHls).toBe(true);
	});

	it('prefers a direct-play source and honors an explicit source id', () => {
		const sources: PlayerMediaSource[] = [
			{ Id: 'transcode', TranscodingUrl: '/stream.m3u8' },
			{ Id: 'direct', SupportsDirectPlay: true }
		];

		expect(selectMediaSource(sources).Id).toBe('direct');
		expect(selectMediaSource(sources, 'transcode').Id).toBe('transcode');
	});
});

describe('HLS engine selection', () => {
	const hlsVideo = { canPlayType: () => 'maybe' } as Pick<HTMLVideoElement, 'canPlayType'>;

	it('uses native HLS on Safari and iOS WebKit', () => {
		expect(
			shouldUseNativeHls(hlsVideo, {
				userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18 Safari/605.1.15'
			})
		).toBe(true);
		expect(
			shouldUseNativeHls(hlsVideo, {
				userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/128 Mobile/15E148',
				platform: 'iPhone'
			})
		).toBe(true);
	});

	it('uses hls.js on Chromium and Firefox even when canPlayType is optimistic', () => {
		expect(
			shouldUseNativeHls(hlsVideo, {
				userAgent: 'Mozilla/5.0 AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'
			})
		).toBe(false);
		expect(shouldUseNativeHls(hlsVideo, { userAgent: 'Mozilla/5.0 Firefox/128.0' })).toBe(false);
	});
});

describe('media segments', () => {
	const segments: PlayerMediaSegment[] = [
		{ Type: 'Intro', StartTicks: secondsToTicks(15), EndTicks: secondsToTicks(80) },
		{ Type: 'Unknown', StartTicks: 0, EndTicks: secondsToTicks(200) },
		{ Type: 'Outro', StartTicks: secondsToTicks(1_500), EndTicks: secondsToTicks(1_560) }
	];

	it('selects a supported segment while the playhead is inside it', () => {
		expect(selectActiveSegment(segments, secondsToTicks(40))?.Type).toBe('Intro');
	});

	it('treats the segment end as exclusive and ignores unknown types', () => {
		expect(selectActiveSegment(segments, secondsToTicks(80))).toBeNull();
		expect(selectActiveSegment(segments, secondsToTicks(400))).toBeNull();
	});
});

describe('session reporting payloads', () => {
	const progressInput = {
		itemId: 'episode-1',
		mediaSourceId: 'source-1',
		audioStreamIndex: 2,
		subtitleStreamIndex: null,
		positionSeconds: 42.25,
		paused: false,
		muted: false,
		volume: 0.555,
		playMethod: 'DirectPlay' as const,
		playSessionId: 'play-session',
		liveStreamId: null
	};

	it('builds the Playing and Progress body expected by Jellyfin', () => {
		expect(buildPlaybackProgressPayload(progressInput)).toEqual({
			CanSeek: true,
			ItemId: 'episode-1',
			MediaSourceId: 'source-1',
			AudioStreamIndex: 2,
			SubtitleStreamIndex: null,
			IsPaused: false,
			IsMuted: false,
			PositionTicks: 422_500_000,
			VolumeLevel: 56,
			PlayMethod: 'DirectPlay',
			LiveStreamId: null,
			PlaySessionId: 'play-session',
			RepeatMode: 'RepeatNone'
		});
	});

	it('builds a terminal Stopped body without leaking unrelated state', () => {
		expect(buildPlaybackStopPayload({ ...progressInput, failed: true })).toEqual({
			ItemId: 'episode-1',
			MediaSourceId: 'source-1',
			PositionTicks: 422_500_000,
			LiveStreamId: null,
			PlaySessionId: 'play-session',
			Failed: true
		});
	});
});
