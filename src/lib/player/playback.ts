import type {
	PlaybackProgressInput,
	PlaybackProgressPayload,
	PlaybackRoute,
	PlaybackStopPayload,
	PlayerMediaSegment,
	PlayerMediaSource,
	SubtitleTrack,
	SupportedMediaSegmentType
} from './types.js';

export const TICKS_PER_SECOND = 10_000_000;

export const SUPPORTED_MEDIA_SEGMENT_TYPES: readonly SupportedMediaSegmentType[] = [
	'Intro',
	'Outro',
	'Recap',
	'Preview',
	'Commercial'
] as const;

export const MEDIA_SEGMENT_LABELS: Record<SupportedMediaSegmentType, string> = {
	Intro: 'Skip intro',
	Outro: 'Skip credits',
	Recap: 'Skip recap',
	Preview: 'Skip preview',
	Commercial: 'Skip commercial'
};

export const PLAY_METHOD_LABELS = {
	DirectPlay: 'Direct play',
	DirectStream: 'Direct stream',
	Transcode: 'Transcoding'
} as const;

export function ticksToSeconds(ticks: number | null | undefined): number {
	if (!Number.isFinite(ticks) || !ticks || ticks <= 0) return 0;
	return ticks / TICKS_PER_SECOND;
}

export function secondsToTicks(seconds: number | null | undefined): number {
	if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return 0;
	return Math.round(seconds * TICKS_PER_SECOND);
}

export function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeServerUrl(serverUrl: string): string {
	const trimmed = serverUrl.trim();
	if (!trimmed) throw new Error('A Jellyfin server URL is required.');

	const url = new URL(trimmed);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('The Jellyfin server URL must use http or https.');
	}

	url.hash = '';
	url.search = '';
	url.pathname = url.pathname.replace(/\/+$/, '');
	return url.toString().replace(/\/$/, '');
}

export function resolveServerUrl(serverUrl: string, path: string): URL {
	const base = `${normalizeServerUrl(serverUrl)}/`;
	if (/^https?:\/\//i.test(path)) return new URL(path);
	return new URL(path.replace(/^\/+/, ''), base);
}

export function shouldUseNativeHls(
	video: Pick<HTMLVideoElement, 'canPlayType'>,
	environment: { userAgent?: string; platform?: string; maxTouchPoints?: number } = {}
): boolean {
	if (video.canPlayType('application/vnd.apple.mpegurl') === '') return false;
	const userAgent =
		environment.userAgent ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent);
	const platform =
		environment.platform ?? (typeof navigator === 'undefined' ? '' : navigator.platform);
	const maxTouchPoints =
		environment.maxTouchPoints ??
		(typeof navigator === 'undefined' ? 0 : (navigator.maxTouchPoints ?? 0));
	const isIos =
		/iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
	const isSafari =
		/Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(userAgent);
	return isIos || isSafari;
}

export function addAccessToken(url: URL, accessToken: string): URL {
	const authenticatedUrl = new URL(url);
	const hasToken = [...authenticatedUrl.searchParams.keys()].some((key) => {
		const normalized = key.toLowerCase();
		return normalized === 'api_key' || normalized === 'apikey' || normalized === 'x-emby-token';
	});

	if (!hasToken) authenticatedUrl.searchParams.set('api_key', accessToken);
	return authenticatedUrl;
}

export function selectMediaSource(
	mediaSources: PlayerMediaSource[] | null | undefined,
	mediaSourceId?: string | null
): PlayerMediaSource {
	if (!mediaSources?.length) throw new Error('Jellyfin did not return a playable media source.');

	if (mediaSourceId) {
		const requestedSource = mediaSources.find((source) => source.Id === mediaSourceId);
		if (!requestedSource) throw new Error('The selected media source is no longer available.');
		return requestedSource;
	}

	return (
		mediaSources.find((source) => source.SupportsDirectPlay) ??
		mediaSources.find((source) => source.SupportsDirectStream && source.TranscodingUrl) ??
		mediaSources.find((source) => source.TranscodingUrl) ??
		mediaSources[0]
	);
}

export interface SelectPlaybackRouteInput {
	serverUrl: string;
	accessToken: string;
	itemId: string;
	deviceId: string;
	playSessionId?: string | null;
	mediaSource: PlayerMediaSource;
}

