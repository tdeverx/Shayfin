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

export interface AchievementPublicConfig {
	leaderboardEnabled: boolean;
	compareEnabled: boolean;
	activityFeedEnabled: boolean;
	prestigeEnabled: boolean;
	questsEnabled: boolean;
	forcePrivacyMode: boolean;
	forceSpoilerMode: boolean;
	forceExtremeSpoilerMode: boolean;
	forceHideEquippedShowcase: boolean;
	friendsEnabled: boolean;
	friendsSimpleMode: boolean;
	defaultLanguage?: string;
}

export interface AchievementUserPreferences {
	raw: Record<string, unknown>;
	privacyMode: boolean;
	spoilerMode: boolean;
	extremeSpoilerMode: boolean;
	hideEquippedShowcase: boolean;
	hideNowWatching: boolean;
	hideLastWatched: boolean;
	toastEnabled: boolean;
	soundEnabled: boolean;
	confettiEnabled: boolean;
	minimumRarity?: string;
	language?: string;
	equippedSlots?: number;
}

export interface AchievementFriend {
	userId: string;
	name: string;
	avatarUrl?: string;
	isOnline: boolean;
	nowPlaying?: Record<string, unknown>;
	lastWatched?: Record<string, unknown>;
	equipped: AchievementBadge[];
}

export interface AchievementFriends {
	friends: AchievementFriend[];
	incoming: AchievementFriend[];
	outgoing: AchievementFriend[];
}

function decodePublicConfig(value: unknown): AchievementPublicConfig {
	const record = asRecord(value);
	const flag = (...keys: string[]) => booleanProperty(record, ...keys) ?? false;
	return {
		leaderboardEnabled: flag('LeaderboardEnabled', 'leaderboardEnabled'),
		compareEnabled: flag('CompareEnabled', 'compareEnabled'),
		activityFeedEnabled: flag('ActivityFeedEnabled', 'activityFeedEnabled'),
		prestigeEnabled: flag('PrestigeEnabled', 'prestigeEnabled'),
		questsEnabled: flag('QuestsEnabled', 'questsEnabled'),
		forcePrivacyMode: flag('ForcePrivacyMode', 'forcePrivacyMode'),
		forceSpoilerMode: flag('ForceSpoilerMode', 'forceSpoilerMode'),
		forceExtremeSpoilerMode: flag('ForceExtremeSpoilerMode', 'forceExtremeSpoilerMode'),
		forceHideEquippedShowcase: flag('ForceHideEquippedShowcase', 'forceHideEquippedShowcase'),
		friendsEnabled: flag('FriendsEnabled', 'friendsEnabled'),
		friendsSimpleMode: flag('FriendsSimpleMode', 'friendsSimpleMode'),
		defaultLanguage: stringProperty(record, 'DefaultLanguage', 'defaultLanguage')
	};
}

function decodePreferences(value: unknown): AchievementUserPreferences {
	const raw = asRecord(value);
	const flag = (...keys: string[]) => booleanProperty(raw, ...keys) ?? false;
	return {
		raw,
		privacyMode: flag('PrivacyMode', 'privacyMode'),
		spoilerMode: flag('SpoilerMode', 'spoilerMode'),
		extremeSpoilerMode: flag('ExtremeSpoilerMode', 'extremeSpoilerMode'),
		hideEquippedShowcase: flag('HideEquippedShowcase', 'hideEquippedShowcase'),
		hideNowWatching: flag('HideNowWatching', 'hideNowWatching'),
		hideLastWatched: flag('HideLastWatched', 'hideLastWatched'),
		toastEnabled: booleanProperty(raw, 'ToastEnabled', 'toastEnabled') ?? true,
		soundEnabled: booleanProperty(raw, 'SoundEnabled', 'soundEnabled') ?? true,
		confettiEnabled: booleanProperty(raw, 'ConfettiEnabled', 'confettiEnabled') ?? true,
		minimumRarity: stringProperty(raw, 'MinimumRarity', 'minimumRarity'),
		language: stringProperty(raw, 'Language', 'language'),
		equippedSlots: numberProperty(raw, 'EquippedSlots', 'equippedSlots')
	};
}

