<script lang="ts">
	import InfoIcon from '@lucide/svelte/icons/info';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import type { SpotlightModel } from '$lib/app/models';
	import type { HeroTrailer } from '$lib/jellyfin';
	import MediaHero from './media-hero.svelte';

	let {
		item,
		trailer = null,
		showTrailer = false,
		paused = false,
		onTrailerProgress,
		onTrailerEnded,
		onTrailerUnavailable
	}: {
		item: SpotlightModel;
		trailer?: HeroTrailer | null;
		showTrailer?: boolean;
		paused?: boolean;
		onTrailerProgress?: (seconds: number) => void;
		onTrailerEnded?: () => void;
		onTrailerUnavailable?: () => void;
	} = $props();
</script>

{#snippet metadata()}
	{#if item.year}<Badge variant="secondary">{item.year}</Badge>{/if}
	{#if item.rating}<span>{item.rating}</span>{/if}
	{#if item.runtime}<span>{item.runtime}</span>{/if}
	{#if item.secondary && item.secondary !== String(item.year)}<span>{item.secondary}</span>{/if}
{/snippet}

{#snippet actions()}
	{#if item.kind !== 'series'}
		<Button href={`/watch/${item.id}`}>
			<PlayIcon data-icon="inline-start" />
			Play
		</Button>
	{/if}
	<Button variant="secondary" href={item.href}>
		<InfoIcon data-icon="inline-start" />
		Details
	</Button>
{/snippet}

<MediaHero
	title={item.title}
	backdropUrl={item.backdropUrl ?? item.imageUrl}
	logoUrl={item.logoUrl}
	tagline={item.tagline}
	description={item.overview}
	headingId="spotlight-title"
	{trailer}
	{showTrailer}
	{paused}
	{metadata}
	{actions}
	actionsOnHover
	{onTrailerProgress}
	{onTrailerEnded}
	{onTrailerUnavailable}
/>
