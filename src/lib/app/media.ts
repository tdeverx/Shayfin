import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
import { itemImageUrl } from '$lib/jellyfin';
import type { MediaCardModel, SpotlightModel } from './models';

function itemKind(item: BaseItemDto): MediaCardModel['kind'] {
	if (item.Type === 'Episode') return 'episode';
	if (item.Type === 'Series') return 'series';
	return 'movie';
}

export function itemHref(item: BaseItemDto): string {
	return item.Id ? `/item/${encodeURIComponent(item.Id)}` : '/home';
}

export function itemProgress(item: BaseItemDto): number | undefined {
	const position = item.UserData?.PlaybackPositionTicks;
	const runtime = item.RunTimeTicks;
	if (!position || !runtime || runtime <= 0) return undefined;
	return Math.min(100, Math.max(0, (position / runtime) * 100));
}

export function formatRuntime(ticks: number | null | undefined): string | undefined {
	if (!ticks) return undefined;
	const minutes = Math.round(ticks / 600_000_000);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function itemSecondary(item: BaseItemDto): string | undefined {
	if (item.Type === 'Episode') {
		const season = item.ParentIndexNumber == null ? undefined : `S${item.ParentIndexNumber}`;
		const episode = item.IndexNumber == null ? undefined : `E${item.IndexNumber}`;
		return [item.SeriesName, season && episode ? `${season}${episode}` : episode]
			.filter(Boolean)
			.join(' · ');
	}
	return item.ProductionYear ? String(item.ProductionYear) : undefined;
}

export function toMediaCard(
	api: Api,
	item: BaseItemDto,
	variant: 'portrait' | 'landscape' = 'landscape'
): MediaCardModel | null {
	if (!item.Id || /^0+$/.test(item.Id) || !item.Name) return null;
	const backdropTag = item.BackdropImageTags?.[0];
	const primaryTag = item.ImageTags?.Primary;
	const useBackdrop = variant === 'landscape' && backdropTag;
	const imageUrl = useBackdrop
		? itemImageUrl(api, item.Id, { type: 'Backdrop', tag: backdropTag, maxWidth: 720 })
		: primaryTag
			? itemImageUrl(api, item.Id, { type: 'Primary', tag: primaryTag, maxWidth: 480 })
			: backdropTag
				? itemImageUrl(api, item.Id, { type: 'Backdrop', tag: backdropTag, maxWidth: 720 })
				: undefined;

	return {
		id: item.Id,
		title: item.Name,
		kind: itemKind(item),
		href: itemHref(item),
		imageUrl,
		year: item.ProductionYear ?? undefined,
		secondary: itemSecondary(item),
		progress: itemProgress(item),
		providerIds: item.ProviderIds
			? Object.fromEntries(
					Object.entries(item.ProviderIds).filter(
						(entry): entry is [string, string] => typeof entry[1] === 'string'
					)
				)
			: undefined
	};
}

export function toSpotlight(api: Api, item: BaseItemDto): SpotlightModel | null {
	const card = toMediaCard(api, item, 'landscape');
	if (!card || !item.Id) return null;
	const backdropTag = item.BackdropImageTags?.[0];
	return {
		...card,
		backdropUrl: backdropTag
			? itemImageUrl(api, item.Id, { type: 'Backdrop', tag: backdropTag, maxWidth: 1600 })
			: card.imageUrl,
		overview: item.Overview ?? undefined,
		rating: item.OfficialRating ?? undefined,
		runtime: formatRuntime(item.RunTimeTicks)
	};
}

export function imageForItem(api: Api, item: BaseItemDto, width = 480): string | undefined {
	if (!item.Id) return undefined;
	const tag = item.ImageTags?.Primary;
	return tag ? itemImageUrl(api, item.Id, { type: 'Primary', tag, maxWidth: width }) : undefined;
}
