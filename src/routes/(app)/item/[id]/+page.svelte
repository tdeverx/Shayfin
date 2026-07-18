<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
	import { getUserLibraryApi } from '@jellyfin/sdk/lib/utils/api/user-library-api.js';
	import {
		loadItemDetail,
		loadSeriesDetail,
		loadThemeSongs,
		type SeriesDetail
	} from '$lib/jellyfin';
	import {
		backdropForItem,
		formatRuntime,
		imageForItem,
		itemProgress,
		itemSecondary,
		logoForItem,
		posterForItem
	} from '$lib/app/media';
	import { session } from '$lib/app/session.svelte';
	import { themeAudio } from '$lib/app/theme-audio';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import MediaHero from '$lib/components/app/media-hero.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import { toast } from 'svelte-sonner';

	let item = $state<BaseItemDto | null>(null);
	let series = $state<SeriesDetail | null>(null);
	let selectedSeason = $state('');
	let loading = $state(true);
	let error = $state<string | null>(null);
	let favorite = $state(false);
	let themeUrl = $state<string | null>(null);
	let loadGeneration = 0;
	let retryThemeOnInteraction: (() => void) | null = null;

	let backdropUrl = $derived.by(() => {
		const api = session.api;
		if (!api || !item?.Id) return undefined;
		return backdropForItem(api, item, 1800);
	});
	let posterUrl = $derived(session.api && item ? posterForItem(session.api, item, 560) : undefined);
	let logoUrl = $derived(session.api && item ? logoForItem(session.api, item, 720) : undefined);
	let episodes = $derived(series?.episodesBySeason[selectedSeason] ?? []);
	let playable = $derived.by(() => {
		if (!item) return null;
		if (item.Type !== 'Series') return item;
		const allEpisodes = series?.seasons.flatMap((season) =>
			season.Id ? (series?.episodesBySeason[season.Id] ?? []) : []
		);
		return (
			allEpisodes?.find((episode) => (episode.UserData?.PlaybackPositionTicks ?? 0) > 0) ??
			allEpisodes?.find((episode) => !episode.UserData?.Played) ??
			allEpisodes?.[0] ??
			null
		);
	});

	async function load(itemId: string) {
		const api = session.api;
		const userId = session.user?.id;
		if (!api || !userId || !itemId) return;
		const generation = ++loadGeneration;
		loading = true;
		error = null;
		item = null;
		series = null;
		selectedSeason = '';
		themeUrl = null;
		try {
			const detail = await loadItemDetail(api, userId, itemId);
			let seriesDetail: SeriesDetail | null = null;
			if (detail.Type === 'Series' && detail.Id) {
				seriesDetail = await loadSeriesDetail(api, userId, detail.Id);
			}
			let nextThemeUrl: string | null = null;
			if (detail.Id) {
				const songs = await loadThemeSongs(api, detail.Id, userId).catch(() => []);
				nextThemeUrl = songs[0]?.streamUrl ?? null;
			}
			if (generation !== loadGeneration) return;
			item = detail;
			favorite = detail.UserData?.IsFavorite === true;
			series = seriesDetail;
			selectedSeason = seriesDetail?.seasons.find((season) => season.Id)?.Id ?? '';
			themeUrl = nextThemeUrl;
		} catch (reason) {
			if (generation === loadGeneration) {
				error = reason instanceof Error ? reason.message : 'This item could not be loaded.';
			}
		} finally {
			if (generation === loadGeneration) loading = false;
		}
	}

	async function toggleFavorite() {
		if (!session.api || !session.user?.id || !item?.Id) return;
		try {
			const library = getUserLibraryApi(session.api);
			if (favorite) {
				await library.unmarkFavoriteItem({ itemId: item.Id, userId: session.user.id });
			} else {
				await library.markFavoriteItem({ itemId: item.Id, userId: session.user.id });
			}
			favorite = !favorite;
			toast.success(favorite ? 'Added to favorites.' : 'Removed from favorites.');
		} catch {
			toast.error('Your favorite could not be updated.');
		}
	}

	function goBack() {
		if (history.length > 1) history.back();
		else void goto(resolve('/home'));
	}

	async function playTheme(url: string) {
		if (!session.themeAudioEnabled || url !== themeUrl) return;
		try {
			await themeAudio.play(url);
		} catch {
			if (!retryThemeOnInteraction) {
				retryThemeOnInteraction = () => {
					retryThemeOnInteraction = null;
					void playTheme(url);
				};
				document.addEventListener('pointerdown', retryThemeOnInteraction, { once: true });
			}
		}
	}

	$effect(() => {
		const itemId = page.params.id;
		if (itemId) void load(itemId);
	});

	$effect(() => {
		const url = themeUrl;
		if (session.themeAudioEnabled && url) queueMicrotask(() => void playTheme(url));
		else themeAudio.fadeAndStop();
	});

	onDestroy(() => {
		if (retryThemeOnInteraction)
			document.removeEventListener('pointerdown', retryThemeOnInteraction);
		themeAudio.fadeAndStop();
	});
