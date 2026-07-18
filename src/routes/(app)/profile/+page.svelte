<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import BadgeCheckIcon from '@lucide/svelte/icons/badge-check';
	import Clock3Icon from '@lucide/svelte/icons/clock-3';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import ImageIcon from '@lucide/svelte/icons/image';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import { toast } from 'svelte-sonner';
	import { session } from '$lib/app/session.svelte';
	import { readCache, userCacheKey, writeCache } from '$lib/app/data-cache';
	import { toMediaCard } from '$lib/app/media';
	import type { MediaCardModel } from '$lib/app/models';
	import MediaHero from '$lib/components/app/media-hero.svelte';
	import MediaRail from '$lib/components/app/media-rail.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Badge, type BadgeVariant } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Empty from '$lib/components/ui/empty';
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Tabs from '$lib/components/ui/tabs';
	import {
		AchievementBadgesAdapter,
		GetAvatarAdapter,
		loadProfileMedia,
		type AchievementProfile,
		type AchievementBadge,
		type AvatarOption
	} from '$lib/jellyfin';
	import type { NormalizedMediaRequest } from '$lib/server/contracts';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let recentlyPlayed = $state<MediaCardModel[]>([]);
	let favorites = $state<MediaCardModel[]>([]);
	let requests = $state<NormalizedMediaRequest[]>([]);
	let requestsAvailable = $state(false);
	let achievements = $state<AchievementProfile | null>(null);
	let achievementDegraded = $state(false);
	let avatars = $state<AvatarOption[]>([]);
	let avatarAvailable = $state(false);
	let avatarDialogOpen = $state(false);
	let currentAvatarUrl = $state<string | undefined>(undefined);
	let changingAvatar = $state<string | null>(null);
	let avatarAdapter: GetAvatarAdapter | null = null;
	let profileCacheKey = '';

	interface ProfileCacheData {
		recentlyPlayed: MediaCardModel[];
		favorites: MediaCardModel[];
		requests: NormalizedMediaRequest[];
		requestsAvailable: boolean;
		achievements: AchievementProfile | null;
		achievementDegraded: boolean;
		avatars: AvatarOption[];
		avatarAvailable: boolean;
		currentAvatarUrl?: string;
	}

	const PROFILE_CACHE_MS = 2 * 60_000;

	let recordStats = $derived.by(() => {
		if (!achievements) return [];
		const records = achievements.records;
		return [
			{ label: 'Movies watched', value: records.moviesWatched },
			{ label: 'Series completed', value: records.seriesCompleted },
			{ label: 'Hours watched', value: records.totalHoursWatched },
			{ label: 'Items watched', value: records.totalItemsWatched }
		].filter((stat): stat is { label: string; value: number } => typeof stat.value === 'number');
	});
	let unlockedBadges = $derived(achievements?.badges.filter((badge) => badge.unlocked) ?? []);
	let inProgressBadges = $derived.by(() =>
		(achievements?.badges ?? [])
			.filter((badge) => !badge.unlocked && badge.targetValue > 0)
			.sort((a, b) => badgeProgress(b) - badgeProgress(a))
	);
	let achievementScanSuggested = $derived(
		Boolean(
			achievements &&
			recentlyPlayed.length &&
			achievements.summary.unlocked === 0 &&
			achievements.badges.every((badge) => badge.currentValue === 0)
		)
	);
	let lastWatched = $derived(recentlyPlayed[0]);
	let avatarCategories = $derived.by(() => {
		const groups = new SvelteMap<string, AvatarOption[]>();
		for (const avatar of avatars) {
			const category = avatar.category.trim() || 'Other';
			groups.set(category, [...(groups.get(category) ?? []), avatar]);
		}
		return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
	});

	function badgeProgress(badge: AchievementBadge): number {
		if (badge.targetValue <= 0) return badge.unlocked ? 100 : 0;
		return Math.min(100, Math.max(0, (badge.currentValue / badge.targetValue) * 100));
	}

	onMount(async () => {
		if (!session.user) await session.initialize();
		const user = session.user;
		if (!user) return void loadProfile();
		profileCacheKey = userCacheKey(session.bootstrap?.jellyfin?.server.id, user.id, 'profile');
		avatarAdapter = session.api ? new GetAvatarAdapter(session.api) : null;
		const cached = readCache<ProfileCacheData>(profileCacheKey, PROFILE_CACHE_MS);
		if (cached) {
			applyProfile(cached.value);
			loading = false;
		}
		if (!cached || cached.stale) await loadProfile(Boolean(cached));
	});

	function profileSnapshot(): ProfileCacheData {
		return {
			recentlyPlayed,
			favorites,
			requests,
			requestsAvailable,
			achievements,
			achievementDegraded,
			avatars,
			avatarAvailable,
			currentAvatarUrl
		};
	}

	function applyProfile(snapshot: ProfileCacheData) {
		recentlyPlayed = snapshot.recentlyPlayed;
		favorites = snapshot.favorites;
		requests = snapshot.requests;
		requestsAvailable = snapshot.requestsAvailable;
		achievements = snapshot.achievements;
		achievementDegraded = snapshot.achievementDegraded;
		avatars = snapshot.avatars;
		avatarAvailable = snapshot.avatarAvailable;
		currentAvatarUrl = snapshot.currentAvatarUrl;
	}

	function authenticatedImage(url: string | undefined): string | undefined {
		if (!url) return undefined;
		try {
			const parsed = new URL(url);
			if (session.accessToken) parsed.searchParams.set('api_key', session.accessToken);
			return parsed.toString();
		} catch {
			return url;
		}
	}

	async function loadRequests(): Promise<NormalizedMediaRequest[] | null> {
		const response = await fetch('/api/external/requests?take=50', {
			headers: session.authorizationHeaders
		});
		if (!response.ok) return null;
		const body = (await response.json()) as { results?: NormalizedMediaRequest[] };
		return body.results ?? [];
	}

	async function loadProfile(background = false) {
		if (!background) loading = true;
		error = null;
		try {
			await session.initialize();
			const api = session.api;
			const user = session.user;
			if (!api || !user) throw new Error('Your Jellyfin session is not available.');

			currentAvatarUrl = authenticatedImage(user.imageUrl);
			const achievementsAdapter = new AchievementBadgesAdapter(api);
			avatarAdapter = new GetAvatarAdapter(api);
			profileCacheKey ||= userCacheKey(session.bootstrap?.jellyfin?.server.id, user.id, 'profile');
			const [mediaResult, requestResult, achievementResult, avatarResult, currentAvatarResult] =
				await Promise.allSettled([
					loadProfileMedia(api, user.id),
					loadRequests(),
					achievementsAdapter.getProfile(user.id, navigator.language),
					avatarAdapter.list(),
					avatarAdapter.current(user.id)
				]);

			if (mediaResult.status === 'rejected') throw mediaResult.reason;
			recentlyPlayed = mediaResult.value.recentlyPlayed
				.map((item) => toMediaCard(api, item, 'landscape'))
				.filter((item) => item !== null);
			favorites = mediaResult.value.favorites
				.map((item) => toMediaCard(api, item, 'portrait'))
				.filter((item) => item !== null);

			if (requestResult.status === 'fulfilled' && requestResult.value !== null) {
				requestsAvailable = true;
				requests = requestResult.value;
			} else {
				requestsAvailable = false;
				requests = [];
			}

			if (
				achievementResult.status === 'fulfilled' &&
				achievementResult.value.data &&
				(achievementResult.value.status === 'available' ||
					achievementResult.value.status === 'degraded')
			) {
				achievements = achievementResult.value.data;
				achievementDegraded = achievementResult.value.status === 'degraded';
			} else {
				achievements = null;
				achievementDegraded = false;
			}

			if (
				avatarResult.status === 'fulfilled' &&
				avatarResult.value.status === 'available' &&
				avatarResult.value.data
			) {
				avatarAvailable = true;
				avatars = avatarResult.value.data.map((avatar) => ({
					...avatar,
					imageUrl: authenticatedImage(avatar.imageUrl) ?? avatar.imageUrl
				}));
			} else {
				avatarAvailable = false;
				avatars = [];
			}

			if (
				currentAvatarResult.status === 'fulfilled' &&
				currentAvatarResult.value.status === 'available'
			) {
				currentAvatarUrl =
					authenticatedImage(currentAvatarResult.value.data?.url) ?? currentAvatarUrl;
			}
			writeCache(profileCacheKey, profileSnapshot());
		} catch (reason) {
			if (!background)
				error = reason instanceof Error ? reason.message : 'Your profile could not be loaded.';
		} finally {
			if (!background) loading = false;
		}
	}

	async function setAvatar(avatar: AvatarOption) {
		const adapter = avatarAdapter;
		const user = session.user;
		if (!adapter || !user) return;
		changingAvatar = avatar.id;
		try {
			const result = await adapter.set(avatar.id, user.id);
			if (result.status !== 'available') {
				throw new Error(result.message ?? 'The avatar could not be updated.');
			}
			currentAvatarUrl = avatar.imageUrl;
			session.user = { ...user, imageUrl: avatar.imageUrl };
			if (profileCacheKey) writeCache(profileCacheKey, profileSnapshot());
			avatarDialogOpen = false;
			toast.success('Avatar updated.');
		} catch (reason) {
			toast.error(reason instanceof Error ? reason.message : 'The avatar could not be updated.');
		} finally {
			changingAvatar = null;
		}
	}

	function requestLabel(request: NormalizedMediaRequest): string {
		return `${request.mediaType === 'movie' ? 'Movie' : 'Series'} · TMDB ${request.providerIds.tmdbId}`;
	}

	function requestBadgeVariant(status: NormalizedMediaRequest['status']): BadgeVariant {
		if (status === 'declined' || status === 'failed') return 'destructive';
		if (status === 'pending') return 'secondary';
		return 'default';
	}

	function formatDate(value: string | undefined): string | undefined {
		if (!value) return undefined;
		const date = new Date(value);
		if (Number.isNaN(date.valueOf())) return undefined;
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
	}
