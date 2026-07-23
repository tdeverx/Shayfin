export type MediaKind = 'movie' | 'series' | 'episode';

export interface AppUser {
	id: string;
	name: string;
	isAdministrator: boolean;
	imageUrl?: string;
}

export interface MediaNavigationItem {
	id: 'home' | 'movies' | 'series';
	label: string;
	href: string;
}

export interface MediaCardModel {
	id: string;
	title: string;
	kind: MediaKind;
	href: string;
	imageUrl?: string;
	backdropUrl?: string;
	year?: number;
	secondary?: string;
	progress?: number;
	providerIds?: Record<string, string>;
}

export interface SpotlightModel extends MediaCardModel {
	logoUrl?: string;
	tagline?: string;
	overview?: string;
	rating?: string;
	runtime?: string;
}

export interface MediaSectionModel {
	id: string;
	title: string;
	items: MediaCardModel[];
	variant?: 'landscape' | 'portrait' | 'collection';
	href?: string;
	backdropUrl?: string;
	displayTitleText?: boolean;
	showDetailsMenu?: boolean;
}

export interface DownloadModel {
	id: string;
	title: string;
	service: 'sonarr' | 'radarr';
	progress?: number;
	eta?: string;
	state: string;
	imageUrl?: string;
}

export interface UnifiedSearchItem {
	id: string;
	source: 'jellyfin' | 'seerr';
	title: string;
	kind: MediaKind;
	year?: number;
	imageUrl?: string;
	overview?: string;
	secondary?: string;
	href?: string;
	requestStatus?: string;
	tmdbId?: number;
}
