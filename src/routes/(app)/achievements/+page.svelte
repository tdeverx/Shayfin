<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import BadgeCheckIcon from '@lucide/svelte/icons/badge-check';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import { session } from '$lib/app/session.svelte';
	import { readCache, userCacheKey, writeCache } from '$lib/app/data-cache';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import * as Accordion from '$lib/components/ui/accordion';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Tabs from '$lib/components/ui/tabs';
	import {
		AchievementBadgesAdapter,
		type AchievementBadge,
		type AchievementProfile
	} from '$lib/jellyfin';
	import AchievementCard from './achievement-card.svelte';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let profile = $state<AchievementProfile | null>(null);
	let degraded = $state(false);
	const CACHE_MS = 60_000;

	let unlocked = $derived(profile?.badges.filter((badge) => badge.unlocked) ?? []);
	let inProgress = $derived(
		(profile?.badges ?? [])
			.filter((badge) => !badge.unlocked && badge.targetValue > 0)
			.sort((a, b) => progress(b) - progress(a))
	);
	let locked = $derived(
		(profile?.badges ?? []).filter((badge) => !badge.unlocked && badge.targetValue <= 0)
	);
	let progressGroups = $derived.by(() => {
		const groups = new SvelteMap<string, AchievementBadge[]>();
		for (const badge of [...inProgress, ...locked]) {
			groups.set(badge.category, [...(groups.get(badge.category) ?? []), badge]);
		}
		return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
	});
	let recordStats = $derived.by(() => {
		if (!profile) return [];
		const labels: Record<string, string> = {
			totalItemsWatched: 'Items watched',
			moviesWatched: 'Movies watched',
			seriesCompleted: 'Series completed',
			bestWatchStreak: 'Best watch streak',
			maxEpisodesInSingleDay: 'Episodes in one day',
			maxMoviesInSingleDay: 'Movies in one day',
			longestItemMinutes: 'Longest item (minutes)',
			totalMinutesWatched: 'Minutes watched',
			totalHoursWatched: 'Hours watched',
			lateNightSessions: 'Late-night sessions',
			earlyMorningSessions: 'Early-morning sessions',
			weekendSessions: 'Weekend sessions',
			uniqueLibrariesVisited: 'Libraries visited',
			uniqueGenresWatched: 'Genres explored',
			uniqueDecadesWatched: 'Decades explored',
			uniqueCountriesWatched: 'Countries explored',
			uniqueLanguagesWatched: 'Languages explored',
			daysWatched: 'Active watch days',
			daysLoggedIn: 'Days logged in',
			bestLoginStreak: 'Best login streak',
			shortItemsWatched: 'Short items watched',
			longSeriesCompleted: 'Long series completed',
			veryLongSeriesCompleted: 'Very long series completed',
			bestComboCount: 'Best combo',
			rewatchCount: 'Rewatches',
			prestigeLevel: 'Prestige level',
			lifetimeScore: 'Lifetime score'
		};
		return Object.entries(profile.records)
			.filter((entry): entry is [string, number] => typeof entry[1] === 'number')
			.map(([key, value]) => ({ label: labels[key] ?? key, value }));
	});
	let recapStats = $derived.by(() =>
		profile?.recap
			? Object.entries(profile.recap)
					.filter(
						(entry): entry is [string, string | number] =>
							typeof entry[1] === 'string' || typeof entry[1] === 'number'
					)
					.slice(0, 12)
			: []
	);
	let recapHighlights = $derived.by(() => {
		if (!profile?.recap) return [];
		return ['TopGenres', 'TopDirectors', 'TopActors'].flatMap((key) => {
			const camelKey = key[0].toLowerCase() + key.slice(1);
			const value = profile?.recap?.[key] ?? profile?.recap?.[camelKey];
			if (!Array.isArray(value) || !value.length) return [];
			return [
				{
					title: titleCase(key),
					items: value.flatMap((item) => {
						if (!item || typeof item !== 'object') return [];
						const record = item as Record<string, unknown>;
						const name =
							typeof record.Name === 'string'
								? record.Name
								: typeof record.name === 'string'
									? record.name
									: undefined;
						const count =
							typeof record.Count === 'number'
								? record.Count
								: typeof record.count === 'number'
									? record.count
									: undefined;
						return name ? [{ name, count }] : [];
					})
				}
			];
		});
	});

	function progress(badge: AchievementBadge) {
		return badge.targetValue > 0 ? badge.currentValue / badge.targetValue : 0;
	}
	function titleCase(value: string) {
		return value
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/[_-]+/g, ' ')
			.replace(/^./, (letter) => letter.toUpperCase());
	}
	function formatDate(value?: string) {
		if (!value) return '';
		const date = new Date(value);
		return Number.isNaN(date.valueOf())
			? ''
			: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
	}

	onMount(() => void load());
	async function load(force = false) {
		await session.initialize();
		const api = session.api;
		const user = session.user;
		if (!api || !user) {
			error = 'Your Jellyfin session is not available.';
			loading = false;
			return;
		}
		if (session.bootstrap?.plugins?.achievementBadges.enabled === false) {
			error = 'Achievement Badges is disabled in Shayfin settings.';
			loading = false;
			return;
		}
		const key = userCacheKey(session.bootstrap?.jellyfin?.server.id, user.id, 'achievements');
		if (!force) {
			const cached = readCache<{ profile: AchievementProfile; degraded: boolean }>(key, CACHE_MS);
			if (cached) {
				profile = cached.value.profile;
				degraded = cached.value.degraded;
				loading = false;
				if (!cached.stale) return;
			}
		}
		if (!profile) loading = true;
		error = null;
		const result = await new AchievementBadgesAdapter(api).getProfile(user.id, navigator.language);
		if (result.data && (result.status === 'available' || result.status === 'degraded')) {
			profile = result.data;
			degraded = result.status === 'degraded';
			writeCache(key, { profile, degraded });
		} else error = result.message ?? 'Achievement Badges is not available on this Jellyfin server.';
		loading = false;
	}
