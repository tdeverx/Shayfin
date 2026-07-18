import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
import {
	PluginHttpClient,
	arrayProperty,
	asRecord,
	booleanProperty,
	numberProperty,
	stringProperty,
	type FetchLike
} from '../capabilities.js';
import type { CapabilityState } from '../types.js';

export interface MediaBarEnhancedConfig {
	isEnabled: boolean;
	enableCustomMediaIds: boolean;
	customMediaIds: string;
	enableSeasonalContent: boolean;
	seasonalSections: string;
	includeWatchedContent: boolean;
	sortBy: string;
	sortOrder: string;
	maxItems: number;
	maxMovies: number;
	maxTvShows: number;
	applyLimitsToCustomIds: boolean;
	preferLocalTrailers: boolean;
	onlyLocalTrailers: boolean;
	shuffleInterval: number;
}

export interface ParsedMediaBarSelection {
	ids: string[];
	genres: string[];
	tags: string[];
	trailerOverrides: Record<string, string>;
}

export interface MediaBarHeroData {
	items: BaseItemDto[];
	trailerOverrides: Record<string, string>;
	preferLocalTrailers: boolean;
	onlyLocalTrailers: boolean;
	intervalMs: number;
}

interface SeasonalSection {
	Name?: string;
	StartDay?: number | string;
	StartMonth?: number | string;
	EndDay?: number | string;
	EndMonth?: number | string;
	MediaIds?: string;
}

function decodeConfig(value: unknown): MediaBarEnhancedConfig {
	const record = asRecord(value);
	return {
		isEnabled: booleanProperty(record, 'IsEnabled', 'isEnabled') ?? true,
		enableCustomMediaIds:
			booleanProperty(record, 'EnableCustomMediaIds', 'enableCustomMediaIds') ?? true,
		customMediaIds: stringProperty(record, 'CustomMediaIds', 'customMediaIds') ?? '',
		enableSeasonalContent:
			booleanProperty(record, 'EnableSeasonalContent', 'enableSeasonalContent') ?? false,
		seasonalSections: stringProperty(record, 'SeasonalSections', 'seasonalSections') ?? '[]',
		includeWatchedContent:
			booleanProperty(record, 'IncludeWatchedContent', 'includeWatchedContent') ?? false,
		sortBy: stringProperty(record, 'SortBy', 'sortBy') ?? 'Random',
		sortOrder: stringProperty(record, 'SortOrder', 'sortOrder') ?? 'Ascending',
		maxItems: numberProperty(record, 'MaxItems', 'maxItems') ?? 20,
		maxMovies: numberProperty(record, 'MaxMovies', 'maxMovies') ?? 20,
		maxTvShows: numberProperty(record, 'MaxTvShows', 'maxTvShows') ?? 20,
		applyLimitsToCustomIds:
			booleanProperty(record, 'ApplyLimitsToCustomIds', 'applyLimitsToCustomIds') ?? false,
		preferLocalTrailers:
			booleanProperty(record, 'PreferLocalTrailers', 'preferLocalTrailers') ?? false,
		onlyLocalTrailers: booleanProperty(record, 'OnlyLocalTrailers', 'onlyLocalTrailers') ?? false,
		shuffleInterval: numberProperty(record, 'ShuffleInterval', 'shuffleInterval') ?? 7000
	};
}

function decodeItems(value: unknown): BaseItemDto[] {
	return arrayProperty(asRecord(value), 'Items', 'items') as BaseItemDto[];
}

export function parseMediaBarSelection(value: string): ParsedMediaBarSelection {
	const parsed: ParsedMediaBarSelection = { ids: [], genres: [], tags: [], trailerOverrides: {} };
	for (const source of value
		.split(/[\n,]/)
		.map((line) => line.trim())
		.filter(Boolean)) {
		const genre = source.match(/^genre:\s*(.+)$/i);
		if (genre) {
			parsed.genres.push(genre[1].trim());
			continue;
		}
		const tag = source.match(/^tag:\s*(.+)$/i);
		if (tag) {
			parsed.tags.push(tag[1].trim());
			continue;
		}
		const override = source.match(/\[(.+?)\]/)?.[1];
		const withoutOverride = source
			.replace(/\[.*?\]/, '')
			.split('|')[0]
			.trim();
		const id = withoutOverride.match(/[0-9a-f]{32}/i)?.[0] ?? withoutOverride;
		if (!id) continue;
		parsed.ids.push(id);
		if (override) parsed.trailerOverrides[id] = override;
	}
	return parsed;
}

function dateWithinSection(date: Date, section: SeasonalSection): boolean {
	const value = (month: unknown, day: unknown) => Number(month) * 100 + Number(day);
	const current = value(date.getMonth() + 1, date.getDate());
	const start = value(section.StartMonth, section.StartDay);
	const end = value(section.EndMonth, section.EndDay);
	if (!start || !end) return false;
	return start <= end ? current >= start && current <= end : current >= start || current <= end;
}

export function activeMediaBarSelection(config: MediaBarEnhancedConfig, date = new Date()): string {
	if (config.enableSeasonalContent) {
		try {
			const sections = JSON.parse(config.seasonalSections) as SeasonalSection[];
			const active = sections.find((section) => dateWithinSection(date, section));
			if (active?.MediaIds) return active.MediaIds;
		} catch {
			// A malformed optional seasonal configuration falls back to the default selection.
		}
	}
	return config.enableCustomMediaIds ? config.customMediaIds : '';
}

