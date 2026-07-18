import type { Api } from '@jellyfin/sdk';
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

export interface AchievementBadge {
	id: string;
	key: string;
	title: string;
	description: string;
	icon: string;
	category: string;
	unlocked: boolean;
	unlockedAt?: string;
	currentValue: number;
	targetValue: number;
	rarity: string;
}

export interface AchievementSummary {
	unlocked: number;
	total: number;
	percentage: number;
	equippedCount: number;
	score: number;
	currentWatchStreak: number;
	bestWatchStreak: number;
}

export interface AchievementRecords {
	totalItemsWatched?: number;
	moviesWatched?: number;
	seriesCompleted?: number;
	bestWatchStreak?: number;
	maxEpisodesInSingleDay?: number;
	maxMoviesInSingleDay?: number;
	longestItemMinutes?: number;
	totalMinutesWatched?: number;
	totalHoursWatched?: number;
	lateNightSessions?: number;
	earlyMorningSessions?: number;
	weekendSessions?: number;
	uniqueLibrariesVisited?: number;
	uniqueGenresWatched?: number;
	rewatchCount?: number;
	prestigeLevel?: number;
	lifetimeScore?: number;
}

export interface AchievementProfile {
	summary: AchievementSummary;
	badges: AchievementBadge[];
	recent: AchievementBadge[];
	equipped: AchievementBadge[];
	records: AchievementRecords;
}

function decodeBadge(value: unknown): AchievementBadge | null {
	const record = asRecord(value);
	const id = stringProperty(record, 'Id', 'id');
	if (!id) return null;
	return {
		id,
		key: stringProperty(record, 'Key', 'key') ?? id,
		title: stringProperty(record, 'Title', 'title') ?? id,
		description: stringProperty(record, 'Description', 'description') ?? '',
		icon: stringProperty(record, 'Icon', 'icon') ?? 'military_tech',
		category: stringProperty(record, 'Category', 'category') ?? 'General',
		unlocked: booleanProperty(record, 'Unlocked', 'unlocked') ?? false,
		unlockedAt: stringProperty(record, 'UnlockedAt', 'unlockedAt'),
		currentValue: numberProperty(record, 'CurrentValue', 'currentValue') ?? 0,
		targetValue: numberProperty(record, 'TargetValue', 'targetValue') ?? 0,
		rarity: stringProperty(record, 'Rarity', 'rarity') ?? 'Common'
	};
}

function decodeBadges(value: unknown): AchievementBadge[] {
	const values = Array.isArray(value) ? value : arrayProperty(asRecord(value), 'Items', 'items');
	return values.map(decodeBadge).filter((badge): badge is AchievementBadge => badge !== null);
}

function numericRecord(record: Record<string, unknown>, pascal: string, camel: string) {
	return numberProperty(record, pascal, camel);
}

function decodeSummary(value: unknown): AchievementSummary {
	const record = asRecord(value);
	return {
		unlocked: numericRecord(record, 'Unlocked', 'unlocked') ?? 0,
		total: numericRecord(record, 'Total', 'total') ?? 0,
		percentage: numericRecord(record, 'Percentage', 'percentage') ?? 0,
		equippedCount: numericRecord(record, 'EquippedCount', 'equippedCount') ?? 0,
		score: numericRecord(record, 'Score', 'score') ?? 0,
		currentWatchStreak: numericRecord(record, 'CurrentWatchStreak', 'currentWatchStreak') ?? 0,
		bestWatchStreak: numericRecord(record, 'BestWatchStreak', 'bestWatchStreak') ?? 0
	};
}

