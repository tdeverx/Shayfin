<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import type { MediaSectionModel } from '$lib/app/models';
	import MediaCard from './media-card.svelte';

	let { section }: { section: MediaSectionModel } = $props();
</script>

<section aria-labelledby={`section-${section.id}`} class="flex min-w-0 flex-col gap-3">
	<header class="flex items-center justify-between gap-4">
		<h2 id={`section-${section.id}`} class="text-lg font-medium tracking-tight">{section.title}</h2>
		{#if section.href}
			<Button variant="ghost" size="sm" href={section.href}>
				View all
				<ChevronRightIcon data-icon="inline-end" />
			</Button>
		{/if}
	</header>
	<div
		class="grid [scrollbar-width:none] auto-cols-[minmax(15rem,21vw)] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-2 sm:auto-cols-[minmax(17rem,19vw)] {section.variant ===
		'portrait'
			? 'auto-cols-[minmax(9.5rem,12vw)] sm:auto-cols-[minmax(11rem,11vw)]'
			: ''}"
	>
		{#each section.items as item, index (`${item.id}-${index}`)}
			<MediaCard {item} variant={section.variant ?? 'landscape'} />
		{/each}
	</div>
</section>
