<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ResolvedPathname } from '$app/types';
	import HouseIcon from '@lucide/svelte/icons/house';
	import FilmIcon from '@lucide/svelte/icons/film';
	import TvIcon from '@lucide/svelte/icons/tv';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import type { MediaNavigationItem } from '$lib/app/models';

	let {
		items,
		onSearch
	}: {
		items: MediaNavigationItem[];
		onSearch: () => void;
	} = $props();

	const icons = { home: HouseIcon, movies: FilmIcon, series: TvIcon };
	const resolvePath = resolve as (path: string) => ResolvedPathname;
	let active = $derived(
		items.find((item) => page.url.pathname.startsWith(resolvePath(item.href)))?.id ?? 'home'
	);

	function select(value: unknown) {
		if (typeof value !== 'string') return;
		const item = items.find((candidate) => candidate.id === value);
		if (item) void goto(resolvePath(item.href));
	}
</script>

<nav
	aria-label="Media"
	class="fixed top-3 left-1/2 z-30 flex max-w-[calc(100vw-7rem)] -translate-x-1/2 items-center rounded-full border border-border bg-background/95 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
>
	<ToggleGroup.Root type="single" value={active} onValueChange={select} aria-label="Media type">
		{#each items as item (item.id)}
			{@const Icon = icons[item.id]}
			<ToggleGroup.Item value={item.id} aria-label={item.label} class="rounded-full px-3">
				<Icon data-icon="inline-start" />
				<span class="hidden sm:inline">{item.label}</span>
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
	<Separator orientation="vertical" class="mx-1 h-6" />
	<Button variant="ghost" size="icon" class="rounded-full" aria-label="Search" onclick={onSearch}>
		<SearchIcon />
	</Button>
</nav>
