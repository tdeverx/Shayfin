<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import FilmIcon from '@lucide/svelte/icons/film';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import SearchIcon from '@lucide/svelte/icons/search';
	import TvIcon from '@lucide/svelte/icons/tv';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
	import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind.js';
	import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields.js';
	import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by.js';
	import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order.js';
	import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api.js';
	import { toMediaCard } from '$lib/app/media';
	import { session } from '$lib/app/session.svelte';
	import { headerContext } from '$lib/app/header-context.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import * as Field from '$lib/components/ui/field';
	import * as InputGroup from '$lib/components/ui/input-group';
	import * as Select from '$lib/components/ui/select';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import {
		itemEntityKey,
		readEntity,
		readQuery,
		upsertEntity,
		userCacheKey,
		writeQuery
	} from '$lib/app/data-cache';
	import MediaCard from './media-card.svelte';

	type LibraryKind = 'movies' | 'series';
	type LibraryFilter = 'all' | 'unplayed' | 'favorites';
	type LibrarySort = 'title' | 'recent' | 'year';

	let { kind }: { kind: LibraryKind } = $props();

	const config = $derived(
		kind === 'movies'
			? {
					title: 'Movies',
					viewType: 'movies' as const,
					itemType: BaseItemKind.Movie,
					countLabel: 'titles',
					yearLabel: 'Release year',
					unavailable: 'Movies are unavailable',
					emptyMatch: 'No matching movies',
					emptyLibrary: 'No movie libraries found',
					emptyDescription:
						'Movies will appear here when this Jellyfin user can access a movie library.',
					searchPlaceholder: 'Search movies or genres',
					loadError: 'Movies could not be loaded.'
				}
			: {
					title: 'Shows',
					viewType: 'series' as const,
					itemType: BaseItemKind.Series,
					countLabel: 'series',
					yearLabel: 'First aired',
					unavailable: 'Shows are unavailable',
					emptyMatch: 'No matching shows',
					emptyLibrary: 'No show libraries found',
					emptyDescription:
						'Series will appear here when this Jellyfin user can access a television library.',
					searchPlaceholder: 'Search shows or genres',
					loadError: 'Shows could not be loaded.'
				}
	);

	let items = $state<BaseItemDto[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let query = $state('');
	let filter = $state<LibraryFilter>('all');
	let sort = $state<LibrarySort>('title');
	const LIBRARY_CACHE_MS = 5 * 60_000;
	const PAGE_SIZE = 60;
	let totalRecordCount = $state<number | undefined>();
	let hasMore = $state(false);
	let loadingMore = $state(false);
	let mounted = $state(false);
	let requestGeneration = 0;
	let pageIndex = 0;

	let cards = $derived(
		session.api
			? items
					.map((item) => toMediaCard(session.api!, item, 'portrait'))
					.filter((item) => item !== null)
			: []
	);
	let countDescription = $derived(
		loading || error
			? `Refine your ${config.countLabel}.`
			: totalRecordCount !== undefined
				? `${cards.length} of ${totalRecordCount} ${config.countLabel}`
				: `${cards.length} ${config.countLabel}`
	);

	$effect(() => {
		headerContext.hasActiveFilters =
			query.trim().length > 0 || filter !== 'all' || sort !== 'title';
		return () => {
			headerContext.hasActiveFilters = false;
		};
	});

	onMount(async () => {
		await session.initialize();
		mounted = true;
	});

	$effect(() => {
		if (!mounted) return;
		const signature = `${query.trim()}:${filter}:${sort}`;
		const timer = setTimeout(() => void resetAndLoad(signature), query.trim() ? 250 : 0);
		return () => clearTimeout(timer);
	});

	function currentQueryKey(userId: string): string {
		return userCacheKey(
			session.bootstrap?.jellyfin?.server.id,
			userId,
			`library:${kind}:${query.trim().toLocaleLowerCase()}:${filter}:${sort}`
		);
	}

	async function resetAndLoad(signature = `${query.trim()}:${filter}:${sort}`) {
		if (signature !== `${query.trim()}:${filter}:${sort}`) return;
		const userId = session.user?.id;
		if (!userId) return void loadPage(true);
		const cacheKey = currentQueryKey(userId);
		const cached = readQuery(cacheKey, LIBRARY_CACHE_MS);
		if (cached) {
			items = cached.value.itemIds.flatMap((id) => {
				const entity = readEntity<BaseItemDto>(
					itemEntityKey(session.bootstrap?.jellyfin?.server.id, userId, id)
				);
				return entity ? [entity.value] : [];
			});
			totalRecordCount = cached.value.totalRecordCount;
			hasMore = cached.value.hasMore;
			loading = false;
			pageIndex = Math.ceil(cached.value.startIndex / PAGE_SIZE);
			if (!cached.stale) return;
		}
		await loadPage(true, Boolean(cached));
	}

	async function loadPage(reset = false, background = false) {
		if (!reset && (loadingMore || !hasMore)) return;
		if (reset) {
			requestGeneration += 1;
			pageIndex = 0;
			loadingMore = false;
			if (!background) loading = true;
		} else loadingMore = true;
		const generation = requestGeneration;
		error = null;
		try {
			await session.initialize();
			const api = session.api;
			const userId = session.user?.id;
			if (!api || !userId) throw new Error('Your Jellyfin session is not available.');
			const sortBy =
				sort === 'recent'
					? ItemSortBy.DateCreated
					: sort === 'year'
						? ItemSortBy.ProductionYear
						: ItemSortBy.SortName;
			const response = await getItemsApi(api).getItems({
				userId,
				recursive: true,
				includeItemTypes: [config.itemType],
				fields: [ItemFields.DateCreated, ItemFields.Genres, ItemFields.ProviderIds],
				sortBy: [sortBy],
				sortOrder: [sort === 'title' ? SortOrder.Ascending : SortOrder.Descending],
				searchTerm: query.trim() || undefined,
				isPlayed: filter === 'unplayed' ? false : undefined,
				isFavorite: filter === 'favorites' ? true : undefined,
				startIndex: pageIndex * PAGE_SIZE,
				limit: PAGE_SIZE,
				enableUserData: true,
				enableImages: true,
				imageTypeLimit: 2
			});
			if (generation !== requestGeneration) return;
			const page = response.data.Items ?? [];
			const byId = new SvelteMap<string, BaseItemDto>();
			for (const item of reset ? [] : items) if (item.Id) byId.set(item.Id, item);
			for (const item of page) {
				if (!item.Id) continue;
				byId.set(item.Id, item);
				upsertEntity(itemEntityKey(session.bootstrap?.jellyfin?.server.id, userId, item.Id), item);
			}
			items = [...byId.values()];
			pageIndex += 1;
			totalRecordCount = response.data.TotalRecordCount ?? page.length;
			hasMore = items.length < totalRecordCount;
			writeQuery(currentQueryKey(userId), {
				itemIds: items.flatMap((item) => (item.Id ? [item.Id] : [])),
				startIndex: pageIndex * PAGE_SIZE,
				totalRecordCount,
				hasMore
			});
		} catch (reason) {
			if (!background) error = reason instanceof Error ? reason.message : config.loadError;
		} finally {
			if (generation === requestGeneration) {
				if (reset && !background) loading = false;
				loadingMore = false;
			}
		}
	}

	function observeMore(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void loadPage();
			},
			{ rootMargin: '400px' }
		);
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	function chooseFilter(value: unknown) {
		if (value === 'all' || value === 'unplayed' || value === 'favorites') filter = value;
	}

	function chooseSort(value: unknown) {
		if (value === 'title' || value === 'recent' || value === 'year') sort = value;
	}

	function clearFilters() {
		query = '';
		filter = 'all';
		sort = 'title';
	}
