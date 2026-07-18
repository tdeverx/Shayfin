import type { Api } from '@jellyfin/sdk';
import type {
	BaseItemDto,
	MediaSegmentDto,
	UserDto
} from '@jellyfin/sdk/lib/generated-client/models/index.js';

export type SupportedMediaType = 'movies' | 'series';

export interface JellyfinSession {
	serverId: string;
	serverUrl: string;
	userId: string;
	accessToken: string;
	deviceId: string;
}

export interface JellyfinConnection {
	api: Api;
	session: JellyfinSession;
	user: UserDto;
}

export type RestoredJellyfinConnection = Omit<JellyfinConnection, 'user'>;

export interface CollapsedMediaView {
	type: SupportedMediaType;
	label: string;
	href: '/movies' | '/series';
	libraryIds: string[];
}

export interface ProviderIds {
	tmdb?: string;
	tvdb?: string;
	imdb?: string;
}

export interface LocalSearchResult {
	source: 'jellyfin';
	id: string;
	name: string;
	mediaType: 'movie' | 'series' | 'episode';
	year?: number;
	subtitle?: string;
	imageTag?: string;
	providerIds: ProviderIds;
	item: BaseItemDto;
}

export interface ProviderIdentifiable {
	mediaType: 'movie' | 'series' | 'episode';
	providerIds: ProviderIds;
}

export type HomeSectionVariant = 'spotlight' | 'portrait' | 'landscape' | 'collection';

export interface HomeSectionModel {
	id: 'spotlight' | 'resume' | 'next-up' | 'latest' | 'favorites' | string;
	title: string;
	variant: HomeSectionVariant;
	order: number;
	items: BaseItemDto[];
	additionalData?: string;
	displayTitleText?: boolean;
	showDetailsMenu?: boolean;
}

export interface DefaultHomeData {
	spotlight: BaseItemDto[];
	resume: BaseItemDto[];
	nextUp: BaseItemDto[];
	latest: BaseItemDto[];
	favorites: BaseItemDto[];
}

export interface SeriesDetail {
	item: BaseItemDto;
	seasons: BaseItemDto[];
	episodesBySeason: Record<string, BaseItemDto[]>;
}

export interface ThemeSong {
	item: BaseItemDto;
	streamUrl: string;
}

export interface MediaSegment extends MediaSegmentDto {
	startSeconds: number;
	endSeconds: number;
}

export type CapabilityStatus = 'available' | 'unavailable' | 'misconfigured' | 'degraded';

export interface CapabilityState<T> {
	status: CapabilityStatus;
	data?: T;
	message?: string;
	statusCode?: number;
}

export interface ProfileMedia {
	recentlyPlayed: BaseItemDto[];
	favorites: BaseItemDto[];
}
