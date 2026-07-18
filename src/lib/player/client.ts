import { normalizeServerUrl, resolveServerUrl, SUPPORTED_MEDIA_SEGMENT_TYPES } from './playback.js';
import type {
	PlaybackProgressPayload,
	PlaybackStopPayload,
	PlayerMediaSegment,
	PlayerMediaSegmentResult,
	PlayerPlaybackInfoRequest,
	PlayerPlaybackInfoResponse
} from './types.js';

const CLIENT_NAME = 'Shayfin';
const CLIENT_VERSION = '0.0.1';

function headerValue(value: string): string {
	return value.replace(/["\\\r\n]/g, '');
}

export class JellyfinPlaybackClient {
	readonly serverUrl: string;
	readonly accessToken: string;
	readonly deviceId: string;
	readonly fetchImplementation: typeof fetch;

	constructor(
		serverUrl: string,
		accessToken: string,
		deviceId: string,
		fetchImplementation: typeof fetch = fetch
	) {
		this.serverUrl = normalizeServerUrl(serverUrl);
		this.accessToken = accessToken;
		this.deviceId = deviceId;
		this.fetchImplementation = fetchImplementation;
	}

	private get authorizationHeader(): string {
		return [
			`MediaBrowser Client="${CLIENT_NAME}"`,
			'Device="Web Browser"',
			`DeviceId="${headerValue(this.deviceId)}"`,
			`Version="${CLIENT_VERSION}"`,
			`Token="${headerValue(this.accessToken)}"`
		].join(', ');
	}

	private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const headers = new Headers(init.headers);
		headers.set('Authorization', this.authorizationHeader);
		headers.set('X-Emby-Token', this.accessToken);
		if (init.body !== undefined && !headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}

		const response = await this.fetchImplementation(resolveServerUrl(this.serverUrl, path), {
			...init,
			headers
		});
		if (!response.ok) {
			throw new Error(`Jellyfin request failed (${response.status} ${response.statusText}).`);
		}

		if (response.status === 204 || response.headers.get('content-length') === '0') {
			return undefined as T;
		}
		return (await response.json()) as T;
	}

	async getPlaybackInfo(
		itemId: string,
		request: PlayerPlaybackInfoRequest
	): Promise<PlayerPlaybackInfoResponse> {
		const query = new URLSearchParams({ userId: request.userId });
		const body = {
			UserId: request.userId,
			StartTimeTicks: request.startTimeTicks,
			AudioStreamIndex: request.audioStreamIndex ?? null,
			SubtitleStreamIndex: request.subtitleStreamIndex ?? null,
			MediaSourceId: request.mediaSourceId ?? null,
			DeviceProfile: request.deviceProfile,
			EnableDirectPlay: true,
			EnableDirectStream: true,
			EnableTranscoding: true,
			AllowVideoStreamCopy: true,
			AllowAudioStreamCopy: true,
			AutoOpenLiveStream: true,
			AlwaysBurnInSubtitleWhenTranscoding: true
		};

		return this.request<PlayerPlaybackInfoResponse>(
			`Items/${encodeURIComponent(itemId)}/PlaybackInfo?${query}`,
			{
				method: 'POST',
				body: JSON.stringify(body),
				signal: request.signal
			}
		);
	}

	async getMediaSegments(itemId: string, signal?: AbortSignal): Promise<PlayerMediaSegment[]> {
		const query = new URLSearchParams();
		for (const segmentType of SUPPORTED_MEDIA_SEGMENT_TYPES) {
			query.append('includeSegmentTypes', segmentType);
		}

		try {
			const result = await this.request<PlayerMediaSegmentResult>(
				`MediaSegments/${encodeURIComponent(itemId)}?${query}`,
				{ signal }
			);
			return result.Items ?? [];
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') throw error;
			return [];
		}
	}

	reportPlaybackStart(payload: PlaybackProgressPayload, signal?: AbortSignal): Promise<void> {
		return this.request<void>('Sessions/Playing', {
			method: 'POST',
			body: JSON.stringify(payload),
			signal
		});
	}

	reportPlaybackProgress(payload: PlaybackProgressPayload, signal?: AbortSignal): Promise<void> {
		return this.request<void>('Sessions/Playing/Progress', {
			method: 'POST',
			body: JSON.stringify(payload),
			signal
		});
	}

	reportPlaybackStopped(payload: PlaybackStopPayload, keepalive = false): Promise<void> {
		return this.request<void>('Sessions/Playing/Stopped', {
			method: 'POST',
			body: JSON.stringify(payload),
			keepalive
		});
	}
}
