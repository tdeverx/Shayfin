import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { PlaybackQuality } from '$lib/app/preferences';

export type PlayMethod = 'DirectPlay' | 'DirectStream' | 'Transcode';

export type SupportedMediaSegmentType = 'Commercial' | 'Preview' | 'Recap' | 'Outro' | 'Intro';

export interface PlayerMediaStream {
	Codec?: string | null;
	Language?: string | null;
	Title?: string | null;
	DisplayTitle?: string | null;
	Type?: 'Audio' | 'Subtitle' | 'Video' | string;
	Index?: number;
	IsDefault?: boolean;
	IsForced?: boolean;
	IsExternal?: boolean;
	DeliveryMethod?: 'Encode' | 'Embed' | 'External' | 'Hls' | string;
	DeliveryUrl?: string | null;
}

export interface PlayerMediaSource {
	Id?: string | null;
	Name?: string | null;
	Container?: string | null;
	RunTimeTicks?: number | null;
	SupportsDirectPlay?: boolean;
	SupportsDirectStream?: boolean;
	SupportsTranscoding?: boolean;
	TranscodingUrl?: string | null;
	TranscodingSubProtocol?: 'http' | 'hls' | string;
	TranscodingContainer?: string | null;
	TranscodingReasons?: string[] | null;
	LiveStreamId?: string | null;
	DefaultAudioStreamIndex?: number | null;
	DefaultSubtitleStreamIndex?: number | null;
	MediaStreams?: PlayerMediaStream[] | null;
}

export interface PlayerPlaybackInfoResponse {
	MediaSources?: PlayerMediaSource[];
	PlaySessionId?: string | null;
	ErrorCode?: string;
}

export interface PlayerPlaybackInfoRequest {
	userId: string;
	startTimeTicks: number;
	deviceProfile: DeviceProfile;
	audioStreamIndex?: number | null;
	subtitleStreamIndex?: number | null;
	mediaSourceId?: string | null;
	signal?: AbortSignal;
}

export interface NextUpModel {
	id: string;
	title: string;
	secondary?: string;
	imageUrl?: string;
}

export interface PlayerPresentation {
	title: string;
	secondary?: string;
	backdropUrl?: string;
	posterUrl?: string;
	logoUrl?: string;
}

export interface PlayerMediaSegment {
	Id?: string;
	ItemId?: string;
	Type?: SupportedMediaSegmentType | 'Unknown' | string;
	StartTicks?: number;
	EndTicks?: number;
}

export interface PlayerMediaSegmentResult {
	Items?: PlayerMediaSegment[];
	TotalRecordCount?: number;
	StartIndex?: number;
}

export interface PlaybackRoute {
	url: string;
	playMethod: PlayMethod;
	isHls: boolean;
	mediaSource: PlayerMediaSource;
	playSessionId: string | null;
}

export interface PlaybackProgressInput {
	itemId: string;
	mediaSourceId: string | null;
	audioStreamIndex: number | null;
	subtitleStreamIndex: number | null;
	positionSeconds: number;
	paused: boolean;
	muted: boolean;
	volume: number;
	playMethod: PlayMethod;
	playSessionId: string | null;
	liveStreamId?: string | null;
	canSeek?: boolean;
}

export interface PlaybackProgressPayload {
	CanSeek: boolean;
	ItemId: string;
	MediaSourceId: string | null;
	AudioStreamIndex: number | null;
	SubtitleStreamIndex: number | null;
	IsPaused: boolean;
	IsMuted: boolean;
	PositionTicks: number;
	VolumeLevel: number;
	PlayMethod: PlayMethod;
	LiveStreamId: string | null;
	PlaySessionId: string | null;
	RepeatMode: 'RepeatNone';
}

export interface PlaybackStopPayload {
	ItemId: string;
	MediaSourceId: string | null;
	PositionTicks: number;
	LiveStreamId: string | null;
	PlaySessionId: string | null;
	Failed: boolean;
}

export interface SubtitleTrack {
	src: string;
	label: string;
	language: string;
}

export interface VideoPlayerProps {
	serverUrl: string;
	serverId?: string;
	accessToken: string;
	userId: string;
	itemId: string;
	deviceId: string;
	startTicks?: number | null;
	nextItemId?: string | null;
	nextUp?: NextUpModel | null;
	presentation?: PlayerPresentation;
	quality?: PlaybackQuality;
	autoplayNext?: boolean;
	onNext?: (nextItemId: string) => void | Promise<void>;
	onSaveDefaultQuality?: (quality: PlaybackQuality) => void;
	onExit?: () => void | Promise<void>;
	onThemeAudioStop?: () => void;
	class?: string;
}
