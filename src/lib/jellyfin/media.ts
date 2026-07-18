import type { Api } from '@jellyfin/sdk';
import type { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type.js';
import { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type.js';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js';
import { getMediaSegmentsApi } from '@jellyfin/sdk/lib/utils/api/media-segments-api.js';
import type { MediaSegment, ThemeSong } from './types.js';

export interface ImageUrlOptions {
	type?: ImageType;
	tag?: string | null;
	maxWidth?: number;
	maxHeight?: number;
	quality?: number;
	index?: number;
	includeToken?: boolean;
}

export interface StreamUrlOptions {
	mediaSourceId?: string;
	playSessionId?: string;
	audioStreamIndex?: number;
	subtitleStreamIndex?: number;
	container?: string;
	static?: boolean;
}

export function apiUrl(
	api: Api,
	path: string,
	params: Record<string, string | number | boolean | null | undefined> = {}
): string {
	const base = api.basePath.endsWith('/') ? api.basePath : `${api.basePath}/`;
	const url = new URL(path.replace(/^\//, ''), base);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') {
			url.searchParams.set(key, String(value));
		}
	}
	return url.toString();
}

export function itemImageUrl(api: Api, itemId: string, options: ImageUrlOptions = {}): string {
	const type = options.type ?? 'Primary';
	const path = `/Items/${encodeURIComponent(itemId)}/Images/${type}${
		options.index == null ? '' : `/${options.index}`
	}`;
	return apiUrl(api, path, {
		tag: options.tag,
		maxWidth: options.maxWidth,
		maxHeight: options.maxHeight,
		quality: options.quality,
		api_key: options.includeToken === false ? undefined : api.accessToken
	});
}

export function userImageUrl(
	api: Api,
	userId: string,
	options: Omit<ImageUrlOptions, 'type' | 'index'> = {}
): string {
	return apiUrl(api, `/Users/${encodeURIComponent(userId)}/Images/Primary`, {
		tag: options.tag,
		maxWidth: options.maxWidth,
		maxHeight: options.maxHeight,
		quality: options.quality,
		api_key: options.includeToken === false ? undefined : api.accessToken
	});
}

function streamParams(api: Api, options: StreamUrlOptions) {
	return {
		api_key: api.accessToken,
		DeviceId: api.deviceInfo.id,
		MediaSourceId: options.mediaSourceId,
		PlaySessionId: options.playSessionId,
		AudioStreamIndex: options.audioStreamIndex,
		SubtitleStreamIndex: options.subtitleStreamIndex,
		Container: options.container,
		Static: options.static ?? true
	};
}

export function videoStreamUrl(api: Api, itemId: string, options: StreamUrlOptions = {}): string {
	return apiUrl(api, `/Videos/${encodeURIComponent(itemId)}/stream`, streamParams(api, options));
}

export function hlsMasterUrl(api: Api, itemId: string, options: StreamUrlOptions = {}): string {
	return apiUrl(
		api,
		`/Videos/${encodeURIComponent(itemId)}/master.m3u8`,
		streamParams(api, { ...options, static: false })
	);
}

export function audioStreamUrl(api: Api, itemId: string, options: StreamUrlOptions = {}): string {
	return apiUrl(api, `/Audio/${encodeURIComponent(itemId)}/universal`, streamParams(api, options));
}

export function themeSongStreamUrl(api: Api, itemId: string, userId?: string): string {
	return apiUrl(api, `/Audio/${encodeURIComponent(itemId)}/universal`, {
		api_key: api.accessToken,
		DeviceId: api.deviceInfo.id,
		UserId: userId,
		Container: 'mp3',
		AudioCodec: 'mp3',
		MaxAudioChannels: 2,
		TranscodingAudioChannels: 2,
		MaxStreamingBitrate: 320_000,
		AudioBitRate: 192_000,
		TranscodingContainer: 'mp3',
		TranscodingProtocol: 'http',
		EnableAudioVbrEncoding: true
	});
}

export function subtitleUrl(
	api: Api,
	itemId: string,
	mediaSourceId: string,
	streamIndex: number,
	format = 'vtt'
): string {
	return apiUrl(
		api,
		`/Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaSourceId)}/Subtitles/${streamIndex}/Stream.${encodeURIComponent(format)}`,
		{ api_key: api.accessToken }
	);
}

export async function loadThemeSongs(
	api: Api,
	itemId: string,
	userId?: string
): Promise<ThemeSong[]> {
	const response = await getLibraryApi(api).getThemeSongs({
		itemId,
		userId,
		inheritFromParent: true
	});
	return (response.data.Items ?? []).flatMap((item) =>
		item.Id ? [{ item, streamUrl: themeSongStreamUrl(api, item.Id, userId) }] : []
	);
}

export async function loadMediaSegments(api: Api, itemId: string): Promise<MediaSegment[]> {
	const response = await getMediaSegmentsApi(api).getItemSegments({
		itemId,
		includeSegmentTypes: [
			MediaSegmentType.Intro,
			MediaSegmentType.Outro,
			MediaSegmentType.Recap,
			MediaSegmentType.Preview,
			MediaSegmentType.Commercial
		]
	});

	return (response.data.Items ?? [])
		.filter((segment) => segment.EndTicks != null && segment.StartTicks != null)
		.map((segment) => ({
			...segment,
			startSeconds: segment.StartTicks! / 10_000_000,
			endSeconds: segment.EndTicks! / 10_000_000
		}))
		.filter((segment) => segment.endSeconds > segment.startSeconds)
		.sort((a, b) => a.startSeconds - b.startSeconds);
}
