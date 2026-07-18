<script lang="ts">
	import InfoIcon from '@lucide/svelte/icons/info';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import type { SpotlightModel } from '$lib/app/models';
	import type { HeroTrailer } from '$lib/jellyfin';

	let {
		item,
		trailer = null
	}: {
		item: SpotlightModel;
		trailer?: HeroTrailer | null;
	} = $props();

	let trailerFailed = $state(false);
</script>

<section
	aria-labelledby="spotlight-title"
	class="relative isolate min-h-[20rem] overflow-hidden rounded-xl border border-border bg-card sm:min-h-[23rem]"
>
	{#if item.backdropUrl ?? item.imageUrl}
		<img
			src={item.backdropUrl ?? item.imageUrl}
			alt=""
			class="absolute inset-0 -z-20 size-full object-cover"
		/>
	{/if}
	{#if trailer && !trailerFailed}
		<video
			src={trailer.url}
			poster={item.backdropUrl ?? item.imageUrl}
			autoplay
			muted
			loop
			playsinline
			onerror={() => (trailerFailed = true)}
			class="absolute inset-0 z-[-15] size-full object-cover motion-reduce:hidden"
		></video>
	{/if}
	<div class="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/65 to-transparent"></div>
	<div
		class="flex min-h-[20rem] max-w-2xl flex-col justify-end gap-4 p-6 text-white sm:min-h-[23rem] sm:p-8"
	>
		<div class="flex flex-wrap items-center gap-2 text-sm text-white/75">
			{#if item.year}<Badge variant="secondary">{item.year}</Badge>{/if}
			{#if item.rating}<span>{item.rating}</span>{/if}
			{#if item.runtime}<span>{item.runtime}</span>{/if}
			{#if item.secondary}<span>{item.secondary}</span>{/if}
		</div>
		<h1 id="spotlight-title" class="text-3xl font-semibold tracking-tight sm:text-5xl">
			{item.title}
		</h1>
		{#if item.overview}<p class="max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
				{item.overview}
			</p>{/if}
		<div class="flex flex-wrap items-center gap-2">
			{#if item.kind !== 'series'}<Button href={`/watch/${item.id}`}>
					<PlayIcon data-icon="inline-start" />
					Play
				</Button>{/if}
			<Button
				variant="outline"
				href={item.href}
				class="border-white/30 bg-black/20 text-white hover:bg-black/40 hover:text-white"
			>
				<InfoIcon data-icon="inline-start" />
				Details
			</Button>
		</div>
	</div>
</section>