</script>

<svelte:head><title>Profile · Shayfin</title></svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
	{#if loading}
		<div
			class="relative left-1/2 -mt-20 h-[clamp(28rem,62svh,40rem)] w-[100dvw] -translate-x-1/2 overflow-hidden bg-background"
		>
			<Skeleton class="absolute inset-0 size-full rounded-none" />
			<div
				class="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-background via-background/60 to-transparent"
			></div>
			<div
				class="relative mx-auto flex size-full max-w-[110rem] items-end px-4 pt-28 pb-8 sm:px-6 sm:pb-10 lg:px-8"
			>
				<div class="flex flex-col gap-4">
					<Skeleton class="size-24 rounded-full" />
					<Skeleton class="h-10 w-56" />
					<Skeleton class="h-5 w-72 max-w-[75vw]" />
				</div>
			</div>
		</div>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each [0, 1, 2, 3] as card (card)}<Skeleton class="h-28 w-full" />{/each}
		</div>
	{:else if error}
		<Alert variant="destructive">
			<AlertTitle>Profile unavailable</AlertTitle>
			<AlertDescription class="flex flex-wrap items-center justify-between gap-3">
				<span>{error}</span>
				<Button variant="outline" size="sm" onclick={() => loadProfile()}>
					<RotateCcwIcon data-icon="inline-start" />
					Try again
				</Button>
			</AlertDescription>
		</Alert>
	{:else if session.user}
		{#snippet profileAvatar()}
			{#if avatarAvailable}
				<button
					class="group/avatar-picker relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
					aria-label="Choose avatar"
					onclick={() => (avatarDialogOpen = true)}
				>
					<Avatar.Root class="size-24 sm:size-28">
						{#if currentAvatarUrl}<Avatar.Image src={currentAvatarUrl} alt="" />{/if}
						<Avatar.Fallback class="text-2xl"
							>{(session.user?.name ?? 'J').slice(0, 1).toUpperCase()}</Avatar.Fallback
						>
					</Avatar.Root>
					<span
						class="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 backdrop-blur-sm transition-opacity group-hover/avatar-picker:opacity-100 group-focus-visible/avatar-picker:opacity-100"
					>
						<ImageIcon />
						<span class="sr-only">Choose avatar</span>
					</span>
				</button>
			{:else}
				<Avatar.Root class="size-24 sm:size-28">
					{#if currentAvatarUrl}<Avatar.Image src={currentAvatarUrl} alt="" />{/if}
					<Avatar.Fallback class="text-2xl"
						>{(session.user?.name ?? 'J').slice(0, 1).toUpperCase()}</Avatar.Fallback
					>
				</Avatar.Root>
			{/if}
		{/snippet}

		{#snippet profileMetadata()}
			<Badge variant="secondary">{session.bootstrap?.jellyfin?.server.name ?? 'Jellyfin'}</Badge>
			{#if session.user?.isAdministrator}<Badge variant="outline">Administrator</Badge>{/if}
		{/snippet}

		<MediaHero
			title={session.user.name}
			backdropUrl={lastWatched?.backdropUrl ?? lastWatched?.imageUrl}
			tagline={lastWatched ? `Last watched · ${lastWatched.title}` : 'Your Jellyfin profile'}
			headingId="profile-title"
			beforeTitle={profileAvatar}
			metadata={profileMetadata}
		/>

		{#if achievements}
			<section aria-labelledby="achievement-summary" class="space-y-3">
				<div class="flex flex-wrap items-center gap-2">
					<h2 id="achievement-summary" class="text-lg font-medium tracking-tight">
						Achievement summary
					</h2>
					{#if achievementDegraded}<Badge variant="outline">Partial data</Badge>{/if}
				</div>
				{#if achievementScanSuggested}
					<Alert>
						<AlertTitle>Achievement history may need a scan</AlertTitle>
						<AlertDescription
							>Your profile has recent Jellyfin activity, but the plugin reports no progress. An
							administrator can run “Scan watch history” from the Achievement Badges plugin
							settings.</AlertDescription
						>
					</Alert>
				{/if}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Card.Root size="sm">
						<Card.Header
							><Card.Description>Badges unlocked</Card.Description><Card.Title class="text-2xl"
								>{achievements.summary.unlocked} / {achievements.summary.total}</Card.Title
							></Card.Header
						>
						<Card.Content
							><Progress
								value={achievements.summary.percentage}
								aria-label="Achievement completion"
							/></Card.Content
						>
					</Card.Root>
					<Card.Root size="sm">
						<Card.Header
							><Card.Description>Achievement score</Card.Description><Card.Title class="text-2xl"
								>{achievements.summary.score.toLocaleString()}</Card.Title
							></Card.Header
						>
					</Card.Root>
					<Card.Root size="sm">
						<Card.Header
							><Card.Description>Current watch streak</Card.Description><Card.Title class="text-2xl"
								>{achievements.summary.currentWatchStreak} days</Card.Title
							></Card.Header
						>
					</Card.Root>
					<Card.Root size="sm">
						<Card.Header
							><Card.Description>Equipped badges</Card.Description><Card.Title class="text-2xl"
								>{achievements.summary.equippedCount}</Card.Title
							></Card.Header
						>
					</Card.Root>
				</div>
				{#if recordStats.length}
					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						{#each recordStats as stat (stat.label)}
							<Card.Root size="sm">
								<Card.Header
									><Card.Description>{stat.label}</Card.Description><Card.Title
										>{stat.value.toLocaleString()}</Card.Title
									></Card.Header
								>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<Tabs.Root value="activity" class="gap-5">
			<div class="overflow-x-auto pb-1">
				<Tabs.List>
					<Tabs.Trigger value="activity"
						><Clock3Icon data-icon="inline-start" />Activity</Tabs.Trigger
					>
					<Tabs.Trigger value="favorites"
						><HeartIcon data-icon="inline-start" />Favorites</Tabs.Trigger
					>
					{#if requestsAvailable}<Tabs.Trigger value="requests"
							><InboxIcon data-icon="inline-start" />Requests</Tabs.Trigger
						>{/if}
					{#if achievements}<Tabs.Trigger value="achievements"
							><TrophyIcon data-icon="inline-start" />Achievements</Tabs.Trigger
						>{/if}
				</Tabs.List>
			</div>

			<Tabs.Content value="activity">
				{#if recentlyPlayed.length}
					<MediaRail
						section={{
							id: 'profile-recent',
							title: 'Recently played',
							items: recentlyPlayed,
							variant: 'landscape'
						}}
					/>
				{:else}
					<Empty.Root class="border border-border">
						<Empty.Header
							><Empty.Media variant="icon"><Clock3Icon /></Empty.Media><Empty.Title
								>No recent activity</Empty.Title
							><Empty.Description>Items you finish will appear here.</Empty.Description
							></Empty.Header
						>
					</Empty.Root>
				{/if}
			</Tabs.Content>

			<Tabs.Content value="favorites">
				{#if favorites.length}
					<MediaRail
						section={{
							id: 'profile-favorites',
							title: 'Favorites',
							items: favorites,
							variant: 'portrait'
						}}
					/>
				{:else}
					<Empty.Root class="border border-border">
						<Empty.Header
							><Empty.Media variant="icon"><HeartIcon /></Empty.Media><Empty.Title
								>No favorites yet</Empty.Title
							><Empty.Description
								>Favorite a movie, series, or episode in Jellyfin to keep it close.</Empty.Description
							></Empty.Header
						>
					</Empty.Root>
				{/if}
			</Tabs.Content>

			{#if requestsAvailable}
				<Tabs.Content value="requests">
					{#if requests.length}
						<div class="grid gap-3 md:grid-cols-2">
							{#each requests as request (request.id)}
								<Card.Root size="sm">
									<Card.Header>
										<Card.Title>{requestLabel(request)}</Card.Title>
										<Card.Description>
											{request.is4k ? '4K request' : 'Standard request'}{formatDate(
												request.createdAt
											)
												? ` · ${formatDate(request.createdAt)}`
												: ''}
										</Card.Description>
										<Card.Action
											><Badge variant={requestBadgeVariant(request.status)}>{request.status}</Badge
											></Card.Action
										>
									</Card.Header>
									{#if request.mediaType === 'tv' && request.seasons.length}
										<Card.Content class="text-sm text-muted-foreground"
											>Seasons {request.seasons.join(', ')}</Card.Content
										>
									{/if}
								</Card.Root>
							{/each}
						</div>
					{:else}
						<Empty.Root class="border border-border">
							<Empty.Header
								><Empty.Media variant="icon"><InboxIcon /></Empty.Media><Empty.Title
									>No requests yet</Empty.Title
								><Empty.Description>Your Seerr request history will appear here.</Empty.Description
								></Empty.Header
							>
						</Empty.Root>
					{/if}
				</Tabs.Content>
			{/if}

			{#if achievements}
				<Tabs.Content value="achievements" class="space-y-5">
					<section class="space-y-3">
						<div>
							<h2 class="text-lg font-medium tracking-tight">In progress</h2>
							<p class="text-sm text-muted-foreground">
								Progress is credited by Achievement Badges as you watch in Jellyfin.
							</p>
						</div>
						{#if inProgressBadges.length}
							<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{#each inProgressBadges.slice(0, 12) as badge (badge.id)}
									<Card.Root size="sm">
										<Card.Header>
											<Card.Title>{badge.title}</Card.Title>
											<Card.Description>{badge.description}</Card.Description>
											<Card.Action><Badge variant="outline">{badge.category}</Badge></Card.Action>
										</Card.Header>
										<Card.Content class="space-y-2">
											<Progress
												value={badgeProgress(badge)}
												aria-label={`${badge.title} progress`}
											/>
											<p class="text-xs text-muted-foreground">
												{badge.currentValue.toLocaleString()} of {badge.targetValue.toLocaleString()}
											</p>
										</Card.Content>
									</Card.Root>
								{/each}
							</div>
						{:else}<p class="text-sm text-muted-foreground">
								No achievements are currently in progress.
							</p>{/if}
					</section>

					{#if achievements.equipped.length}
						<section class="space-y-3">
							<h2 class="text-lg font-medium tracking-tight">Equipped badges</h2>
							<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{#each achievements.equipped as badge (badge.id)}
									<Card.Root size="sm">
										<Card.Header
											><Card.Title class="flex items-center gap-2"
												><BadgeCheckIcon />{badge.title}</Card.Title
											><Card.Description>{badge.description}</Card.Description></Card.Header
										>
										<Card.Content><Badge variant="outline">{badge.rarity}</Badge></Card.Content>
									</Card.Root>
								{/each}
							</div>
						</section>
					{/if}

					<section class="space-y-3">
						<h2 class="text-lg font-medium tracking-tight">Unlocked</h2>
						{#if unlockedBadges.length}
							<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{#each unlockedBadges as badge (badge.id)}
									<Card.Root size="sm">
										<Card.Header
											><Card.Title class="flex items-center gap-2"
												><SparklesIcon />{badge.title}</Card.Title
											><Card.Description>{badge.description}</Card.Description></Card.Header
										>
										<Card.Content class="flex flex-wrap items-center gap-2"
											><Badge variant="outline">{badge.rarity}</Badge>{#if badge.unlockedAt}<span
													class="text-xs text-muted-foreground">{formatDate(badge.unlockedAt)}</span
												>{/if}</Card.Content
										>
									</Card.Root>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-muted-foreground">
								No badges unlocked yet. Your progress is shown above.
							</p>
						{/if}
					</section>
				</Tabs.Content>
			{/if}
		</Tabs.Root>
	{/if}
</div>

<Dialog.Root bind:open={avatarDialogOpen}>
	<Dialog.Content class="sm:max-w-3xl">
		<Dialog.Header>
			<Dialog.Title>Choose an avatar</Dialog.Title>
			<Dialog.Description
				>Available avatars are supplied by GetAvatar for this Jellyfin server.</Dialog.Description
			>
		</Dialog.Header>
		<div class="flex max-h-[65vh] flex-col gap-7 overflow-y-auto pr-1">
			{#each avatarCategories as [category, categoryAvatars] (category)}
				<section class="flex flex-col gap-3" aria-labelledby={`avatar-category-${category}`}>
					<h2 id={`avatar-category-${category}`} class="text-sm font-medium text-muted-foreground">
						{category}
					</h2>
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
						{#each categoryAvatars as avatar (avatar.id)}
							<Button
								variant="ghost"
								class="h-auto min-w-0 flex-col gap-3 p-3"
								disabled={changingAvatar !== null}
								onclick={() => setAvatar(avatar)}
							>
								<Avatar.Root class="size-24 sm:size-28">
									<Avatar.Image src={avatar.imageUrl} alt="" />
									<Avatar.Fallback class="text-xl">{avatar.name.slice(0, 1)}</Avatar.Fallback>
								</Avatar.Root>
								<span class="w-full truncate text-sm">{avatar.name}</span>
							</Button>
						{/each}
					</div>
				</section>
			{/each}
		</div>
		<Dialog.Footer
			><Button variant="outline" onclick={() => (avatarDialogOpen = false)}>Close</Button
			></Dialog.Footer
		>
	</Dialog.Content>
</Dialog.Root>
