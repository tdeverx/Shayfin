import { ClientType, Innertube } from 'youtubei.js';
import { ApiError } from './errors';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const ANDROID_CLIENT = 'ANDROID' as const;

let clientPromise: Promise<Innertube> | undefined;

function client(): Promise<Innertube> {
	clientPromise ??= Innertube.create({
		client_type: ClientType.ANDROID,
		generate_session_locally: true,
		enable_session_cache: true
	});
	return clientPromise;
}

export interface ByteRange {
	start: number;
	end: number;
}

export function parseByteRange(value: string | null, length: number): ByteRange | null {
	const match = value?.match(/^bytes=(\d+)-(\d*)$/);
	if (!match || length <= 0) return null;
	const start = Number(match[1]);
	const requestedEnd = match[2] ? Number(match[2]) : length - 1;
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= length) {
		return null;
	}
	return { start, end: Math.min(Math.max(start, requestedEnd), length - 1) };
}

export interface YoutubeTrailerStream {
	body: ReadableStream<Uint8Array>;
	contentType: string;
	contentLength?: number;
	range: ByteRange | null;
}

export async function youtubeTrailerStream(
	videoId: string,
	rangeHeader: string | null
): Promise<YoutubeTrailerStream> {
	if (!YOUTUBE_ID.test(videoId)) {
		throw new ApiError(400, 'invalid_youtube_id', 'The YouTube video identifier is invalid.');
	}

	const youtube = await client();
	const info = await youtube.getBasicInfo(videoId, { client: ANDROID_CLIENT });
	if (info.playability_status?.status !== 'OK') {
		throw new ApiError(404, 'trailer_unavailable', 'This YouTube trailer is unavailable.');
	}
	const format = info.chooseFormat({
		client: ANDROID_CLIENT,
		type: 'video+audio',
		quality: 'best',
		format: 'any'
	});
	const contentLength = format.content_length;
	const range = contentLength ? parseByteRange(rangeHeader, contentLength) : null;
	const body = await info.download({
		client: ANDROID_CLIENT,
		type: 'video+audio',
		quality: 'best',
		format: 'any',
		range: range ?? undefined
	});

	return {
		body,
		contentType: format.mime_type.split(';')[0] || 'video/mp4',
		contentLength,
		range
	};
}
