<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import SearchIcon from '@lucide/svelte/icons/search';
	import TvIcon from '@lucide/svelte/icons/tv';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
	import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind.js';
	import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields.js';
	import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by.js';
	import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order.js';
	import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api.js';
	import { session } from '$lib/app/session.svelte';
	import { toMediaCard } from '$lib/app/media';
	import MediaCard from '$lib/components/app/media-card.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import * as InputGroup from '$lib/components/ui/input-group';
	import * as Select from '$lib/components/ui/select';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { loadSupportedUserViews } from '$lib/jellyfin';

	type LibraryFilter = 'all' | 'unplayed' | 'favorites';
	type LibrarySort = 'title' | 'recent' | 'year';

	let items = $state<BaseItemDto[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let query = $state('');
	let filter = $state<LibraryFilter>('all');
	let sort = $state<LibrarySort>('title');

	const sortLabels: Record<LibrarySort, string> = {
		title: 'Title',
		recent: 'Recently added',
		year: 'First aired'
	};

	let filteredItems = $derived.by(() => {
		const needle = query.trim().toLocaleLowerCase();
		return items
			.filter((item) => {
				if (filter === 'unplayed' && item.UserData?.Played === true) return false;
				if (filter === 'favorites' && item.UserData?.IsFavorite !== true) return false;
				if (!needle) return true;
				return (
					item.Name?.toLocaleLowerCase().includes(needle) === true ||
					item.Genres?.some((genre) => genre.toLocaleLowerCase().includes(needle)) === true ||
					String(item.ProductionYear ?? '').includes(needle)
				);
			})
			.toSorted((left, right) => {
				if (sort === 'recent') {
					return Date.parse(right.DateCreated ?? '') - Date.parse(left.DateCreated ?? '');
				}
				if (sort === 'year') {
					return (right.ProductionYear ?? 0) - (left.ProductionYear ?? 0);
				}
				return (left.SortName ?? left.Name ?? '').localeCompare(right.SortName ?? right.Name ?? '');
			});
	});

	let cards = $derived(
		session.api
			? filteredItems
					.map((item) => toMediaCard(session.api!, item, 'portrait'))
					.filter((item) => item !== null)
			: []
	);

	onMount(loadSeries);

	async function loadSeries() {
		loading = true;
		error = null;
		try {
			await session.initialize();
			const api = session.api;
			const userId = session.user?.id;
			if (!api || !userId) throw new Error('Your Jellyfin session is not available.');

			const seriesView = (await loadSupportedUserViews(api, userId)).find(
				(view) => view.type === 'series'
			);
			if (!seriesView) {
				items = [];
				return;
			}

			const responses = await Promise.all(
				seriesView.libraryIds.map((parentId) =>
					getItemsApi(api).getItems({
						userId,
						parentId,
						recursive: true,
						includeItemTypes: [BaseItemKind.Series],
						fields: [ItemFields.DateCreated, ItemFields.Genres, ItemFields.ProviderIds],
						sortBy: [ItemSortBy.SortName],
						sortOrder: [SortOrder.Ascending],
						enableUserData: true,
						enableImages: true,
						imageTypeLimit: 2
					})
				)
			);
			const byId = new SvelteMap<string, BaseItemDto>();
			for (const item of responses.flatMap((response) => response.data.Items ?? [])) {
				if (item.Id) byId.set(item.Id, item);
			}
			items = [...byId.values()];
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Series could not be loaded.';
		} finally {
			loading = false;
		}
	}

	function chooseFilter(value: unknown) {
		if (value === 'all' || value === 'unplayed' || value === 'favorites') filter = value;
	}

	function chooseSort(value: unknown) {
		if (value === 'title' || value === 'recent' || value === 'year') sort = value;
	}
</script>

<svelte:head><title>Series · Shayfin</title></svelte:head>

<div class="mx-auto w-full max-w-7xl space-y-6">
	<header class="space-y-1">
		<p class="text-sm text-muted-foreground">Your Jellyfin libraries</p>
		<h1 class="text-3xl font-semibold tracking-tight">Series</h1>
		{#if !loading && !error}
			<p class="text-sm text-muted-foreground">
				{cards.length === items.length
					? `${items.length} series`
					: `${cards.length} of ${items.length} series`}
			</p>
		{/if}
	</header>

	{#if error}
		<Alert variant="destructive">
			<AlertTitle>Series are unavailable</AlertTitle>
			<AlertDescription class="flex flex-wrap items-center justify-between gap-3">
				<span>{error}</span>
				<Button variant="outline" size="sm" onclick={loadSeries}>
					<RotateCcwIcon data-icon="inline-start" />
					Try again
				</Button>
			</AlertDescription>
		</Alert>
	{:else}
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<InputGroup.Root class="w-full lg:max-w-sm">
				<InputGroup.Addon><SearchIcon /></InputGroup.Addon>
				<InputGroup.Input
					bind:value={query}
					aria-label="Search series"
					placeholder="Search series or genres"
				/>
			</InputGroup.Root>

			<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
				<ToggleGroup.Root
					type="single"
					value={filter}
					onValueChange={chooseFilter}
					variant="outline"
					aria-label="Filter series"
				>
					<ToggleGroup.Item value="all">All</ToggleGroup.Item>
					<ToggleGroup.Item value="unplayed">Unplayed</ToggleGroup.Item>
					<ToggleGroup.Item value="favorites">Favorites</ToggleGroup.Item>
				</ToggleGroup.Root>

				<Select.Root type="single" value={sort} onValueChange={chooseSort}>
					<Select.Trigger class="w-full sm:w-44" aria-label="Sort series">
						<span data-slot="select-value">{sortLabels[sort]}</span>
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="title">Title</Select.Item>
						<Select.Item value="recent">Recently added</Select.Item>
						<Select.Item value="year">First aired</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>
		</div>
	{/if}

	{#if loading}
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
		>
			{#each Array.from({ length: 12 }, (_, index) => index) as index (index)}
				<div class="space-y-2">
					<Skeleton class="aspect-[2/3] w-full rounded-lg" />
					<Skeleton class="h-4 w-4/5" />
					<Skeleton class="h-3 w-12" />
				</div>
			{/each}
		</div>
	{:else if !error && cards.length === 0}
		<Empty.Root class="border border-border">
			<Empty.Header>
				<Empty.Media variant="icon"><TvIcon /></Empty.Media>
				<Empty.Title
					>{items.length ? 'No matching series' : 'No series libraries found'}</Empty.Title
				>
				<Empty.Description>
					{items.length
						? 'Try a different title, genre, or filter.'
						: 'Series will appear here when this Jellyfin user can access a television library.'}
				</Empty.Description>
			</Empty.Header>
			{#if items.length}
				<Empty.Content>
					<Button
						variant="outline"
						onclick={() => {
							query = '';
							filter = 'all';
						}}>Clear filters</Button
					>
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
	{/if}
</div>
