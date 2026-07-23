<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import type { MediaSectionModel } from '$lib/app/models';
	import MediaCard from './media-card.svelte';

	let { section }: { section: MediaSectionModel } = $props();
	let rail: HTMLDivElement;
	let canMoveBack = $state(false);
	let canMoveForward = $state(false);

	function updateControls() {
		if (!rail) return;
		canMoveBack = rail.scrollLeft > 4;
		canMoveForward = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4;
	}

	function move(direction: -1 | 1) {
		rail?.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: 'smooth' });
	}

	onMount(() => {
		const observer = new ResizeObserver(updateControls);
		observer.observe(rail);
		updateControls();
		return () => observer.disconnect();
	});
</script>

<section aria-labelledby={`section-${section.id}`} class="flex min-w-0 flex-col gap-3">
	<header class="flex items-center justify-between gap-4">
		<h2
			id={`section-${section.id}`}
			class="text-lg font-medium tracking-tight"
			class:sr-only={section.displayTitleText === false}
		>
			{section.title}
		</h2>
		<div class="flex items-center gap-1">
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={`Scroll ${section.title} back`}
				disabled={!canMoveBack}
				onclick={() => move(-1)}
			>
				<ChevronLeftIcon />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={`Scroll ${section.title} forward`}
				disabled={!canMoveForward}
				onclick={() => move(1)}
			>
				<ChevronRightIcon />
			</Button>
			{#if section.href && section.showDetailsMenu !== false}<Button
					variant="ghost"
					size="sm"
					href={section.href}
				>
					View all
					<ChevronRightIcon data-icon="inline-end" />
				</Button>{/if}
		</div>
	</header>
	<div class="relative min-w-0">
		<div
			bind:this={rail}
			onscroll={updateControls}
			class="grid snap-x snap-mandatory [scrollbar-width:none] auto-cols-[minmax(15rem,21vw)] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-2 sm:auto-cols-[minmax(17rem,19vw)] {section.variant ===
			'portrait'
				? 'auto-cols-[minmax(9.5rem,12vw)] sm:auto-cols-[minmax(11rem,11vw)]'
				: ''}"
		>
			{#each section.items as item, index (`${item.id}-${index}`)}
				<div class="snap-start">
					<MediaCard {item} variant={section.variant === 'portrait' ? 'portrait' : 'landscape'} />
				</div>
			{/each}
		</div>
		{#if canMoveBack}<div
				class="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent"
			></div>{/if}
		{#if canMoveForward}<div
				class="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
			></div>{/if}
	</div>
</section>