</script>

<svelte:head><title>{item?.Name ?? 'Details'} · Shayfin</title></svelte:head>

{#if loading}
	<div class="space-y-6">
		<Skeleton class="h-[28rem] w-full rounded-4xl" />
		<Skeleton class="h-8 w-64" />
	</div>
{:else if error || !item}
	<Empty.Root class="min-h-[24rem] border border-border">
		<Empty.Header>
			<Empty.Title>That title is unavailable</Empty.Title>
			<Empty.Description>{error ?? 'Jellyfin did not return this item.'}</Empty.Description>
		</Empty.Header>
		<Empty.Content><Button href={resolve('/home')}>Back home</Button></Empty.Content>
	</Empty.Root>
{:else}
	<article class="flex flex-col gap-8">
		{#snippet topAction()}
			<Button variant="secondary" size="sm" onclick={goBack} aria-label="Back to previous page">
				<ArrowLeftIcon data-icon="inline-start" />
				Back
			</Button>
		{/snippet}

		{#snippet metadata()}
			<Badge>{item?.Type ?? 'Video'}</Badge>
			{#if item?.ProductionYear}<Badge variant="secondary">{item.ProductionYear}</Badge>{/if}
			{#if item?.OfficialRating}<span>{item.OfficialRating}</span>{/if}
			{#if formatRuntime(item?.RunTimeTicks)}<span>{formatRuntime(item?.RunTimeTicks)}</span>{/if}
		{/snippet}

		{#snippet actions()}
			{#if playable?.Id}
				<Button href={resolve('/(app)/watch/[id]', { id: playable.Id })}>
					{#if (playable.UserData?.PlaybackPositionTicks ?? 0) > 0}
						<RotateCcwIcon data-icon="inline-start" />Resume
					{:else}
						<PlayIcon data-icon="inline-start" />Play
					{/if}
				</Button>
			{/if}
			<Button variant="secondary" onclick={toggleFavorite}>
				<HeartIcon data-icon="inline-start" />
				{favorite ? 'Favorited' : 'Favorite'}
			</Button>
		{/snippet}

		<MediaHero
			title={item.Name ?? 'Untitled'}
			{backdropUrl}
			{logoUrl}
			description={item.Overview}
			tagline={item.Taglines?.[0]}
			{posterUrl}
			headingId="item-title"
			{metadata}
			{actions}
			{topAction}
		/>

		{#if series && series.seasons.length > 0}
			<section class="space-y-4" aria-labelledby="episodes-heading">
				<div class="flex flex-wrap items-center justify-between gap-4">
					<h2 id="episodes-heading" class="text-2xl font-semibold tracking-tight">Episodes</h2>
					<Tabs.Root bind:value={selectedSeason}>
						<Tabs.List>
							{#each series.seasons as season (season.Id ?? season.IndexNumber ?? season.Name)}
								{#if season.Id}<Tabs.Trigger value={season.Id}
										>{season.Name ?? `Season ${season.IndexNumber ?? ''}`}</Tabs.Trigger
									>{/if}
							{/each}
						</Tabs.List>
					</Tabs.Root>
				</div>
				<div class="grid gap-3 lg:grid-cols-2">
					{#each episodes as episode (episode.Id)}
						<a
							href={episode.Id ? resolve('/(app)/item/[id]', { id: episode.Id }) : '#'}
							class="group flex min-w-0 gap-4 rounded-4xl border border-border bg-card p-3 transition-colors hover:bg-accent"
						>
							<div class="aspect-video w-36 shrink-0 overflow-hidden rounded-3xl bg-muted sm:w-44">
								{#if session.api && imageForItem(session.api, episode, 420)}<img
										src={imageForItem(session.api, episode, 420)}
										alt=""
										class="size-full object-cover"
									/>{/if}
							</div>
							<div class="min-w-0 flex-1 py-1">
								<strong class="block truncate"
									>{episode.IndexNumber != null
										? `${episode.IndexNumber}. `
										: ''}{episode.Name}</strong
								>
								<small class="text-muted-foreground"
									>{itemSecondary(episode)}{formatRuntime(episode.RunTimeTicks)
										? ` · ${formatRuntime(episode.RunTimeTicks)}`
										: ''}</small
								>
								{#if episode.Overview}<p class="mt-2 line-clamp-2 text-sm text-muted-foreground">
										{episode.Overview}
									</p>{/if}
								{#if itemProgress(episode) !== undefined}<div
										class="mt-3 h-1 overflow-hidden rounded-full bg-muted"
									>
										<div class="h-full bg-primary" style={`width:${itemProgress(episode)}%`}></div>
									</div>{/if}
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
			<Card>
				<CardHeader><CardTitle>Media information</CardTitle></CardHeader>
				<CardContent class="space-y-4">
					{#each item.MediaSources ?? [] as source, index (source.Id ?? index)}
						{@const videoStream = source.MediaStreams?.find((stream) => stream.Type === 'Video')}
						{@const audioStreams =
							source.MediaStreams?.filter((stream) => stream.Type === 'Audio') ?? []}
						{@const subtitleStreams =
							source.MediaStreams?.filter((stream) => stream.Type === 'Subtitle') ?? []}
						{#if index > 0}<Separator />{/if}
						<div class="space-y-1">
							<strong>{source.Name ?? `Version ${index + 1}`}</strong>
							<p class="text-sm text-muted-foreground">
								{[source.Container?.toUpperCase(), videoStream?.DisplayTitle]
									.filter(Boolean)
									.join(' · ') || 'Media details unavailable'}
							</p>
							{#if audioStreams.length}<p class="text-sm text-muted-foreground">
									<span class="text-foreground">Audio:</span>
									{audioStreams
										.map((stream) => stream.DisplayTitle ?? stream.Title ?? stream.Language)
										.filter(Boolean)
										.join(', ')}
								</p>{/if}
							{#if subtitleStreams.length}<p class="text-sm text-muted-foreground">
									<span class="text-foreground">Subtitles:</span>
									{subtitleStreams
										.map((stream) => stream.DisplayTitle ?? stream.Title ?? stream.Language)
										.filter(Boolean)
										.join(', ')}
								</p>{/if}
						</div>
					{/each}
					{#if !item.MediaSources?.length}<p class="text-sm text-muted-foreground">
							Playback details will be negotiated when you press play.
						</p>{/if}
				</CardContent>
			</Card>
			<Card>
				<CardHeader><CardTitle>About</CardTitle></CardHeader>
				<CardContent class="space-y-3 text-sm text-muted-foreground">
					{#if item.Genres?.length}<p>
							<strong class="text-foreground">Genres</strong><br />{item.Genres.join(', ')}
						</p>{/if}
					{#if item.Studios?.length}<p>
							<strong class="text-foreground">Studio</strong><br />{item.Studios.map(
								(studio) => studio.Name
							)
								.filter(Boolean)
								.join(', ')}
						</p>{/if}
					{#if item.PremiereDate}<p>
							<strong class="text-foreground">Released</strong><br />{new Date(
								item.PremiereDate
							).toLocaleDateString()}
						</p>{/if}
				</CardContent>
			</Card>
		</div>
	</article>
{/if}
