<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import type { SpotlightModel } from '$lib/app/models';
	import type { HeroTrailer } from '$lib/jellyfin';
	import Spotlight from './spotlight.svelte';

	let {
		items,
		intervalMs = 9000,
		trailer = null,
		onItemChange
	}: {
		items: SpotlightModel[];
		intervalMs?: number;
		trailer?: HeroTrailer | null;
		onItemChange?: (id: string) => void;
	} = $props();

	let index = $state(0);
	let paused = $state(false);
	let current = $derived(items[index] ?? items[0]);

	function select(next: number) {
		if (!items.length) return;
		index = (next + items.length) % items.length;
	}

	$effect(() => {
		if (index >= items.length) index = 0;
		if (current) onItemChange?.(current.id);
	});

	onMount(() => {
		const timer = setInterval(() => {
			if (!paused && items.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
				select(index + 1);
			}
		}, intervalMs);
		return () => clearInterval(timer);
	});
</script>

{#if current}
	<div
		class="relative"
		role="region"
		aria-label="Featured media"
		onmouseenter={() => (paused = true)}
		onmouseleave={() => (paused = false)}
		onfocusin={() => (paused = true)}
		onfocusout={() => (paused = false)}
	>
		{#key `${current.id}-${trailer?.url ?? ''}`}
			<Spotlight item={current} {trailer} />
		{/key}
		{#if items.length > 1}
			<div class="absolute top-1/2 right-4 flex -translate-y-1/2 flex-col gap-2 sm:right-6">
				<Button
					variant="secondary"
					size="icon"
					class="rounded-full bg-background/80 backdrop-blur"
					aria-label="Previous featured item"
					onclick={() => select(index - 1)}><ChevronLeftIcon /></Button
				>
				<Button
					variant="secondary"
					size="icon"
					class="rounded-full bg-background/80 backdrop-blur"
					aria-label="Next featured item"
					onclick={() => select(index + 1)}><ChevronRightIcon /></Button
				>
			</div>
			<div
				class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5"
				aria-label={`Featured item ${index + 1} of ${items.length}`}
			>
				{#if items.length <= 12}
					{#each items as item, itemIndex (item.id)}
						<Button
							variant={itemIndex === index ? 'default' : 'secondary'}
							size="icon-xs"
							class="size-2 rounded-full p-0"
							aria-label={`Show ${item.title}`}
							onclick={() => select(itemIndex)}
						></Button>
					{/each}
				{:else}
					<span
						class="rounded-full bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur"
						>{index + 1} / {items.length}</span
					>
				{/if}
			</div>
		{/if}
	</div>
{/if}
