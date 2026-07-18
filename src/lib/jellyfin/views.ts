import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
import { getUserViewsApi } from '@jellyfin/sdk/lib/utils/api/user-views-api.js';
import type { CollapsedMediaView, SupportedMediaType } from './types.js';

const VIEW_DETAILS: Record<SupportedMediaType, Omit<CollapsedMediaView, 'libraryIds'>> = {
	movies: { type: 'movies', label: 'Movies', href: '/movies' },
	series: { type: 'series', label: 'Series', href: '/series' }
};

function supportedViewType(view: BaseItemDto): SupportedMediaType | undefined {
	if (view.CollectionType === 'movies') return 'movies';
	if (view.CollectionType === 'tvshows') return 'series';
	return undefined;
}

export function collapseUserViews(views: BaseItemDto[]): CollapsedMediaView[] {
	const libraryIds = new Map<SupportedMediaType, string[]>();

	for (const view of views) {
		const type = supportedViewType(view);
		if (!type || !view.Id) continue;
		const ids = libraryIds.get(type) ?? [];
		if (!ids.includes(view.Id)) ids.push(view.Id);
		libraryIds.set(type, ids);
	}

	return (['movies', 'series'] as const).flatMap((type) => {
		const ids = libraryIds.get(type);
		return ids?.length ? [{ ...VIEW_DETAILS[type], libraryIds: ids }] : [];
	});
}

export async function loadSupportedUserViews(
	api: Api,
	userId: string
): Promise<CollapsedMediaView[]> {
	const response = await getUserViewsApi(api).getUserViews({
		userId,
		includeExternalContent: false,
		includeHidden: false
	});
	return collapseUserViews(response.data.Items ?? []);
}
