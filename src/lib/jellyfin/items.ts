import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields.js';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by.js';
import { getTvShowsApi } from '@jellyfin/sdk/lib/utils/api/tv-shows-api.js';
import { getUserLibraryApi } from '@jellyfin/sdk/lib/utils/api/user-library-api.js';
import type { SeriesDetail } from './types.js';

const DETAIL_FIELDS = [
	ItemFields.Chapters,
	ItemFields.Genres,
	ItemFields.MediaSources,
	ItemFields.MediaStreams,
	ItemFields.Overview,
	ItemFields.People,
	ItemFields.ProviderIds,
	ItemFields.Taglines
];

export async function loadItemDetail(
	api: Api,
	userId: string,
	itemId: string
): Promise<BaseItemDto> {
	const response = await getUserLibraryApi(api).getItem({ itemId, userId });
	return response.data;
}

export async function loadSeasons(
	api: Api,
	userId: string,
	seriesId: string
): Promise<BaseItemDto[]> {
	const response = await getTvShowsApi(api).getSeasons({
		seriesId,
		userId,
		fields: DETAIL_FIELDS,
		enableUserData: true,
		enableImages: true,
		imageTypeLimit: 2
	});
	return response.data.Items ?? [];
}

export async function loadEpisodes(
	api: Api,
	userId: string,
	seriesId: string,
	seasonId?: string
): Promise<BaseItemDto[]> {
	const response = await getTvShowsApi(api).getEpisodes({
		seriesId,
		userId,
		seasonId,
		fields: DETAIL_FIELDS,
		enableUserData: true,
		enableImages: true,
		imageTypeLimit: 2,
		sortBy: ItemSortBy.AiredEpisodeOrder
	});
	return response.data.Items ?? [];
}

export function nextEpisodeId(episodes: BaseItemDto[], currentId: string): string | null {
	const currentIndex = episodes.findIndex((episode) => episode.Id === currentId);
	return currentIndex >= 0 ? (episodes[currentIndex + 1]?.Id ?? null) : null;
}

export async function loadSeriesDetail(
	api: Api,
	userId: string,
	seriesId: string
): Promise<SeriesDetail> {
	const [item, seasons] = await Promise.all([
		loadItemDetail(api, userId, seriesId),
		loadSeasons(api, userId, seriesId)
	]);
	const episodeLists = await Promise.all(
		seasons.map(async (season) => ({
			seasonId: season.Id,
			episodes: season.Id ? await loadEpisodes(api, userId, seriesId, season.Id) : []
		}))
	);

	return {
		item,
		seasons,
		episodesBySeason: Object.fromEntries(
			episodeLists.flatMap(({ seasonId, episodes }) => (seasonId ? [[seasonId, episodes]] : []))
		)
	};
}
