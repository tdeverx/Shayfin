export type CapabilityStatus = 'available' | 'unavailable' | 'misconfigured' | 'degraded';

export interface CapabilityState {
	status: CapabilityStatus;
	message?: string;
}

export type SupportedMediaType = 'movie' | 'tv';

export interface UnifiedSearchResult {
	source: 'seerr';
	id: string;
	mediaType: SupportedMediaType;
	title: string;
	overview?: string;
	posterPath?: string;
	backdropPath?: string;
	providerIds: {
		tmdbId: number;
		tvdbId?: number;
	};
	availability: 'unknown' | 'pending' | 'processing' | 'partial' | 'available';
	requestStatus?: 'pending' | 'approved' | 'declined' | 'failed' | 'completed';
	requested: boolean;
}

export type DownloadState =
	'queued' | 'downloading' | 'importing' | 'completed' | 'warning' | 'failed';

export interface DownloadProgress {
	id: string;
	service: 'sonarr' | 'radarr';
	instanceId: string;
	instanceLabel: string;
	mediaType: 'series' | 'movie';
	title: string;
	providerIds: {
		tmdbId?: number;
		tvdbId?: number;
	};
	progress: number;
	eta?: string;
	state: DownloadState;
	message?: string;
}

export interface HomeSectionModel {
	id: string;
	title: string;
	variant: 'poster' | 'backdrop' | 'compact' | 'hero';
	order: number;
	items: unknown[];
}

export interface ProfileSnapshot {
	userId: string;
	activity: unknown[];
	requests: NormalizedMediaRequest[];
	achievements?: unknown;
	avatarAvailable: boolean;
}

export interface NormalizedMediaRequest {
	id: number;
	mediaType: SupportedMediaType;
	providerIds: {
		tmdbId: number;
		tvdbId?: number;
	};
	status: 'pending' | 'approved' | 'declined' | 'failed' | 'completed';
	is4k: boolean;
	seasons: number[];
	createdAt?: string;
	updatedAt?: string;
}

export interface JellyfinServerIdentity {
	id: string;
	name: string;
	version?: string;
}

export interface BootstrapResponse {
	configured: boolean;
	version: string;
	jellyfin?: {
		publicUrl: string;
		server: JellyfinServerIdentity;
	};
	plugins?: {
		homeScreenSections: { enabled: boolean };
		mediaBarEnhanced: { enabled: boolean };
		achievementBadges: { enabled: boolean; unlockNotifications: boolean };
		getAvatar: { enabled: boolean };
	};
}
