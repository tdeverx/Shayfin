import type { Api } from '@jellyfin/sdk';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind.js';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields.js';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by.js';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order.js';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api.js';
import { getTvShowsApi } from '@jellyfin/sdk/lib/utils/api/tv-shows-api.js';
import type { DefaultHomeData, HomeSectionModel } from './types.js';

const HOME_FIELDS = [
	ItemFields.Overview,
	ItemFields.ProviderIds,
	ItemFields.PrimaryImageAspectRatio,
	ItemFields.DateCreated
];
const VIDEO_TYPES = [BaseItemKind.Movie, BaseItemKind.Series, BaseItemKind.Episode];

function items(response: PromiseSettledResult<BaseItemDto[]>): BaseItemDto[] {
	return response.status === 'fulfilled' ? response.value : [];
}

export function mapDefaultHomeSections(data: DefaultHomeData): HomeSectionModel[] {
	const sections: HomeSectionModel[] = [
		{
			id: 'spotlight',
			title: 'Featured',
			variant: 'spotlight',
			order: 0,
			items: data.spotlight
		},
		{
			id: 'resume',
			title: 'Continue watching',
			variant: 'landscape',
			order: 10,
			items: data.resume
		},
		{
			id: 'next-up',
			title: 'Next up',
			variant: 'landscape',
			order: 20,
			items: data.nextUp
		},
		{
			id: 'latest',
			title: 'Recently added',
			variant: 'portrait',
			order: 30,
			items: data.latest
		},
		{
			id: 'favorites',
			title: 'Favorites',
			variant: 'portrait',
			order: 40,
			items: data.favorites
		}
	];
	return sections.filter((section) => section.items.length > 0);
}

export function selectFallbackHeroSection(
	sections: HomeSectionModel[]
): HomeSectionModel | undefined {
	return sections.find((section) => {
		if (!section.items.length) return false;
		const identity = `${section.id} ${section.title}`.toLowerCase();
		return !/(continue|next[\s-]?up|resume|watching|download)/.test(identity);
	});
}

export async function loadSpotlight(api: Api, userId: string, limit = 6): Promise<BaseItemDto[]> {
	const response = await getItemsApi(api).getItems({
		userId,
		limit,
		recursive: true,
		includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Series],
		sortBy: [ItemSortBy.Random],
		fields: HOME_FIELDS,
		enableUserData: true,
		enableImages: true,
		enableImageTypes: ['Primary', 'Backdrop', 'Logo'],
		imageTypeLimit: 2
	});
	return response.data.Items ?? [];
}

export async function loadResumeItems(
	api: Api,
	userId: string,
	limit = 18
): Promise<BaseItemDto[]> {
	const response = await getItemsApi(api).getResumeItems({
		userId,
		limit,
		fields: HOME_FIELDS,
		mediaTypes: ['Video'],
		includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Episode],
		enableUserData: true,
		enableImages: true,
		imageTypeLimit: 2,
		excludeActiveSessions: false
	});
	return response.data.Items ?? [];
}

export async function loadNextUp(api: Api, userId: string, limit = 18): Promise<BaseItemDto[]> {
	const response = await getTvShowsApi(api).getNextUp({
		userId,
		limit,
		fields: HOME_FIELDS,
		enableUserData: true,
		enableImages: true,
		imageTypeLimit: 2,
		disableFirstEpisode: false,
		enableResumable: true
	});
	return response.data.Items ?? [];
}

export async function loadLatest(api: Api, userId: string, limit = 24): Promise<BaseItemDto[]> {
	const response = await getItemsApi(api).getItems({
		userId,
		limit,
		recursive: true,
		includeItemTypes: VIDEO_TYPES,
		sortBy: [ItemSortBy.DateCreated],
		sortOrder: [SortOrder.Descending],
		fields: HOME_FIELDS,
		enableUserData: true,
		enableImages: true,
		imageTypeLimit: 2
	});
	return response.data.Items ?? [];
}

export async function loadFavorites(api: Api, userId: string, limit = 24): Promise<BaseItemDto[]> {
	const response = await getItemsApi(api).getItems({
		userId,
		limit,
		recursive: true,
		includeItemTypes: VIDEO_TYPES,
		isFavorite: true,
		sortBy: [ItemSortBy.SortName],
		sortOrder: [SortOrder.Ascending],
		fields: HOME_FIELDS,
		enableUserData: true,
		enableImages: true,
		imageTypeLimit: 2
	});
	return response.data.Items ?? [];
}

export async function loadDefaultHome(api: Api, userId: string): Promise<HomeSectionModel[]> {
	const results = await Promise.allSettled([
		loadSpotlight(api, userId),
		loadResumeItems(api, userId),
		loadNextUp(api, userId),
		loadLatest(api, userId),
		loadFavorites(api, userId)
	]);

	return mapDefaultHomeSections({
		spotlight: items(results[0]),
		resume: items(results[1]),
		nextUp: items(results[2]),
		latest: items(results[3]),
		favorites: items(results[4])
	});
}
