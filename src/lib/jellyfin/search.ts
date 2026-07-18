import type { Api } from '@jellyfin/sdk';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind.js';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields.js';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api.js';
import type { LocalSearchResult, ProviderIdentifiable, ProviderIds } from './types.js';

function providerValue(
	providerIds: BaseItemDto['ProviderIds'],
	name: 'tmdb' | 'tvdb' | 'imdb'
): string | undefined {
	if (!providerIds) return undefined;
	const entry = Object.entries(providerIds).find(([key]) => key.toLowerCase() === name);
	const value = entry?.[1]?.trim();
	return value || undefined;
}

export function normalizeProviderIds(providerIds: BaseItemDto['ProviderIds']): ProviderIds {
	return {
		tmdb: providerValue(providerIds, 'tmdb'),
		tvdb: providerValue(providerIds, 'tvdb'),
		imdb: providerValue(providerIds, 'imdb')
	};
}

function supportedResultType(item: BaseItemDto): LocalSearchResult['mediaType'] | undefined {
	if (item.Type === 'Movie') return 'movie';
	if (item.Type === 'Series') return 'series';
	if (item.Type === 'Episode') return 'episode';
	return undefined;
}

export function normalizeLocalSearchItem(item: BaseItemDto): LocalSearchResult | null {
	const mediaType = supportedResultType(item);
	if (!item.Id || !item.Name || !mediaType) return null;

	let subtitle: string | undefined;
	if (mediaType === 'episode') {
		const episode = item.IndexNumber == null ? undefined : `E${item.IndexNumber}`;
		const season = item.ParentIndexNumber == null ? undefined : `S${item.ParentIndexNumber}`;
		subtitle = [item.SeriesName, season && episode ? `${season}${episode}` : episode]
			.filter(Boolean)
			.join(' · ');
	}

	return {
		source: 'jellyfin',
		id: item.Id,
		name: item.Name,
		mediaType,
		year: item.ProductionYear ?? undefined,
		subtitle: subtitle || undefined,
		imageTag: item.ImageTags?.Primary ?? undefined,
		providerIds: normalizeProviderIds(item.ProviderIds),
		item
	};
}

export function normalizeLocalSearch(items: BaseItemDto[]): LocalSearchResult[] {
	return items.flatMap((item) => {
		const normalized = normalizeLocalSearchItem(item);
		return normalized ? [normalized] : [];
	});
}

export function providerIdentityKeys(value: ProviderIdentifiable): string[] {
	return (Object.entries(value.providerIds) as Array<[keyof ProviderIds, string | undefined]>)
		.filter((entry): entry is [keyof ProviderIds, string] => Boolean(entry[1]))
		.map(([provider, id]) => `${value.mediaType}:${provider}:${id.toLowerCase()}`);
}

export function dedupeAgainstLocal<T extends ProviderIdentifiable>(
	local: ProviderIdentifiable[],
	discover: T[]
): T[] {
	const localKeys = new Set(local.flatMap(providerIdentityKeys));
	return discover.filter(
		(result) => !providerIdentityKeys(result).some((key) => localKeys.has(key))
	);
}

export async function searchLocalMedia(
	api: Api,
	userId: string,
	query: string,
	options: { limit?: number; signal?: AbortSignal } = {}
): Promise<LocalSearchResult[]> {
	const searchTerm = query.trim();
	if (!searchTerm) return [];

	const response = await getItemsApi(api).getItems(
		{
			userId,
			searchTerm,
			limit: Math.min(Math.max(options.limit ?? 24, 1), 100),
			recursive: true,
			includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Series, BaseItemKind.Episode],
			fields: [ItemFields.ProviderIds, ItemFields.ParentId],
			enableUserData: true,
			enableImages: true,
			imageTypeLimit: 1
		},
		options.signal ? { signal: options.signal } : undefined
	);

	return normalizeLocalSearch(response.data.Items ?? []);
}
