<script lang="ts">
	import { onMount } from 'svelte';
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
	import { toMediaCard } from '$lib/app/media';
	import type { MediaCardModel } from '$lib/app/models';
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

	onMount(loadProfile);

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

	async function loadProfile() {
		loading = true;
		error = null;
		try {
			await session.initialize();
			const api = session.api;
			const user = session.user;
			if (!api || !user) throw new Error('Your Jellyfin session is not available.');

			currentAvatarUrl = authenticatedImage(user.imageUrl);
			const achievementsAdapter = new AchievementBadgesAdapter(api);
			avatarAdapter = new GetAvatarAdapter(api);
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
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Your profile could not be loaded.';
		} finally {
			loading = false;
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

<div class="mx-auto w-full max-w-7xl space-y-6">
	{#if loading}
		<Card.Root>
			<Card.Content class="flex items-center gap-5">
				<Skeleton class="size-20 rounded-full" />
				<div class="flex-1 space-y-2">
					<Skeleton class="h-7 w-40" />
					<Skeleton class="h-4 w-60 max-w-full" />
				</div>
			</Card.Content>
		</Card.Root>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each [0, 1, 2, 3] as card (card)}<Skeleton class="h-28 w-full" />{/each}
		</div>
	{:else if error}
		<Alert variant="destructive">
			<AlertTitle>Profile unavailable</AlertTitle>
			<AlertDescription class="flex flex-wrap items-center justify-between gap-3">
				<span>{error}</span>
				<Button variant="outline" size="sm" onclick={loadProfile}>
					<RotateCcwIcon data-icon="inline-start" />
					Try again
				</Button>
			</AlertDescription>
		</Alert>
	{:else if session.user}
		<Card.Root>
			<Card.Content class="flex flex-col gap-5 sm:flex-row sm:items-center">
				<Avatar.Root class="size-20">
					{#if currentAvatarUrl}<Avatar.Image src={currentAvatarUrl} alt="" />{/if}
					<Avatar.Fallback class="text-xl"
						>{session.user.name.slice(0, 1).toUpperCase()}</Avatar.Fallback
					>
				</Avatar.Root>
				<div class="min-w-0 flex-1 space-y-1">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="truncate text-3xl font-semibold tracking-tight">{session.user.name}</h1>
						{#if session.user.isAdministrator}<Badge variant="secondary">Administrator</Badge>{/if}
					</div>
					<p class="text-sm text-muted-foreground">
						{session.bootstrap?.jellyfin?.server.name ?? 'Jellyfin'} account
					</p>
				</div>
				{#if avatarAvailable}
					<Button variant="outline" onclick={() => (avatarDialogOpen = true)}>
						<ImageIcon data-icon="inline-start" />
						Choose avatar
					</Button>
				{/if}
			</Card.Content>
		</Card.Root>

		{#if achievements}
			<section aria-labelledby="achievement-summary" class="space-y-3">
				<div class="flex flex-wrap items-center gap-2">
					<h2 id="achievement-summary" class="text-lg font-medium tracking-tight">
						Achievement summary
					</h2>
					{#if achievementDegraded}<Badge variant="outline">Partial data</Badge>{/if}
				</div>
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
						<h2 class="text-lg font-medium tracking-tight">Recent unlocks</h2>
						{#if achievements.recent.length}
							<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{#each achievements.recent as badge (badge.id)}
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
							<p class="text-sm text-muted-foreground">No recent badge unlocks.</p>
						{/if}
					</section>
				</Tabs.Content>
			{/if}
		</Tabs.Root>
	{/if}
</div>

<Dialog.Root bind:open={avatarDialogOpen}>
	<Dialog.Content class="sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Choose an avatar</Dialog.Title>
			<Dialog.Description
				>Available avatars are supplied by GetAvatar for this Jellyfin server.</Dialog.Description
			>
		</Dialog.Header>
		<div
			class="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4"
		>
			{#each avatars as avatar (avatar.id)}
				<Button
					variant="outline"
					class="h-auto min-w-0 flex-col gap-2 p-2"
					disabled={changingAvatar !== null}
					onclick={() => setAvatar(avatar)}
				>
					<Avatar.Root size="lg"
						><Avatar.Image src={avatar.imageUrl} alt="" /><Avatar.Fallback
							>{avatar.name.slice(0, 1)}</Avatar.Fallback
						></Avatar.Root
					>
					<span class="w-full truncate text-xs">{avatar.name}</span>
				</Button>
			{/each}
		</div>
		<Dialog.Footer
			><Button variant="outline" onclick={() => (avatarDialogOpen = false)}>Close</Button
			></Dialog.Footer
		>
	</Dialog.Content>
</Dialog.Root>
