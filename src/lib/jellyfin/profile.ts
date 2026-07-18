import type { Api } from '@jellyfin/sdk';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind.js';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields.js';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by.js';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order.js';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api.js';
import { loadFavorites } from './home.js';
import type { ProfileMedia } from './types.js';

export async function loadRecentlyPlayed(api: Api, userId: string, limit = 24) {
	const response = await getItemsApi(api).getItems({
		userId,
		limit,
		recursive: true,
		includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Episode],
		isPlayed: true,
		sortBy: [ItemSortBy.DatePlayed],
		sortOrder: [SortOrder.Descending],
		fields: [ItemFields.ProviderIds, ItemFields.ParentId],
		enableUserData: true,
		enableImages: true,
		imageTypeLimit: 2
	});
	return response.data.Items ?? [];
}

export async function loadProfileMedia(api: Api, userId: string): Promise<ProfileMedia> {
	const [recentlyPlayed, favorites] = await Promise.all([
		loadRecentlyPlayed(api, userId),
		loadFavorites(api, userId)
	]);
	return { recentlyPlayed, favorites };
}