export function selectPlaybackRoute(input: SelectPlaybackRouteInput): PlaybackRoute {
	const { mediaSource } = input;
	const playSessionId = input.playSessionId ?? null;
	const mustUseNegotiatedStream =
		Boolean(mediaSource.TranscodingUrl) &&
		(!mediaSource.SupportsDirectPlay || Boolean(mediaSource.TranscodingReasons?.length));

	if (mediaSource.SupportsDirectPlay && !mustUseNegotiatedStream) {
		const directUrl = resolveServerUrl(
			input.serverUrl,
			`Videos/${encodeURIComponent(input.itemId)}/stream`
		);
		directUrl.searchParams.set('Static', 'true');
		directUrl.searchParams.set('deviceId', input.deviceId);
		if (mediaSource.Id) directUrl.searchParams.set('mediaSourceId', mediaSource.Id);
		if (playSessionId) directUrl.searchParams.set('PlaySessionId', playSessionId);

		return {
			url: addAccessToken(directUrl, input.accessToken).toString(),
			playMethod: 'DirectPlay',
			isHls: false,
			mediaSource,
			playSessionId
		};
	}

	if (mediaSource.TranscodingUrl) {
		const streamUrl = addAccessToken(
			resolveServerUrl(input.serverUrl, mediaSource.TranscodingUrl),
			input.accessToken
		);
		const isHls =
			mediaSource.TranscodingSubProtocol?.toLowerCase() === 'hls' ||
			streamUrl.pathname.toLowerCase().endsWith('.m3u8') ||
			streamUrl.pathname.toLowerCase().includes('/master.m3u8');

		return {
			url: streamUrl.toString(),
			playMethod: mediaSource.SupportsDirectStream ? 'DirectStream' : 'Transcode',
			isHls,
			mediaSource,
			playSessionId
		};
	}

	if (mediaSource.SupportsDirectStream) {
		const streamUrl = resolveServerUrl(
			input.serverUrl,
			`Videos/${encodeURIComponent(input.itemId)}/stream`
		);
		streamUrl.searchParams.set('Static', 'false');
		streamUrl.searchParams.set('deviceId', input.deviceId);
		if (mediaSource.Id) streamUrl.searchParams.set('mediaSourceId', mediaSource.Id);
		if (playSessionId) streamUrl.searchParams.set('PlaySessionId', playSessionId);

		return {
			url: addAccessToken(streamUrl, input.accessToken).toString(),
			playMethod: 'DirectStream',
			isHls: false,
			mediaSource,
			playSessionId
		};
	}

	throw new Error('Jellyfin could not negotiate a browser-compatible playback route.');
}

export function selectActiveSegment(
	segments: PlayerMediaSegment[] | null | undefined,
	positionTicks: number
): PlayerMediaSegment | null {
	if (!segments?.length || !Number.isFinite(positionTicks)) return null;

	return (
		segments.find((segment) => {
			if (!SUPPORTED_MEDIA_SEGMENT_TYPES.includes(segment.Type as SupportedMediaSegmentType)) {
				return false;
			}
			const start = segment.StartTicks;
			const end = segment.EndTicks;
			return (
				typeof start === 'number' &&
				typeof end === 'number' &&
				end > start &&
				positionTicks >= start &&
				positionTicks < end
			);
		}) ?? null
	);
}

export function buildPlaybackProgressPayload(
	input: PlaybackProgressInput
): PlaybackProgressPayload {
	return {
		CanSeek: input.canSeek ?? true,
		ItemId: input.itemId,
		MediaSourceId: input.mediaSourceId,
		AudioStreamIndex: input.audioStreamIndex,
		SubtitleStreamIndex: input.subtitleStreamIndex,
		IsPaused: input.paused,
		IsMuted: input.muted,
		PositionTicks: secondsToTicks(input.positionSeconds),
		VolumeLevel: Math.round(clamp(input.volume, 0, 1) * 100),
		PlayMethod: input.playMethod,
		LiveStreamId: input.liveStreamId ?? null,
		PlaySessionId: input.playSessionId,
		RepeatMode: 'RepeatNone'
	};
}

export function buildPlaybackStopPayload(
	input: Pick<
		PlaybackProgressInput,
		'itemId' | 'mediaSourceId' | 'positionSeconds' | 'playSessionId' | 'liveStreamId'
	> & { failed?: boolean }
): PlaybackStopPayload {
	return {
		ItemId: input.itemId,
		MediaSourceId: input.mediaSourceId,
		PositionTicks: secondsToTicks(input.positionSeconds),
		LiveStreamId: input.liveStreamId ?? null,
		PlaySessionId: input.playSessionId,
		Failed: input.failed ?? false
	};
}

export function getExternalSubtitleTrack(
	serverUrl: string,
	accessToken: string,
	mediaSource: PlayerMediaSource | null,
	selectedSubtitleIndex: number | null
): SubtitleTrack | null {
	if (selectedSubtitleIndex === null || !mediaSource?.MediaStreams) return null;

	const stream = mediaSource.MediaStreams.find(
		(candidate) => candidate.Type === 'Subtitle' && candidate.Index === selectedSubtitleIndex
	);
	if (!stream?.DeliveryUrl || stream.DeliveryMethod !== 'External') return null;

	return {
		src: addAccessToken(resolveServerUrl(serverUrl, stream.DeliveryUrl), accessToken).toString(),
		label: stream.DisplayTitle || stream.Title || stream.Language || 'Subtitles',
		language: stream.Language || 'und'
	};
}

export function formatPlayerTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const rounded = Math.floor(seconds);
	const hours = Math.floor(rounded / 3600);
	const minutes = Math.floor((rounded % 3600) / 60);
	const remainingSeconds = rounded % 60;
	return hours > 0
		? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
		: `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