function decodeRecords(value: unknown): AchievementRecords {
	const record = asRecord(value);
	return {
		totalItemsWatched: numericRecord(record, 'TotalItemsWatched', 'totalItemsWatched'),
		moviesWatched: numericRecord(record, 'MoviesWatched', 'moviesWatched'),
		seriesCompleted: numericRecord(record, 'SeriesCompleted', 'seriesCompleted'),
		bestWatchStreak: numericRecord(record, 'BestWatchStreak', 'bestWatchStreak'),
		maxEpisodesInSingleDay: numericRecord(
			record,
			'MaxEpisodesInSingleDay',
			'maxEpisodesInSingleDay'
		),
		maxMoviesInSingleDay: numericRecord(record, 'MaxMoviesInSingleDay', 'maxMoviesInSingleDay'),
		longestItemMinutes: numericRecord(record, 'LongestItemMinutes', 'longestItemMinutes'),
		totalMinutesWatched: numericRecord(record, 'TotalMinutesWatched', 'totalMinutesWatched'),
		totalHoursWatched: numericRecord(record, 'TotalHoursWatched', 'totalHoursWatched'),
		lateNightSessions: numericRecord(record, 'LateNightSessions', 'lateNightSessions'),
		earlyMorningSessions: numericRecord(record, 'EarlyMorningSessions', 'earlyMorningSessions'),
		weekendSessions: numericRecord(record, 'WeekendSessions', 'weekendSessions'),
		uniqueLibrariesVisited: numericRecord(
			record,
			'UniqueLibrariesVisited',
			'uniqueLibrariesVisited'
		),
		uniqueGenresWatched: numericRecord(record, 'UniqueGenresWatched', 'uniqueGenresWatched'),
		rewatchCount: numericRecord(record, 'RewatchCount', 'rewatchCount'),
		prestigeLevel: numericRecord(record, 'PrestigeLevel', 'prestigeLevel'),
		lifetimeScore: numericRecord(record, 'LifetimeScore', 'lifetimeScore')
	};
}

export class AchievementBadgesAdapter {
	readonly client: PluginHttpClient;

	constructor(api: Api, fetchImpl?: FetchLike) {
		this.client = new PluginHttpClient(api, fetchImpl);
	}

	probe(userId: string): Promise<CapabilityState<AchievementSummary>> {
		return this.getSummary(userId);
	}

	private userPath(userId: string, suffix = ''): string {
		return `/Plugins/AchievementBadges/users/${encodeURIComponent(userId)}${suffix}`;
	}

	getSummary(userId: string): Promise<CapabilityState<AchievementSummary>> {
		return this.client.json(this.userPath(userId, '/summary'), { decode: decodeSummary });
	}

	getBadges(userId: string, language?: string): Promise<CapabilityState<AchievementBadge[]>> {
		return this.client.json(this.userPath(userId), {
			query: { lang: language },
			decode: decodeBadges
		});
	}

	getRecent(userId: string, limit = 8): Promise<CapabilityState<AchievementBadge[]>> {
		return this.client.json(this.userPath(userId, '/recent-unlocks'), {
			query: { limit: Math.min(Math.max(limit, 1), 50) },
			decode: decodeBadges
		});
	}

	getRecords(userId: string): Promise<CapabilityState<AchievementRecords>> {
		return this.client.json(this.userPath(userId, '/records'), { decode: decodeRecords });
	}

	getEquipped(userId: string, language?: string): Promise<CapabilityState<AchievementBadge[]>> {
		return this.client.json(this.userPath(userId, '/equipped'), {
			query: { lang: language },
			decode: decodeBadges
		});
	}

	async getProfile(
		userId: string,
		language?: string
	): Promise<CapabilityState<AchievementProfile>> {
		const [summary, badges, recent, records, equipped] = await Promise.all([
			this.getSummary(userId),
			this.getBadges(userId, language),
			this.getRecent(userId),
			this.getRecords(userId),
			this.getEquipped(userId, language)
		]);
		if (summary.status !== 'available' || !summary.data) {
			return {
				status: summary.status,
				statusCode: summary.statusCode,
				message: summary.message
			};
		}

		const states = [badges, recent, records, equipped];
		return {
			status: states.every((state) => state.status === 'available') ? 'available' : 'degraded',
			data: {
				summary: summary.data,
				badges: badges.data ?? [],
				recent: recent.data ?? [],
				records: records.data ?? {},
				equipped: equipped.data ?? []
			},
			message: states.some((state) => state.status !== 'available')
				? 'Some achievement data could not be loaded'
				: undefined
		};
	}
}
