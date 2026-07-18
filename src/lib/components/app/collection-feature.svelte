<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import type { MediaSectionModel } from '$lib/app/models';
	import MediaCard from './media-card.svelte';

	let { section }: { section: MediaSectionModel } = $props();
	let backdrop = $derived(
		section.backdropUrl ?? section.items[0]?.backdropUrl ?? section.items[0]?.imageUrl
	);
</script>

<Card.Root
	class="relative isolate flex min-h-[28rem] flex-col justify-end overflow-hidden border-border bg-card"
>
	{#if backdrop}<img
			src={backdrop}
			alt=""
			class="absolute inset-0 -z-20 size-full object-cover"
		/>{/if}
	<div class="absolute inset-0 -z-10 bg-gradient-to-t from-card via-card/85 to-transparent"></div>
	<Card.Header class="relative mt-auto pt-36 sm:px-7 sm:pt-44">
		<Card.Title class="text-2xl tracking-tight sm:text-3xl">{section.title}</Card.Title>
		{#if section.href}<Card.Action
				><Button variant="secondary" size="sm" href={section.href}
					>View collection<ChevronRightIcon data-icon="inline-end" /></Button
				></Card.Action
			>{/if}
	</Card.Header>
	<Card.Content class="relative pb-7 sm:px-7">
		<div
			class="grid snap-x [scrollbar-width:none] auto-cols-[minmax(8.5rem,11rem)] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain"
		>
			{#each section.items.slice(0, 10) as item, index (`${item.id}-${index}`)}
				<div class="snap-start"><MediaCard {item} variant="portrait" /></div>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
