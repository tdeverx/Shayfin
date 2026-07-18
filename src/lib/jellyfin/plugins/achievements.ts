import type { Api } from '@jellyfin/sdk';
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
	uniqueDecadesWatched?: number;
	uniqueCountriesWatched?: number;
	uniqueLanguagesWatched?: number;
	daysWatched?: number;
	daysLoggedIn?: number;
	bestLoginStreak?: number;
	shortItemsWatched?: number;
	longSeriesCompleted?: number;
	veryLongSeriesCompleted?: number;
	bestComboCount?: number;
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
	rank?: AchievementRank;
	bank?: AchievementBank;
	quests: AchievementQuest[];
	watchCalendar?: AchievementWatchCalendar;
	libraryCompletion: Record<string, number>;
	categoryProgress: Record<string, number>;
	rarityStats: Record<string, number>;
	recap?: Record<string, unknown>;
}

export interface AchievementRankTier {
	name: string;
	minScore: number;
	color?: string;
	icon?: string;
}
export interface AchievementRank {
	score: number;
	tier: AchievementRankTier;
	nextTier?: AchievementRankTier;
	progressToNext: number;
	tiers: AchievementRankTier[];
}
export interface AchievementBank {
	scoreBank: number;
	lifetimeScore: number;
	prestigeLevel: number;
	comboCount: number;
	bestComboCount: number;
}
export interface AchievementQuest {
	id: string;
	title: string;
	description: string;
	period: string;
	completed: boolean;
	currentValue: number;
	targetValue: number;
	reward?: number;
}
export interface AchievementWatchCalendar {
	days: number;
	counts: Record<string, number>;
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
		uniqueDecadesWatched: numericRecord(record, 'UniqueDecadesWatched', 'uniqueDecadesWatched'),
		uniqueCountriesWatched: numericRecord(
			record,
			'UniqueCountriesWatched',
			'uniqueCountriesWatched'
		),
		uniqueLanguagesWatched: numericRecord(
			record,
			'UniqueLanguagesWatched',
			'uniqueLanguagesWatched'
		),
		daysWatched: numericRecord(record, 'DaysWatched', 'daysWatched'),
		daysLoggedIn: numericRecord(record, 'DaysLoggedIn', 'daysLoggedIn'),
		bestLoginStreak: numericRecord(record, 'BestLoginStreak', 'bestLoginStreak'),
		shortItemsWatched: numericRecord(record, 'ShortItemsWatched', 'shortItemsWatched'),
		longSeriesCompleted: numericRecord(record, 'LongSeriesCompleted', 'longSeriesCompleted'),
		veryLongSeriesCompleted: numericRecord(
			record,
			'VeryLongSeriesCompleted',
			'veryLongSeriesCompleted'
		),
		bestComboCount: numericRecord(record, 'BestComboCount', 'bestComboCount'),
		rewatchCount: numericRecord(record, 'RewatchCount', 'rewatchCount'),
		prestigeLevel: numericRecord(record, 'PrestigeLevel', 'prestigeLevel'),
		lifetimeScore: numericRecord(record, 'LifetimeScore', 'lifetimeScore')
	};
}

function decodeTier(value: unknown): AchievementRankTier {
	const record = asRecord(value);
	return {
		name: stringProperty(record, 'Name', 'name') ?? 'Unranked',
		minScore: numberProperty(record, 'MinScore', 'minScore') ?? 0,
		color: stringProperty(record, 'Color', 'color'),
		icon: stringProperty(record, 'Icon', 'icon')
	};
}

function decodeRank(value: unknown): AchievementRank {
	const record = asRecord(value);
	const next = property(record, 'NextTier', 'nextTier');
	return {
		score: numberProperty(record, 'Score', 'score') ?? 0,
		tier: decodeTier(property(record, 'Tier', 'tier')),
		nextTier: next ? decodeTier(next) : undefined,
		progressToNext: numberProperty(record, 'ProgressToNext', 'progressToNext') ?? 0,
		tiers: arrayProperty(record, 'Tiers', 'tiers').map(decodeTier)
	};
}

function decodeBank(value: unknown): AchievementBank {
	const record = asRecord(value);
	return {
		scoreBank: numberProperty(record, 'ScoreBank', 'scoreBank') ?? 0,
		lifetimeScore: numberProperty(record, 'LifetimeScore', 'lifetimeScore') ?? 0,
		prestigeLevel: numberProperty(record, 'PrestigeLevel', 'prestigeLevel') ?? 0,
		comboCount: numberProperty(record, 'ComboCount', 'comboCount') ?? 0,
		bestComboCount: numberProperty(record, 'BestComboCount', 'bestComboCount') ?? 0
	};
}

function decodeQuest(value: unknown, period = ''): AchievementQuest | null {
	const record = asRecord(value);
	const definition = asRecord(property(record, 'Definition', 'definition'));
	const id = stringProperty(record, 'Id', 'id') ?? stringProperty(definition, 'Id', 'id');
	if (!id) return null;
	return {
		id,
		title:
			stringProperty(record, 'Title', 'title') ??
			stringProperty(definition, 'Title', 'title') ??
			id,
		description:
			stringProperty(record, 'Description', 'description') ??
			stringProperty(definition, 'Description', 'description') ??
			'',
		period: stringProperty(record, 'Period', 'period') ?? period,
		completed: booleanProperty(record, 'Completed', 'completed') ?? false,
		currentValue:
			numberProperty(
				record,
				'CurrentValue',
				'currentValue',
				'Progress',
				'progress',
				'Current',
				'current'
			) ?? 0,
		targetValue:
			numberProperty(record, 'TargetValue', 'targetValue', 'Target', 'target') ??
			numberProperty(definition, 'TargetValue', 'targetValue') ??
			0,
		reward:
			numberProperty(record, 'Reward', 'reward', 'ScoreReward', 'scoreReward') ??
			numberProperty(definition, 'Reward', 'reward', 'ScoreReward', 'scoreReward')
	};
}

