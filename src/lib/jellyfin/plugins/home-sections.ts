import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
import {
	PluginHttpClient,
	arrayProperty,
	asRecord,
	booleanProperty,
	numberProperty,
	property,
	stringProperty,
	type FetchLike
} from '../capabilities.js';
import type { CapabilityState, HomeSectionModel, HomeSectionVariant } from '../types.js';

export interface HomeScreenMetadata {
	enabled: boolean;
	allowUserOverride: boolean;
	paginationEnabled: boolean;
	resultsPerPage?: number;
}

export interface HomeScreenSectionDefinition {
	id: string;
	title: string;
	viewMode: 'portrait' | 'landscape' | 'square' | 'small';
	limit: number;
	order: number;
	additionalData?: string;
	displayTitleText: boolean;
	showDetailsMenu: boolean;
}

export interface HomeScreenUserSettings {
	userId: string;
	enabledSections: string[];
	lockedSections: string[];
	defaultEnabledSections: string[];
}

function decodeMetadata(value: unknown): HomeScreenMetadata {
	const record = asRecord(value);
	return {
		enabled: booleanProperty(record, 'Enabled', 'enabled') ?? false,
		allowUserOverride: booleanProperty(record, 'AllowUserOverride', 'allowUserOverride') ?? false,
		paginationEnabled: booleanProperty(record, 'PaginationEnabled', 'paginationEnabled') ?? false,
		resultsPerPage: numberProperty(record, 'NumResultsPerPage', 'numResultsPerPage')
	};
}

function viewMode(value: unknown): HomeScreenSectionDefinition['viewMode'] {
	const normalized = typeof value === 'string' ? value.toLowerCase() : '';
	if (normalized === 'portrait' || normalized === 'square' || normalized === 'small')
		return normalized;
	return 'landscape';
}

function decodeSection(value: unknown): HomeScreenSectionDefinition | null {
	const record = asRecord(value);
	const id = stringProperty(record, 'Section', 'section');
	if (!id) return null;
	return {
		id,
		title: stringProperty(record, 'DisplayText', 'displayText') || id,
		viewMode: viewMode(property(record, 'ViewMode', 'viewMode')),
		limit: numberProperty(record, 'Limit', 'limit') ?? 0,
		order: numberProperty(record, 'OrderIndex', 'orderIndex') ?? 0,
		additionalData: stringProperty(record, 'AdditionalData', 'additionalData'),
		displayTitleText: booleanProperty(record, 'DisplayTitleText', 'displayTitleText') ?? true,
		showDetailsMenu: booleanProperty(record, 'ShowDetailsMenu', 'showDetailsMenu') ?? true
	};
}

function queryItems(value: unknown): unknown[] {
	const record = asRecord(value);
	return arrayProperty(record, 'Items', 'items');
}

function decodeSections(value: unknown): HomeScreenSectionDefinition[] {
	return queryItems(value)
		.map(decodeSection)
		.filter((section): section is HomeScreenSectionDefinition => section !== null)
		.sort((a, b) => a.order - b.order);
}

function stringArray(record: Record<string, unknown>, ...keys: string[]): string[] {
	return arrayProperty(record, ...keys).filter(
		(value): value is string => typeof value === 'string'
	);
}

function decodeUserSettings(value: unknown): HomeScreenUserSettings {
	const record = asRecord(value);
	return {
		userId: stringProperty(record, 'UserId', 'userId') ?? '',
		enabledSections: stringArray(record, 'EnabledSections', 'enabledSections'),
		lockedSections: stringArray(record, 'LockedSections', 'lockedSections'),
		defaultEnabledSections: stringArray(record, 'DefaultEnabledSections', 'defaultEnabledSections')
	};
}

function pluginVariant(mode: HomeScreenSectionDefinition['viewMode']): HomeSectionVariant {
	return mode === 'portrait' || mode === 'square' ? 'portrait' : 'landscape';
}

export function applyHomeScreenSettings(
	sections: HomeScreenSectionDefinition[],
	settings?: HomeScreenUserSettings
): HomeScreenSectionDefinition[] {
	if (!settings) return [...sections].sort((a, b) => a.order - b.order);
	const enabled = new Set(settings.enabledSections);
	return sections.filter((section) => enabled.has(section.id)).sort((a, b) => a.order - b.order);
}

export class HomeScreenSectionsAdapter {
	readonly client: PluginHttpClient;

	constructor(api: Api, fetchImpl?: FetchLike) {
		this.client = new PluginHttpClient(api, fetchImpl);
	}

	probe(): Promise<CapabilityState<HomeScreenMetadata>> {
		return this.getMetadata();
	}

	getMetadata(): Promise<CapabilityState<HomeScreenMetadata>> {
		return this.client.json('/HomeScreen/Meta', { decode: decodeMetadata });
	}

	getSections(
		userId: string,
		language?: string
	): Promise<CapabilityState<HomeScreenSectionDefinition[]>> {
		return this.client.json('/HomeScreen/Sections', {
			query: { userId, language },
			decode: decodeSections
		});
	}

	getAvailableSections(language?: string): Promise<CapabilityState<HomeScreenSectionDefinition[]>> {
		return this.client.json('/ModularHomeViews/Sections', {
			query: { language },
			decode: decodeSections
		});
	}

	getUserSettings(userId: string): Promise<CapabilityState<HomeScreenUserSettings>> {
		return this.client.json('/ModularHomeViews/UserSettings', {
			query: { userId },
			decode: decodeUserSettings
		});
	}

	getSectionContent(
		section: HomeScreenSectionDefinition,
		userId: string,
		language?: string
	): Promise<CapabilityState<BaseItemDto[]>> {
		return this.client.json(`/HomeScreen/Section/${encodeURIComponent(section.id)}`, {
			query: { userId, language, additionalData: section.additionalData },
			decode: (value) => queryItems(value) as BaseItemDto[]
		});
	}

	async loadHome(userId: string, language?: string): Promise<CapabilityState<HomeSectionModel[]>> {
		const sectionsResult = await this.getSections(userId, language);
		if (sectionsResult.status !== 'available' || !sectionsResult.data) {
			return {
				status: sectionsResult.status,
				statusCode: sectionsResult.statusCode,
				message: sectionsResult.message
			};
		}

		const content = await Promise.all(
			sectionsResult.data.map(async (section) => ({
				section,
				result: await this.getSectionContent(section, userId, language)
			}))
		);
		const models = content.flatMap(({ section, result }) =>
			result.data
				? [
						{
							id: section.id,
							title: section.title,
							variant: pluginVariant(section.viewMode),
							order: section.order,
							items: result.data
						} satisfies HomeSectionModel
					]
				: []
		);
		const degraded = content.some(({ result }) => result.status !== 'available');
		return {
			status: degraded ? 'degraded' : 'available',
			data: models,
			message: degraded ? 'One or more Home Screen Sections could not be loaded' : undefined
		};
	}
}
