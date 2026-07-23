import { browser } from '$app/environment';

export const RESOLUTION_OPTIONS = ['auto', 2160, 1440, 1080, 720, 480] as const;
export const BITRATE_OPTIONS = ['auto', 120, 80, 40, 20, 10, 5] as const;

export type PlaybackResolution = (typeof RESOLUTION_OPTIONS)[number];
export type PlaybackBitrate = (typeof BITRATE_OPTIONS)[number];

export interface PlaybackQuality {
	maxResolution: PlaybackResolution;
	maxBitrateMbps: PlaybackBitrate;
}

export interface BrowserPreferencesV1 {
	version: 1;
	playback: {
		quality: PlaybackQuality;
		autoplayNext: boolean;
	};
	experience: {
		themeAudio: boolean;
	};
}

export const DEFAULT_BROWSER_PREFERENCES: BrowserPreferencesV1 = {
	version: 1,
	playback: {
		quality: { maxResolution: 'auto', maxBitrateMbps: 'auto' },
		autoplayNext: true
	},
	experience: { themeAudio: true }
};

export function preferencesKey(serverId: string, userId: string): string {
	return `shayfin.preferences.v1:${serverId}:${userId}`;
}

function isResolution(value: unknown): value is PlaybackResolution {
	return RESOLUTION_OPTIONS.some((option) => option === value);
}

function isBitrate(value: unknown): value is PlaybackBitrate {
	return BITRATE_OPTIONS.some((option) => option === value);
}

export function decodeBrowserPreferences(value: unknown): BrowserPreferencesV1 {
	if (!value || typeof value !== 'object') return structuredClone(DEFAULT_BROWSER_PREFERENCES);
	const record = value as Record<string, unknown>;
	const playback = (record.playback ?? {}) as Record<string, unknown>;
	const quality = (playback.quality ?? {}) as Record<string, unknown>;
	const experience = (record.experience ?? {}) as Record<string, unknown>;
	return {
		version: 1,
		playback: {
			quality: {
				maxResolution: isResolution(quality.maxResolution) ? quality.maxResolution : 'auto',
				maxBitrateMbps: isBitrate(quality.maxBitrateMbps) ? quality.maxBitrateMbps : 'auto'
			},
			autoplayNext: typeof playback.autoplayNext === 'boolean' ? playback.autoplayNext : true
		},
		experience: {
			themeAudio: typeof experience.themeAudio === 'boolean' ? experience.themeAudio : true
		}
	};
}

export function loadBrowserPreferences(
	serverId: string,
	userId: string,
	legacyThemeAudio?: string | null
): BrowserPreferencesV1 {
	if (!browser) return structuredClone(DEFAULT_BROWSER_PREFERENCES);
	const key = preferencesKey(serverId, userId);
	const stored = localStorage.getItem(key);
	if (stored) {
		try {
			return decodeBrowserPreferences(JSON.parse(stored));
		} catch {
			// Corrupt local preferences fall back safely and are repaired on the next write.
		}
	}
	const migrated = structuredClone(DEFAULT_BROWSER_PREFERENCES);
	if (legacyThemeAudio !== null && legacyThemeAudio !== undefined) {
		migrated.experience.themeAudio = legacyThemeAudio !== 'false';
	}
	return migrated;
}

export function saveBrowserPreferences(
	serverId: string,
	userId: string,
	preferences: BrowserPreferencesV1
): void {
	if (!browser) return;
	localStorage.setItem(preferencesKey(serverId, userId), JSON.stringify(preferences));
}
