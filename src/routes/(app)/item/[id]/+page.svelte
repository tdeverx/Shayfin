<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onDestroy, untrack } from 'svelte';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
	import { getUserLibraryApi } from '@jellyfin/sdk/lib/utils/api/user-library-api.js';
	import {
		loadItemDetail,
		loadEpisodes,
		loadSeriesDetail,
		loadSeriesNextUp,
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
	import {
		itemEntityKey,
		readCache,
		readEntity,
		upsertEntity,
		userCacheKey,
		writeCache
	} from '$lib/app/data-cache';
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
	let playableEpisode = $state<BaseItemDto | null>(null);
	let loadingEpisodes = $state(false);
	let loadGeneration = 0;
	let retryThemeOnInteraction: (() => void) | null = null;
	let detailCacheKey = '';
	const DETAIL_CACHE_MS = 2 * 60_000;

	interface DetailCacheData {
		item: BaseItemDto;
		series: SeriesDetail | null;
		themeUrl: string | null;
	}

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
		return playableEpisode;
	});

	function applyDetail(snapshot: DetailCacheData) {
		item = snapshot.item;
		favorite = snapshot.item.UserData?.IsFavorite === true;
		series = snapshot.series;
		selectedSeason = snapshot.series?.seasons.find((season) => season.Id)?.Id ?? '';
		themeUrl = snapshot.themeUrl;
	}

	async function load(itemId: string) {
		const api = session.api;
		const userId = session.user?.id;
		if (!api || !userId || !itemId) return;
		const generation = ++loadGeneration;
		themeAudio.fadeAndStop();
		playableEpisode = null;
		series = null;
		selectedSeason = '';
		themeUrl = null;
		favorite = false;
		error = null;
		loadingEpisodes = false;
		detailCacheKey = userCacheKey(
			session.bootstrap?.jellyfin?.server.id,
			userId,
			`detail:${itemId}`
		);
		const entityKey = itemEntityKey(session.bootstrap?.jellyfin?.server.id, userId, itemId);
		const cached = readCache<DetailCacheData>(detailCacheKey, DETAIL_CACHE_MS);
		if (cached) {
			applyDetail(cached.value);
			loading = false;
			if (!cached.stale) return;
		}
		if (!cached) {
			const previewEntity = readEntity<BaseItemDto>(entityKey);
			item = previewEntity?.value ?? null;
			favorite = previewEntity?.value.UserData?.IsFavorite === true;
			loading = true;
		}
		try {
			const detail = await loadItemDetail(api, userId, itemId);
			if (generation !== loadGeneration) return;
			const snapshot = { item: detail, series: null, themeUrl: null };
			applyDetail(snapshot);
			upsertEntity(entityKey, detail);
			writeCache(detailCacheKey, snapshot);
			loading = false;

			// Everything below this point enriches the detail page. It must not hide
			// an already usable hero behind a full-page skeleton.
			if (detail.Type === 'Series' && detail.Id) {
				void Promise.all([
					loadSeriesDetail(api, userId, detail.Id),
					loadSeriesNextUp(api, userId, detail.Id)
				]).then(([seriesDetail, nextEpisode]) => {
					if (generation !== loadGeneration || !item) return;
					series = seriesDetail;
					selectedSeason = seriesDetail.seasons.find((season) => season.Id)?.Id ?? '';
					playableEpisode = nextEpisode;
					writeCache(detailCacheKey, { item, series, themeUrl } satisfies DetailCacheData);
				});
			}
			if (detail.Id) {
				void loadThemeSongs(api, detail.Id, userId)
					.then((songs) => {
						if (generation !== loadGeneration || !item) return;
						themeUrl = songs[0]?.streamUrl ?? null;
						writeCache(detailCacheKey, { item, series, themeUrl } satisfies DetailCacheData);
					})
					.catch(() => undefined);
			}
		} catch (reason) {
			if (!cached && generation === loadGeneration) {
				error = reason instanceof Error ? reason.message : 'This item could not be loaded.';
			}
		} finally {
			if (generation === loadGeneration) loading = false;
		}
	}

	async function loadSelectedSeason(seriesId: string, seasonId: string) {
		if (!session.api || !session.user?.id || !series || series.episodesBySeason[seasonId]) return;
		loadingEpisodes = true;
		try {
			const loaded = await loadEpisodes(session.api, session.user.id, seriesId, seasonId);
			series = {
				...series,
				episodesBySeason: { ...series.episodesBySeason, [seasonId]: loaded }
			};
			for (const episode of loaded) {
				if (episode.Id)
					upsertEntity(
						itemEntityKey(session.bootstrap?.jellyfin?.server.id, session.user.id, episode.Id),
						episode
					);
			}
			if (detailCacheKey && item)
				writeCache(detailCacheKey, { item, series, themeUrl } satisfies DetailCacheData);
		} catch {
			toast.error('Episodes for this season could not be loaded.');
		} finally {
			loadingEpisodes = false;
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
			if (item?.UserData) item = { ...item, UserData: { ...item.UserData, IsFavorite: favorite } };
			if (item?.Id)
				upsertEntity(
					itemEntityKey(session.bootstrap?.jellyfin?.server.id, session.user.id, item.Id),
					item
				);
			if (detailCacheKey && item)
				writeCache(detailCacheKey, { item, series, themeUrl } satisfies DetailCacheData);
			toast.success(favorite ? 'Added to favorites.' : 'Removed from favorites.');
		} catch {
			toast.error('Your favorite could not be updated.');
		}
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
		untrack(() => {
			if (itemId) void load(itemId);
		});
	});

	$effect(() => {
		const seriesId = item?.Type === 'Series' ? item.Id : undefined;
		const seasonId = selectedSeason;
		untrack(() => {
			if (seriesId && seasonId) void loadSelectedSeason(seriesId, seasonId);
		});
	});

	$effect(() => {
		const url = themeUrl;
		untrack(() => {
			if (session.themeAudioEnabled && url) queueMicrotask(() => void playTheme(url));
			else themeAudio.fadeAndStop();
		});
	});

	onDestroy(() => {
		if (retryThemeOnInteraction)
			document.removeEventListener('pointerdown', retryThemeOnInteraction);
		themeAudio.fadeAndStop();
	});
