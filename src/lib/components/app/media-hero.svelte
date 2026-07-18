<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HeroTrailer } from '$lib/jellyfin';
	import { cn } from '$lib/utils';

	let {
		title,
		backdropUrl,
		logoUrl,
		description,
		tagline,
		posterUrl,
		headingId = 'media-hero-title',
		trailer = null,
		showTrailer = false,
		paused = false,
		metadata,
		actions,
		topAction,
		onTrailerProgress,
		onTrailerEnded,
		onTrailerUnavailable
	}: {
		title: string;
		backdropUrl?: string;
		logoUrl?: string;
		description?: string | null;
		tagline?: string | null;
		posterUrl?: string;
		headingId?: string;
		trailer?: HeroTrailer | null;
		showTrailer?: boolean;
		paused?: boolean;
		metadata?: Snippet;
		actions?: Snippet;
		topAction?: Snippet;
		onTrailerProgress?: (seconds: number) => void;
		onTrailerEnded?: () => void;
		onTrailerUnavailable?: () => void;
	} = $props();

	let trailerFailed = $state(false);
	let trailerPlaying = $state(false);
	let video = $state<HTMLVideoElement | null>(null);

	$effect(() => {
		if (!video) return;
		if (paused) video.pause();
		else if (showTrailer) void video.play().catch(() => undefined);
	});
</script>

<section
	aria-labelledby={headingId}
	class="relative left-1/2 -mt-20 h-[clamp(28rem,62svh,40rem)] w-[100dvw] -translate-x-1/2 overflow-hidden rounded-b-4xl border-b border-border bg-card"
>
	{#if backdropUrl}
		<img src={backdropUrl} alt="" class="absolute inset-0 size-full object-cover" />
	{/if}
	{#if trailer && showTrailer && !trailerFailed}
		<video
			bind:this={video}
			src={trailer.url}
			poster={backdropUrl}
			autoplay
			muted
			playsinline
			onplaying={() => (trailerPlaying = true)}
			onpause={() => (trailerPlaying = false)}
			ontimeupdate={(event) => onTrailerProgress?.(event.currentTarget.currentTime)}
			onended={() => {
				trailerPlaying = false;
				onTrailerEnded?.();
			}}
			onerror={() => {
				trailerPlaying = false;
				trailerFailed = true;
				onTrailerUnavailable?.();
			}}
			class={cn(
				'absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700 motion-reduce:hidden',
				trailerPlaying && 'opacity-100'
			)}
		></video>
	{/if}
	<div class="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-transparent"></div>
	<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10"></div>

	{#if topAction}
		<div class="absolute top-20 left-4 sm:left-6 lg:left-8">{@render topAction()}</div>
	{/if}

	<div
		class={cn(
			'relative mx-auto flex size-full max-w-[110rem] items-end gap-6 px-4 pt-28 pb-8 text-white transition-opacity duration-700 sm:px-6 sm:pb-10 lg:px-8',
			trailerPlaying && 'opacity-50'
		)}
	>
		{#if posterUrl}
			<img
				src={posterUrl}
				alt=""
				class="hidden aspect-[2/3] w-44 rounded-4xl border border-white/20 object-cover shadow-lg sm:block"
			/>
		{/if}
		<div class="flex max-w-3xl min-w-0 flex-col gap-4">
			{#if metadata}
				<div class="flex flex-wrap items-center gap-2 text-sm text-white/75">
					{@render metadata()}
				</div>
			{/if}
			{#if logoUrl}
				<img
					src={logoUrl}
					alt=""
					class="max-h-24 max-w-[min(32rem,82vw)] object-contain object-left drop-shadow-lg sm:max-h-32"
				/>
				<h1 id={headingId} class="sr-only">{title}</h1>
			{:else}
				<h1 id={headingId} class="text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
			{/if}
			{#if tagline}
				<p class="line-clamp-2 text-lg text-white/75 italic">{tagline}</p>
			{/if}
			{#if description}
				<p class="line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
					{description}
				</p>
			{/if}
			{#if actions}
				<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
			{/if}
		</div>
	</div>
</section>