</script>

<svelte:head><title>Achievements · Shayfin</title></svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6 py-4">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<div class="mb-2 flex items-center gap-2">
				<TrophyIcon class="size-5 text-muted-foreground" /><span
					class="text-sm text-muted-foreground">Achievement Badges</span
				>{#if degraded}<Badge variant="outline">Partial data</Badge>{/if}
			</div>
			<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Achievements</h1>
			<p class="mt-2 text-muted-foreground">Your real progress, credited by the Jellyfin plugin.</p>
		</div>
		{#if profile}<Button variant="outline" size="sm" onclick={() => load(true)}
				><RotateCcwIcon data-icon="inline-start" />Refresh</Button
			>{/if}
	</header>
	{#if loading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each [0, 1, 2, 3] as item (item)}<Skeleton class="h-32" />{/each}
		</div>
		<Skeleton class="h-96" />
	{:else if error || !profile}
		<Empty.Root class="border"
			><Empty.Header
				><Empty.Media variant="icon"><TrophyIcon /></Empty.Media><Empty.Title
					>Achievements unavailable</Empty.Title
				><Empty.Description>{error}</Empty.Description></Empty.Header
			><Empty.Content
				><Button variant="outline" onclick={() => load(true)}>Try again</Button></Empty.Content
			></Empty.Root
		>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root size="sm"
				><Card.Header
					><Card.Description>Unlocked</Card.Description><Card.Title class="text-2xl"
						>{profile.summary.unlocked} / {profile.summary.total}</Card.Title
					></Card.Header
				><Card.Content
					><Progress
						value={profile.summary.percentage}
						aria-label="Achievement completion"
					/></Card.Content
				></Card.Root
			>
			<Card.Root size="sm"
				><Card.Header
					><Card.Description>{profile.rank?.tier.name ?? 'Achievement score'}</Card.Description
					><Card.Title class="text-2xl"
						>{(profile.rank?.score ?? profile.summary.score).toLocaleString()}</Card.Title
					></Card.Header
				>{#if profile.rank?.nextTier}<Card.Content
						><Progress value={profile.rank.progressToNext} aria-label="Rank progress" />
						<p class="mt-1.5 text-xs text-muted-foreground">
							Next: {profile.rank.nextTier.name} at {profile.rank.nextTier.minScore.toLocaleString()}
						</p></Card.Content
					>{/if}</Card.Root
			>
			<Card.Root size="sm"
				><Card.Header
					><Card.Description>Current streak</Card.Description><Card.Title
						class="flex items-center gap-2 text-2xl"
						><FlameIcon />{profile.summary.currentWatchStreak} days</Card.Title
					></Card.Header
				><Card.Content class="text-xs text-muted-foreground"
					>Best: {profile.summary.bestWatchStreak} days</Card.Content
				></Card.Root
			>
			<Card.Root size="sm"
				><Card.Header
					><Card.Description>Score bank</Card.Description><Card.Title class="text-2xl"
						>{(profile.bank?.scoreBank ?? 0).toLocaleString()}</Card.Title
					></Card.Header
				><Card.Content class="text-xs text-muted-foreground"
					>Lifetime {profile.bank?.lifetimeScore.toLocaleString() ?? '—'} · Prestige {profile.bank
						?.prestigeLevel ?? 0} · Combo {profile.bank?.comboCount ?? 0} (best {profile.bank
						?.bestComboCount ?? 0})</Card.Content
				></Card.Root
			>
		</div>

		<Tabs.Root value="progress" class="gap-5">
			<div class="overflow-x-auto">
				<Tabs.List
					><Tabs.Trigger value="progress"><ActivityIcon />Progress</Tabs.Trigger><Tabs.Trigger
						value="unlocked"><BadgeCheckIcon />Unlocked</Tabs.Trigger
					><Tabs.Trigger value="quests"><SparklesIcon />Quests</Tabs.Trigger><Tabs.Trigger
						value="activity"><FlameIcon />Activity</Tabs.Trigger
					><Tabs.Trigger value="records"><TrophyIcon />Records</Tabs.Trigger></Tabs.List
				>
			</div>
			<Tabs.Content value="progress" class="space-y-6">
				{#if inProgress.length}<section class="space-y-3">
						<div>
							<h2 class="text-lg font-medium">Closest to unlocking</h2>
							<p class="text-sm text-muted-foreground">
								Every value comes directly from Achievement Badges.
							</p>
						</div>
						<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{#each inProgress.slice(0, 12) as badge (badge.id)}<AchievementCard
									{badge}
									rarityPercentage={profile.rarityStats[badge.id]}
								/>{/each}
						</div>
					</section>{/if}
				{#if progressGroups.length}<section class="space-y-3">
						<h2 class="text-lg font-medium">Browse all progress</h2>
						<Accordion.Root type="multiple">
							{#each progressGroups as [category, badges] (category)}<Accordion.Item
									value={category}
								>
									<Accordion.Trigger
										>{category}<Badge variant="secondary">{badges.length}</Badge></Accordion.Trigger
									>
									<Accordion.Content
										><div class="grid gap-3 p-4 pt-1 md:grid-cols-2 xl:grid-cols-3">
											{#each badges as badge (badge.id)}<AchievementCard
													{badge}
													rarityPercentage={profile.rarityStats[badge.id]}
												/>{/each}
										</div></Accordion.Content
									>
								</Accordion.Item>{/each}
						</Accordion.Root>
					</section>{/if}
			</Tabs.Content>
			<Tabs.Content value="unlocked" class="space-y-5">
				{#if profile.equipped.length}<section class="space-y-3">
						<h2 class="text-lg font-medium">Equipped badges</h2>
						<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{#each profile.equipped as badge (badge.id)}<AchievementCard
									{badge}
									rarityPercentage={profile.rarityStats[badge.id]}
								/>{/each}
						</div>
					</section>{/if}
				<section class="space-y-3">
					<h2 class="text-lg font-medium">All unlocked</h2>
					{#if unlocked.length}<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{#each unlocked as badge (badge.id)}<AchievementCard
									{badge}
									rarityPercentage={profile.rarityStats[badge.id]}
								/>{/each}
						</div>{:else}<Alert
							><AlertTitle>No unlocked badges yet</AlertTitle><AlertDescription
								>Progress will appear as the plugin credits completed watches.</AlertDescription
							></Alert
						>{/if}
				</section>
			</Tabs.Content>
			<Tabs.Content value="quests" class="space-y-4"
				>{#if profile.quests.length}<div class="grid gap-3 md:grid-cols-2">
						{#each profile.quests as quest (quest.id)}<Card.Root size="sm"
								><Card.Header
									><div class="flex items-center gap-2">
										<Badge variant="outline">{quest.period}</Badge>{#if quest.completed}<Badge
												>Complete</Badge
											>{/if}
									</div>
									<Card.Title>{quest.title}</Card.Title><Card.Description
										>{quest.description}</Card.Description
									></Card.Header
								><Card.Content class="space-y-2"
									>{#if quest.targetValue > 0}<Progress
											value={Math.min(100, (quest.currentValue / quest.targetValue) * 100)}
											aria-label={`${quest.title} progress`}
										/>
										<p class="text-xs text-muted-foreground">
											{quest.currentValue} of {quest.targetValue}{#if quest.reward}
												· {quest.reward} score{/if}
										</p>{/if}</Card.Content
								></Card.Root
							>{/each}
					</div>{:else}<p class="text-sm text-muted-foreground">
						No quest data is available from this plugin version.
					</p>{/if}</Tabs.Content
			>
			<Tabs.Content value="activity" class="space-y-6">
				{#if profile.recent.length}<section class="space-y-3">
						<h2 class="text-lg font-medium">Recent unlocks</h2>
						<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{#each profile.recent as badge (badge.id)}<Card.Root size="sm"
									><Card.Header
										><Card.Title>{badge.title}</Card.Title><Card.Description
											>{badge.description}</Card.Description
										></Card.Header
									><Card.Content class="text-xs text-muted-foreground"
										>{formatDate(badge.unlockedAt)}</Card.Content
									></Card.Root
								>{/each}
						</div>
					</section>{/if}
				{#if profile.watchCalendar}<section class="space-y-3">
						<div>
							<h2 class="text-lg font-medium">Watch calendar</h2>
							<p class="text-sm text-muted-foreground">
								{profile.watchCalendar.days} days of credited activity
							</p>
						</div>
						<div
							class="grid grid-cols-[repeat(auto-fill,minmax(0,1fr))] gap-1 rounded-xl bg-muted/40 p-4"
							style="grid-template-columns: repeat(15, minmax(0, 1fr));"
						>
							{#each Object.entries(profile.watchCalendar.counts) as [date, count] (date)}<div
									class="aspect-square rounded-sm bg-primary"
									style:opacity={Math.max(0.15, Math.min(1, count / 4))}
									title={`${date}: ${count}`}
									aria-label={`${date}: ${count} credited items`}
								></div>{/each}
						</div>
					</section>{/if}
				{#if recapStats.length}<section class="space-y-3">
						<h2 class="text-lg font-medium">Monthly recap</h2>
						<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{#each recapStats as [label, value] (label)}<Card.Root size="sm"
									><Card.Header
										><Card.Description>{titleCase(label)}</Card.Description><Card.Title
											>{typeof value === 'number' ? value.toLocaleString() : value}</Card.Title
										></Card.Header
									></Card.Root
								>{/each}
						</div>
					</section>{/if}
				{#if recapHighlights.length}<section class="grid gap-3 md:grid-cols-3">
						{#each recapHighlights as group (group.title)}<Card.Root size="sm">
								<Card.Header><Card.Title>{group.title}</Card.Title></Card.Header>
								<Card.Content class="space-y-2">
									{#each group.items as item (item.name)}<div
											class="flex items-center justify-between gap-3 text-sm"
										>
											<span class="truncate">{item.name}</span>
											{#if item.count !== undefined}<Badge variant="secondary">{item.count}</Badge
												>{/if}
										</div>{/each}
								</Card.Content>
							</Card.Root>{/each}
					</section>{/if}
			</Tabs.Content>
			<Tabs.Content value="records" class="space-y-6">
				{#if profile.rank?.tiers.length}<section class="space-y-3">
						<h2 class="text-lg font-medium">Rank ladder</h2>
						<div class="flex flex-wrap gap-2">
							{#each profile.rank.tiers as tier (tier.name)}<Badge
									variant={tier.name === profile.rank?.tier.name ? 'default' : 'outline'}
									>{tier.name} · {tier.minScore.toLocaleString()}</Badge
								>{/each}
						</div>
					</section>{/if}
				{#if recordStats.length}<section class="space-y-3">
						<h2 class="text-lg font-medium">Personal records</h2>
						<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{#each recordStats as stat (stat.label)}<Card.Root size="sm"
									><Card.Header
										><Card.Description>{stat.label}</Card.Description><Card.Title
											>{stat.value.toLocaleString()}</Card.Title
										></Card.Header
									></Card.Root
								>{/each}
						</div>
					</section>{/if}
				{#if Object.keys(profile.categoryProgress).length}<section class="space-y-3">
						<h2 class="text-lg font-medium">Category progress</h2>
						<div class="grid gap-3 md:grid-cols-2">
							{#each Object.entries(profile.categoryProgress) as [category, value] (category)}<Card.Root
									size="sm"
									><Card.Header><Card.Title>{category}</Card.Title></Card.Header><Card.Content
										><Progress {value} aria-label={`${category} progress`} />
										<p class="mt-1.5 text-xs text-muted-foreground">
											{value.toFixed(0)}%
										</p></Card.Content
									></Card.Root
								>{/each}
						</div>
					</section>{/if}
				{#if Object.keys(profile.libraryCompletion).length}<section class="space-y-3">
						<h2 class="text-lg font-medium">Library completion</h2>
						<div class="grid gap-3 md:grid-cols-2">
							{#each Object.entries(profile.libraryCompletion) as [library, value] (library)}<Card.Root
									size="sm"
									><Card.Header><Card.Title>{library}</Card.Title></Card.Header><Card.Content
										><Progress {value} aria-label={`${library} completion`} />
										<p class="mt-1.5 text-xs text-muted-foreground">
											{value.toFixed(0)}%
										</p></Card.Content
									></Card.Root
								>{/each}
						</div>
					</section>{/if}
			</Tabs.Content>
		</Tabs.Root>
	{/if}
</div>
