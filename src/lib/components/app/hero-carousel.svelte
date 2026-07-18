<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import type { SpotlightModel } from '$lib/app/models';
	import type { HeroTrailer } from '$lib/jellyfin';
	import { cn } from '$lib/utils';
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
	let controlsVisible = $state(false);
	let showTrailer = $state(false);
	let trailerUnavailable = $state(false);
	let advanceDue = $state(false);
	let advanceRequested = $state(false);
	let trailerWatchedSeconds = $state(0);
	let lastTrailerTime = $state(0);
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
		if (items.length <= 1 || advanceRequested) return;
		advanceRequested = true;
		if (paused) advanceDue = true;
		else select(index + 1);
	}

	function trailerProgress(seconds: number) {
		const delta = seconds >= lastTrailerTime ? seconds - lastTrailerTime : seconds;
		lastTrailerTime = seconds;
		trailerWatchedSeconds += Math.max(0, delta);
		if (trailerWatchedSeconds >= TRAILER_ROTATION_SECONDS) requestAdvance();
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
		advanceRequested = false;
		trailerWatchedSeconds = 0;
		lastTrailerTime = 0;
	});

	$effect(() => {
		const id = current?.id;
		const trailerUrl = effectiveTrailer?.url;
		if (
			!id ||
			!slideStartedAt ||
			items.length <= 1 ||
			matchMedia('(prefers-reduced-motion: reduce)').matches
		)
			return;
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
		class="group/carousel relative isolate"
		role="region"
		aria-label="Featured media"
		onmouseenter={() => {
			setPaused(true);
			controlsVisible = true;
		}}
		onmouseleave={() => {
			setPaused(false);
			controlsVisible = false;
		}}
		onfocusin={() => {
			setPaused(true);
			controlsVisible = true;
		}}
		onfocusout={() => {
			setPaused(false);
			controlsVisible = false;
		}}
	>
		<div class="pointer-events-none relative z-0">
			{#key `${current.id}-${trailer?.url ?? ''}`}
				<Spotlight
					item={current}
					trailer={effectiveTrailer}
					{showTrailer}
					{paused}
					onTrailerProgress={trailerProgress}
					onTrailerUnavailable={trailerFailed}
				/>
			{/key}
		</div>
		{#if items.length > 1}
			<div class="pointer-events-none absolute inset-0 z-20">
				<div class="absolute top-1/2 left-4 -translate-y-1/2 sm:left-6 lg:left-8">
					<Button
						variant="secondary"
						size="icon-lg"
						class={cn(
							'pointer-events-auto rounded-full backdrop-blur transition-opacity',
							!controlsVisible && 'pointer-events-none opacity-0'
						)}
						aria-label="Previous featured item"
						onclick={() => select(index - 1)}
					>
						<ChevronLeftIcon />
					</Button>
				</div>
				<div class="absolute top-1/2 right-4 -translate-y-1/2 sm:right-6 lg:right-8">
					<Button
						variant="secondary"
						size="icon-lg"
						class={cn(
							'pointer-events-auto rounded-full backdrop-blur transition-opacity',
							!controlsVisible && 'pointer-events-none opacity-0'
						)}
						aria-label="Next featured item"
						onclick={() => select(index + 1)}
					>
						<ChevronRightIcon />
					</Button>
				</div>
			</div>
		{/if}
	</div>
{/if}