</script>

<svelte:head><title>{item?.Name ?? 'Details'} · Shayfin</title></svelte:head>

{#if loading && !item}
	<div class="flex flex-col gap-8">
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
				<div class="flex w-full max-w-2xl flex-col gap-4">
					<Skeleton class="h-20 w-72 max-w-[75vw]" />
					<div class="flex gap-2">
						<Skeleton class="h-6 w-16" /><Skeleton class="h-6 w-14" /><Skeleton class="h-6 w-12" />
					</div>
					<Skeleton class="h-4 w-full max-w-xl" />
					<Skeleton class="h-4 w-4/5 max-w-lg" />
					<div class="flex gap-2">
						<Skeleton class="h-9 w-24" /><Skeleton class="h-9 w-28" />
					</div>
				</div>
			</div>
		</div>
		<div class="flex flex-col gap-4">
			<Skeleton class="h-8 w-40" />
			<Skeleton class="h-28 w-full" />
		</div>
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

		<div>
			<MediaHero
				title={item.Name ?? 'Untitled'}
				{backdropUrl}
				{logoUrl}
				description={item.Overview}
				tagline={item.Taglines?.[0]}
				headingId="item-title"
				{metadata}
				{actions}
			/>
		</div>

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
				{#if loadingEpisodes && episodes.length === 0}
					<div class="grid gap-3 lg:grid-cols-2">
						{#each [0, 1, 2, 3] as index (index)}
							<Skeleton class="h-32 rounded-4xl" />
						{/each}
					</div>
				{:else}<div class="grid gap-3 lg:grid-cols-2">
						{#each episodes as episode (episode.Id)}
							<a
								href={episode.Id ? resolve('/(app)/item/[id]', { id: episode.Id }) : '#'}
								class="group flex min-w-0 gap-4 rounded-4xl border border-border bg-card p-3 transition-colors hover:bg-accent"
							>
								<div
									class="aspect-video w-36 shrink-0 overflow-hidden rounded-3xl bg-muted sm:w-44"
								>
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
											<div
												class="h-full bg-primary"
												style={`width:${itemProgress(episode)}%`}
											></div>
										</div>{/if}
								</div>
							</a>
						{/each}
					</div>{/if}
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
				<CardContent class="flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row">
					{#if posterUrl}
						<img
							src={posterUrl}
							alt={`${item.Name ?? 'Media'} poster`}
							class="aspect-[2/3] w-32 shrink-0 rounded-4xl object-cover"
						/>
					{/if}
					<div class="flex min-w-0 flex-col gap-3">
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
					</div>
				</CardContent>
			</Card>
		</div>
	</article>
{/if}