function supportedTypes(config: MediaBarEnhancedConfig): string {
	return [config.maxMovies > 0 ? 'Movie' : '', config.maxTvShows > 0 ? 'Series' : '']
		.filter(Boolean)
		.join(',');
}

export class MediaBarEnhancedAdapter {
	readonly client: PluginHttpClient;

	constructor(api: Api, fetchImpl?: FetchLike) {
		this.client = new PluginHttpClient(api, fetchImpl);
	}

	getConfig(): Promise<CapabilityState<MediaBarEnhancedConfig>> {
		return this.client.json('/MediaBarEnhanced/Config', { decode: decodeConfig });
	}

	private getItem(id: string, userId: string): Promise<CapabilityState<BaseItemDto>> {
		return this.client.json(
			`/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(id)}`,
			{
				query: { Fields: 'Overview,RemoteTrailers,LocalTrailerCount,Genres,MediaSources' },
				decode: (value) => value as BaseItemDto
			}
		);
	}

	private getItems(query: Record<string, string | number | boolean | undefined>) {
		return this.client.json('/Items', { query, decode: decodeItems });
	}

	private async resolveSelection(
		selection: ParsedMediaBarSelection,
		config: MediaBarEnhancedConfig,
		userId: string
	): Promise<BaseItemDto[]> {
		const types = supportedTypes(config);
		if (!types) return [];
		const items: BaseItemDto[] = [];
		for (const rawId of selection.ids) {
			let id = rawId;
			if (!/^[0-9a-f]{32}$/i.test(id)) {
				const found = await this.getItems({
					IncludeItemTypes: 'BoxSet,Playlist',
					Recursive: true,
					SearchTerm: id,
					Limit: 1,
					UserId: userId
				});
				id = found.data?.[0]?.Id ?? '';
			}
			if (!id) continue;
			const item = await this.getItem(id, userId);
			if (!item.data) continue;
			if (
				['BoxSet', 'Playlist', 'CollectionFolder', 'Folder', 'UserView'].includes(
					item.data.Type ?? ''
				)
			) {
				const children = await this.getItems({
					ParentId: id,
					Recursive: true,
					IncludeItemTypes: types,
					Fields: 'Overview,RemoteTrailers,LocalTrailerCount,Genres,MediaSources',
					UserId: userId
				});
				items.push(...(children.data ?? []));
			} else if (item.data.Type === 'Movie' || item.data.Type === 'Series') {
				items.push(item.data);
			}
		}

		if (selection.genres.length || selection.tags.length) {
			const filtered = await this.getItems({
				IncludeItemTypes: types,
				Recursive: true,
				HasOverview: true,
				Genres: selection.genres.join('|') || undefined,
				Tags: selection.tags.join('|') || undefined,
				SortBy: config.sortBy === 'Original' ? 'Random' : config.sortBy,
				SortOrder: config.sortOrder,
				IsPlayed: config.includeWatchedContent ? undefined : false,
				EnableUserData: true,
				Limit: config.maxItems,
				Fields: 'Overview,RemoteTrailers,LocalTrailerCount,Genres,MediaSources',
				UserId: userId
			});
			items.push(...(filtered.data ?? []));
		}

		const seen = new Set<string>();
		return items.filter(
			(item) => Boolean(item.Id) && !seen.has(item.Id!) && Boolean(seen.add(item.Id!))
		);
	}

	async loadHero(userId: string): Promise<CapabilityState<MediaBarHeroData>> {
		const configResult = await this.getConfig();
		const config = configResult.data;
		if (configResult.status !== 'available' || !config) {
			return {
				status: configResult.status,
				statusCode: configResult.statusCode,
				message: configResult.message
			};
		}
		if (!config.isEnabled)
			return { status: 'unavailable', message: 'Media Bar Enhanced is disabled' };

		const selection = parseMediaBarSelection(activeMediaBarSelection(config));
		let items = await this.resolveSelection(selection, config, userId);
		if (
			!items.length &&
			!selection.ids.length &&
			!selection.genres.length &&
			!selection.tags.length
		) {
			const result = await this.getItems({
				IncludeItemTypes: supportedTypes(config),
				Recursive: true,
				HasOverview: true,
				ImageTypes: 'Logo,Backdrop',
				SortBy: config.sortBy === 'Original' ? 'Random' : config.sortBy,
				SortOrder: config.sortOrder,
				IsPlayed: config.includeWatchedContent ? undefined : false,
				EnableUserData: true,
				Limit: config.maxItems,
				Fields: 'Overview,RemoteTrailers,LocalTrailerCount,Genres,MediaSources',
				UserId: userId
			});
			items = result.data ?? [];
		}

		return {
			status: 'available',
			data: {
				items,
				trailerOverrides: selection.trailerOverrides,
				preferLocalTrailers: config.preferLocalTrailers,
				onlyLocalTrailers: config.onlyLocalTrailers,
				intervalMs: Math.max(5000, config.shuffleInterval)
			}
		};
	}
}
