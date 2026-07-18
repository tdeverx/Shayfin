<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { SpotlightModel } from '$lib/app/models';
	import type { HeroTrailer } from '$lib/jellyfin';
	import Spotlight from './spotlight.svelte';

	const IMAGE_LEAD_MS = 5_000;
	const IMAGE_ROTATION_MS = 10_000;
	const TRAILER_ROTATION_SECONDS = 30;

	let {
		items,
		trailer = null,
		onItemChange
	}: {
		items: SpotlightModel[];
		trailer?: HeroTrailer | null;
		onItemChange?: (id: string) => void;
	} = $props();

	let index = $state(0);
	let paused = $state(false);
	let showTrailer = $state(false);
	let trailerUnavailable = $state(false);
	let advanceDue = $state(false);
	let slideStartedAt = $state(0);
	let activeId = $state('');
	let current = $derived(items[index] ?? items[0]);
	let effectiveTrailer = $derived(trailerUnavailable ? null : trailer);

	function select(next: number) {
		if (!items.length) return;
		index = (next + items.length) % items.length;
	}

	function setPaused(value: boolean) {
		paused = value;
		if (!value && advanceDue) {
			advanceDue = false;
			select(index + 1);
		}
	}

	function requestAdvance() {
		if (items.length <= 1) return;
		if (paused) advanceDue = true;
		else select(index + 1);
	}

	function trailerProgress(seconds: number) {
		if (seconds >= TRAILER_ROTATION_SECONDS) requestAdvance();
	}

	function trailerFailed() {
		trailerUnavailable = true;
		showTrailer = false;
	}

	$effect(() => {
		if (index >= items.length) index = 0;
		if (current) onItemChange?.(current.id);
	});

	$effect(() => {
		const id = current?.id;
		if (!id || id === activeId) return;
		activeId = id;
		slideStartedAt = Date.now();
		showTrailer = false;
		trailerUnavailable = false;
		advanceDue = false;
	});

	$effect(() => {
		const id = current?.id;
		const trailerUrl = effectiveTrailer?.url;
		if (!id || items.length <= 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const elapsed = Math.max(0, Date.now() - slideStartedAt);
		if (trailerUrl) {
			const timer = setTimeout(() => (showTrailer = true), Math.max(0, IMAGE_LEAD_MS - elapsed));
			return () => clearTimeout(timer);
		}
		const timer = setTimeout(requestAdvance, Math.max(0, IMAGE_ROTATION_MS - elapsed));
		return () => clearTimeout(timer);
	});
</script>

{#if current}
	<div
		class="relative"
		role="region"
		aria-label="Featured media"
		onmouseenter={() => setPaused(true)}
		onmouseleave={() => setPaused(false)}
		onfocusin={() => setPaused(true)}
		onfocusout={() => setPaused(false)}
	>
		{#key `${current.id}-${trailer?.url ?? ''}`}
			<Spotlight
				item={current}
				trailer={effectiveTrailer}
				{showTrailer}
				{paused}
				onTrailerProgress={trailerProgress}
				onTrailerEnded={requestAdvance}
				onTrailerUnavailable={trailerFailed}
			/>
		{/key}
		{#if items.length > 1}
			<div
				class="absolute right-4 bottom-5 flex max-w-[calc(100vw-2rem)] items-center gap-1.5 overflow-x-auto sm:right-6 lg:right-8"
				aria-label={`Featured item ${index + 1} of ${items.length}`}
			>
				{#each items as item, itemIndex (item.id)}
					<Button
						variant={itemIndex === index ? 'default' : 'secondary'}
						size="icon-xs"
						class="size-2 rounded-full p-0"
						aria-label={`Show ${item.title}`}
						onclick={() => select(itemIndex)}
					></Button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