function decodeFriend(value: unknown): AchievementFriend | null {
	const record = asRecord(value);
	const userId = stringProperty(record, 'UserId', 'userId', 'Id', 'id');
	if (!userId) return null;
	return {
		userId,
		name: stringProperty(record, 'Name', 'name', 'UserName', 'userName') ?? 'Jellyfin user',
		avatarUrl: stringProperty(record, 'AvatarUrl', 'avatarUrl', 'ImageUrl', 'imageUrl'),
		isOnline: booleanProperty(record, 'IsOnline', 'isOnline', 'Online', 'online') ?? false,
		nowPlaying: Object.keys(asRecord(property(record, 'NowPlaying', 'nowPlaying'))).length
			? asRecord(property(record, 'NowPlaying', 'nowPlaying'))
			: undefined,
		lastWatched: Object.keys(asRecord(property(record, 'LastWatched', 'lastWatched'))).length
			? asRecord(property(record, 'LastWatched', 'lastWatched'))
			: undefined,
		equipped: decodeBadges(property(record, 'Equipped', 'equipped'))
	};
}

function decodeFriends(value: unknown): AchievementFriends {
	const record = asRecord(value);
	const list = (...keys: string[]) =>
		arrayProperty(record, ...keys)
			.map(decodeFriend)
			.filter((friend): friend is AchievementFriend => friend !== null);
	return {
		friends: list('Friends', 'friends'),
		incoming: list('Incoming', 'incoming'),
		outgoing: list('Outgoing', 'outgoing')
	};
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

	getPublicConfig(): Promise<CapabilityState<AchievementPublicConfig>> {
		return this.client.json('/Plugins/AchievementBadges/public-config', {
			decode: decodePublicConfig
		});
	}

	getPreferences(userId: string): Promise<CapabilityState<AchievementUserPreferences>> {
		return this.client.json(this.userPath(userId, '/preferences'), { decode: decodePreferences });
	}

	async updatePreferences(
		userId: string,
		patch: Record<string, unknown>
	): Promise<CapabilityState<AchievementUserPreferences>> {
		const current = await this.getPreferences(userId);
		if (current.status !== 'available' || !current.data) return current;
		return this.client.json(this.userPath(userId, '/preferences'), {
			method: 'POST',
			body: { ...current.data.raw, ...patch },
			decode: (value) => decodePreferences(value ?? { ...current.data?.raw, ...patch })
		});
	}

	equip(userId: string, badgeId: string): Promise<CapabilityState<void>> {
		return this.client.json(this.userPath(userId, `/equipped/${encodeURIComponent(badgeId)}`), {
			method: 'POST',
			decode: () => undefined
		});
	}

	unequip(userId: string, badgeId: string): Promise<CapabilityState<void>> {
		return this.client.json(this.userPath(userId, `/equipped/${encodeURIComponent(badgeId)}`), {
			method: 'DELETE',
			decode: () => undefined
		});
	}

	getFriends(userId: string): Promise<CapabilityState<AchievementFriends>> {
		return this.client.json(this.userPath(userId, '/friends'), { decode: decodeFriends });
	}

	getPublicEquipped(targetUserId: string): Promise<CapabilityState<AchievementBadge[]>> {
		return this.client.json(
			`/Plugins/AchievementBadges/profiles/${encodeURIComponent(targetUserId)}/equipped`,
			{ decode: decodeBadges }
		);
	}

	getActivityFeed(targetUserId: string, page = 1, pageSize = 20) {
		return this.client.json('/Plugins/AchievementBadges/activity-feed', {
			query: { userId: targetUserId, page, pageSize },
			decode: (value) => {
				const record = asRecord(value);
				return (Array.isArray(value) ? value : arrayProperty(record, 'Items', 'items')) as Record<
					string,
					unknown
				>[];
			}
		});
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
		// This is the first-screen contract. Statistics, recap and other secondary
		// dashboards have their own endpoints and should be loaded by the view that
		// actually exposes them, not by every visit to Achievements.
		const [summary, badges, recent, equipped] = await Promise.all([
			this.getSummary(userId),
			this.getBadges(userId, language),
			this.getRecent(userId),
			this.getEquipped(userId, language)
		]);
		if (summary.status !== 'available' || !summary.data) {
			return {
				status: summary.status,
				statusCode: summary.statusCode,
				message: summary.message
			};
		}

		const states = [badges, recent, equipped];
		return {
			status: states.every((state) => state.status === 'available') ? 'available' : 'degraded',
			data: {
				summary: summary.data,
				badges: badges.data ?? [],
				recent: recent.data ?? [],
				records: {},
				equipped: equipped.data ?? [],
				rank: undefined,
				bank: undefined,
				quests: [],
				watchCalendar: undefined,
				libraryCompletion: {},
				categoryProgress: {},
				rarityStats: {},
				recap: undefined
			},
			message: states.some((state) => state.status !== 'available')
				? 'Some achievement data could not be loaded'
				: undefined
		};
	}
}