</script>

<svelte:head><title>{config.title} · Shayfin</title></svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
	<h1 class="sr-only">{config.title}</h1>

	<Sheet.Root bind:open={headerContext.filterOpen}>
		<Sheet.Content side="right">
			<Sheet.Header>
				<Sheet.Title>{config.title} filters</Sheet.Title>
				<Sheet.Description>{countDescription}</Sheet.Description>
			</Sheet.Header>
			<div class="px-6">
				<Field.Group>
					<Field.Field>
						<Field.Label for={`${kind}-query`}>Search this library</Field.Label>
						<InputGroup.Root>
							<InputGroup.Addon><SearchIcon /></InputGroup.Addon>
							<InputGroup.Input
								id={`${kind}-query`}
								bind:value={query}
								aria-label={`Search ${kind}`}
								placeholder={config.searchPlaceholder}
							/>
						</InputGroup.Root>
					</Field.Field>

					<Field.Field>
						<Field.Label>Watch status</Field.Label>
						<ToggleGroup.Root
							type="single"
							value={filter}
							onValueChange={chooseFilter}
							variant="outline"
							aria-label={`Filter ${kind}`}
						>
							<ToggleGroup.Item value="all">All</ToggleGroup.Item>
							<ToggleGroup.Item value="unplayed">Unplayed</ToggleGroup.Item>
							<ToggleGroup.Item value="favorites">Favorites</ToggleGroup.Item>
						</ToggleGroup.Root>
					</Field.Field>

					<Field.Field>
						<Field.Label for={`${kind}-sort`}>Sort by</Field.Label>
						<Select.Root type="single" value={sort} onValueChange={chooseSort}>
							<Select.Trigger id={`${kind}-sort`} class="w-full" aria-label={`Sort ${kind}`}>
								<span data-slot="select-value">
									{sort === 'title'
										? 'Title'
										: sort === 'recent'
											? 'Recently added'
											: config.yearLabel}
								</span>
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.Item value="title">Title</Select.Item>
									<Select.Item value="recent">Recently added</Select.Item>
									<Select.Item value="year">{config.yearLabel}</Select.Item>
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</Field.Field>
				</Field.Group>
			</div>
			<Sheet.Footer>
				<Button onclick={() => (headerContext.filterOpen = false)}>Done</Button>
				<Button variant="outline" onclick={clearFilters}>Clear filters</Button>
			</Sheet.Footer>
		</Sheet.Content>
	</Sheet.Root>

	{#if error}
		<Alert variant="destructive">
			<AlertTitle>{config.unavailable}</AlertTitle>
			<AlertDescription class="flex flex-wrap items-center justify-between gap-3">
				<span>{error}</span>
				<Button variant="outline" size="sm" onclick={() => resetAndLoad()}>
					<RotateCcwIcon data-icon="inline-start" />
					Try again
				</Button>
			</AlertDescription>
		</Alert>
	{:else}
		<!-- Filters are intentionally hosted in the context-aware header Sheet. -->
	{/if}

	{#if loading && cards.length === 0}
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
		>
			{#each Array.from({ length: 12 }, (_, index) => index) as index (index)}
				<div class="flex flex-col gap-2">
					<Skeleton class="aspect-[2/3] w-full rounded-4xl" />
					<Skeleton class="h-4 w-4/5" />
					<Skeleton class="h-3 w-12" />
				</div>
			{/each}
		</div>
	{:else if !error && cards.length === 0}
		<Empty.Root class="border border-border">
			<Empty.Header>
				<Empty.Media variant="icon">
					{#if kind === 'movies'}<FilmIcon />{:else}<TvIcon />{/if}
				</Empty.Media>
				<Empty.Title
					>{query.trim() || filter !== 'all' ? config.emptyMatch : config.emptyLibrary}</Empty.Title
				>
				<Empty.Description>
					{query.trim() || filter !== 'all'
						? 'Try a different title, genre, or filter.'
						: config.emptyDescription}
				</Empty.Description>
			</Empty.Header>
			{#if items.length}
				<Empty.Content>
					<Button variant="outline" onclick={clearFilters}>Clear filters</Button>
				</Empty.Content>
			{/if}
		</Empty.Root>
	{:else if !error}
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
		>
			{#each cards as item (item.id)}
				<MediaCard {item} variant="portrait" />
			{/each}
		</div>
		{#if hasMore}
			<div use:observeMore class="flex min-h-16 items-center justify-center">
				<Button variant="outline" disabled={loadingMore} onclick={() => loadPage()}>
					{loadingMore ? 'Loading…' : 'Load more'}
				</Button>
			</div>
		{/if}
	{/if}
</div>
