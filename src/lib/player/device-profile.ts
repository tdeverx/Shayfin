import { utils as jellyfinUtils } from '@jellyfin/sdk';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { DirectPlayProfile } from '@jellyfin/sdk/lib/generated-client/models/direct-play-profile';
import type { CodecProfile } from '@jellyfin/sdk/lib/generated-client/models/codec-profile';
import type { PlaybackQuality } from '$lib/app/preferences';

const MAX_STREAMING_BITRATE = 120_000_000;

function browserSupports(video: HTMLVideoElement, mimeType: string): boolean {
	return video.canPlayType(mimeType) !== '';
}

function buildDirectPlayProfiles(video: HTMLVideoElement): DirectPlayProfile[] {
	const profiles: DirectPlayProfile[] = [];
	const mp4AudioCodecs = ['aac', 'mp3'];

	if (browserSupports(video, 'audio/mp4; codecs="ac-3"')) mp4AudioCodecs.push('ac3');
	if (browserSupports(video, 'audio/mp4; codecs="ec-3"')) mp4AudioCodecs.push('eac3');

	if (browserSupports(video, 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) {
		profiles.push({
			Container: 'mp4,m4v',
			Type: 'Video',
			VideoCodec: 'h264',
			AudioCodec: mp4AudioCodecs.join(',')
		});
	}

	if (
		browserSupports(video, 'video/mp4; codecs="hvc1.1.6.L93.B0"') ||
		browserSupports(video, 'video/mp4; codecs="hev1.1.6.L93.B0"')
	) {
		profiles.push({
			Container: 'mp4,m4v',
			Type: 'Video',
			VideoCodec: 'hevc',
			AudioCodec: mp4AudioCodecs.join(',')
		});
	}

	const webmVideoCodecs = [
		['vp8', 'video/webm; codecs="vp8, vorbis"'],
		['vp9', 'video/webm; codecs="vp09.00.10.08, opus"'],
		['av1', 'video/webm; codecs="av01.0.04M.08, opus"']
	]
		.filter(([, mimeType]) => browserSupports(video, mimeType))
		.map(([codec]) => codec);

	if (webmVideoCodecs.length) {
		profiles.push({
			Container: 'webm',
			Type: 'Video',
			VideoCodec: webmVideoCodecs.join(','),
			AudioCodec: 'opus,vorbis'
		});
	}

	return profiles;
}

/**
 * Builds the browser capability contract Jellyfin uses to choose direct play,
 * remuxing, or an HLS transcode. Subtitle support comes from the official SDK;
 * codec/container support is detected against the actual mounted video element.
 */
export function qualityBitrate(quality?: PlaybackQuality): number {
	return (
		(quality?.maxBitrateMbps === 'auto' || quality?.maxBitrateMbps === undefined
			? 120
			: quality.maxBitrateMbps) * 1_000_000
	);
}

export function qualityCodecProfiles(quality?: PlaybackQuality): CodecProfile[] {
	if (!quality || quality.maxResolution === 'auto') return [];
	const height = quality.maxResolution;
	const width = Math.round((height * 16) / 9);
	return [
		{
			Type: 'Video',
			Conditions: [
				{ Condition: 'LessThanEqual', Property: 'Width', Value: String(width), IsRequired: true },
				{ Condition: 'LessThanEqual', Property: 'Height', Value: String(height), IsRequired: true }
			]
		}
	];
}

export function createBrowserDeviceProfile(
	video: HTMLVideoElement,
	quality?: PlaybackQuality
): DeviceProfile {
	const sdkProfile = jellyfinUtils.getBrowserDeviceProfile({ ssaExternal: false }, video);
	const maxBitrate = qualityBitrate(quality);

	return {
		...sdkProfile,
		Name: 'Shayfin Browser',
		MaxStreamingBitrate: maxBitrate || MAX_STREAMING_BITRATE,
		MaxStaticBitrate: maxBitrate || MAX_STREAMING_BITRATE,
		DirectPlayProfiles: buildDirectPlayProfiles(video),
		TranscodingProfiles: [
			{
				Container: 'ts',
				Type: 'Video',
				Protocol: 'hls',
				Context: 'Streaming',
				VideoCodec: 'h264',
				// HLS.js/MSE support is narrower than canPlayType() on several browsers.
				// Keep transcode output conservative; direct play still advertises detected codecs above.
				AudioCodec: 'aac,mp3',
				MaxAudioChannels: '2',
				MinSegments: 1,
				BreakOnNonKeyFrames: true,
				EnableSubtitlesInManifest: true
			}
		],
		ContainerProfiles: [],
		CodecProfiles: qualityCodecProfiles(quality)
	};
}
