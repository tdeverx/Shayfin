<script lang="ts">
	import FilmIcon from '@lucide/svelte/icons/film';
	import TvIcon from '@lucide/svelte/icons/tv';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import * as Command from '$lib/components/ui/command';
	import { Badge } from '$lib/components/ui/badge';
	import type { UnifiedSearchItem } from '$lib/app/models';

	let {
		open = $bindable(false),
		query = $bindable(''),
		localResults = [],
		externalResults = [],
		loading = false,
		onSelect
	}: {
		open?: boolean;
		query?: string;
		localResults?: UnifiedSearchItem[];
		externalResults?: UnifiedSearchItem[];
		loading?: boolean;
		onSelect: (item: UnifiedSearchItem) => void;
	} = $props();

	function iconFor(item: UnifiedSearchItem) {
		return item.kind === 'movie' ? FilmIcon : TvIcon;
	}
</script>

<Command.Dialog
	bind:open
	title="Search Shayfin"
	description="Search your library and discover media to request"
>
	<Command.Input bind:value={query} placeholder="Search movies and series…" />
	<Command.List class="max-h-[min(60vh,34rem)]">
		{#if loading}<Command.Loading>Searching…</Command.Loading>{/if}
		{#if query.trim().length > 1 && !loading && localResults.length === 0 && externalResults.length === 0}
			<Command.Empty>No matching media found.</Command.Empty>
		{/if}
		{#if localResults.length > 0}
			<Command.Group heading="In your library">
				{#each localResults as item (item.id)}
					{@const Icon = iconFor(item)}
					<Command.Item value={`local-${item.id}-${item.title}`} onSelect={() => onSelect(item)}>
						<Icon />
						<span class="min-w-0 flex-1 truncate">{item.title}</span>
						{#if item.year}<span class="text-xs text-muted-foreground">{item.year}</span>{/if}
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}
		{#if localResults.length > 0 && externalResults.length > 0}<Command.Separator />{/if}
		{#if externalResults.length > 0}
			<Command.Group heading="Discover & request">
				{#each externalResults as item (item.id)}
					<Command.Item value={`external-${item.id}-${item.title}`} onSelect={() => onSelect(item)}>
						<SparklesIcon />
						<span class="min-w-0 flex-1 truncate">{item.title}</span>
						{#if item.requestStatus}<Badge variant="secondary">{item.requestStatus}</Badge>{/if}
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}
	</Command.List>
</Command.Dialog>