function decodeQuests(value: unknown): AchievementQuest[] {
	const record = asRecord(value);
	return [
		...arrayProperty(record, 'Daily', 'daily').map((item) => decodeQuest(item, 'Daily')),
		...arrayProperty(record, 'Weekly', 'weekly').map((item) => decodeQuest(item, 'Weekly'))
	].filter((quest): quest is AchievementQuest => quest !== null);
}

function decodeNumberMap(value: unknown, ...wrapperKeys: string[]): Record<string, number> {
	let record = asRecord(value);
	if (wrapperKeys.length) record = asRecord(property(record, ...wrapperKeys));
	return Object.fromEntries(
		Object.entries(record).filter(
			(entry): entry is [string, number] =>
				typeof entry[1] === 'number' && Number.isFinite(entry[1])
		)
	);
}

function decodeCategoryProgress(value: unknown): Record<string, number> {
	if (!Array.isArray(value)) return decodeNumberMap(value);
	return Object.fromEntries(
		value.flatMap((item) => {
			const record = asRecord(item);
			const category = stringProperty(record, 'Category', 'category');
			const percentage = numberProperty(record, 'Percent', 'percent', 'Percentage', 'percentage');
			return category && percentage !== undefined ? [[category, percentage] as const] : [];
		})
	);
}

function decodeWatchCalendar(value: unknown): AchievementWatchCalendar {
	const record = asRecord(value);
	return {
		days: numberProperty(record, 'Days', 'days') ?? 90,
		counts: decodeNumberMap(record, 'Counts', 'counts')
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

	getRank(userId: string) {
		return this.client.json(this.userPath(userId, '/rank'), { decode: decodeRank });
	}
	getBank(userId: string) {
		return this.client.json(this.userPath(userId, '/bank'), { decode: decodeBank });
	}
	getQuests(userId: string) {
		return this.client.json(this.userPath(userId, '/quests'), { decode: decodeQuests });
	}
	getWatchCalendar(userId: string, days = 90) {
		return this.client.json(this.userPath(userId, '/watch-calendar'), {
			query: { days },
			decode: decodeWatchCalendar
		});
	}
	getLibraryCompletion(userId: string) {
		return this.client.json(this.userPath(userId, '/library-completion'), {
			decode: (value) =>
				decodeNumberMap(value, 'LibraryCompletionPercents', 'libraryCompletionPercents')
		});
	}
	getCategoryProgress(userId: string) {
		return this.client.json(this.userPath(userId, '/category-progress'), {
			decode: decodeCategoryProgress
		});
	}
	getRarityStats() {
		return this.client.json('/Plugins/AchievementBadges/badges/rarity-stats', {
			decode: (value) => decodeNumberMap(value)
		});
	}
	getRecap(userId: string, period: 'week' | 'month' | 'year' = 'month') {
		return this.client.json(this.userPath(userId, '/recap'), {
			query: { period },
			decode: (value) => asRecord(value)
		});
	}

	async getProfile(
		userId: string,
		language?: string
	): Promise<CapabilityState<AchievementProfile>> {
		const [
			summary,
			badges,
			recent,
			records,
			equipped,
			rank,
			bank,
			quests,
			watchCalendar,
			libraryCompletion,
			categoryProgress,
			rarityStats,
			recap
		] = await Promise.all([
			this.getSummary(userId),
			this.getBadges(userId, language),
			this.getRecent(userId),
			this.getRecords(userId),
			this.getEquipped(userId, language),
			this.getRank(userId),
			this.getBank(userId),
			this.getQuests(userId),
			this.getWatchCalendar(userId),
			this.getLibraryCompletion(userId),
			this.getCategoryProgress(userId),
			this.getRarityStats(),
			this.getRecap(userId)
		]);
		if (summary.status !== 'available' || !summary.data) {
			return {
				status: summary.status,
				statusCode: summary.statusCode,
				message: summary.message
			};
		}

		const states = [
			badges,
			recent,
			records,
			equipped,
			rank,
			bank,
			quests,
			watchCalendar,
			libraryCompletion,
			categoryProgress,
			rarityStats,
			recap
		];
		return {
			status: states.every((state) => state.status === 'available') ? 'available' : 'degraded',
			data: {
				summary: summary.data,
				badges: badges.data ?? [],
				recent: recent.data ?? [],
				records: records.data ?? {},
				equipped: equipped.data ?? [],
				rank: rank.data,
				bank: bank.data,
				quests: quests.data ?? [],
				watchCalendar: watchCalendar.data,
				libraryCompletion: libraryCompletion.data ?? {},
				categoryProgress: categoryProgress.data ?? {},
				rarityStats: rarityStats.data ?? {},
				recap: recap.data
			},
			message: states.some((state) => state.status !== 'available')
				? 'Some achievement data could not be loaded'
				: undefined
		};
	}
}
