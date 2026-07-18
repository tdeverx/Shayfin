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
		headingId = 'media-hero-title',
		trailer = null,
		showTrailer = false,
		paused = false,
		metadata,
		actions,
		actionsOnHover = false,
		onTrailerProgress,
		onTrailerEnded,
		onTrailerUnavailable
	}: {
		title: string;
		backdropUrl?: string;
		logoUrl?: string;
		description?: string | null;
		tagline?: string | null;
		headingId?: string;
		trailer?: HeroTrailer | null;
		showTrailer?: boolean;
		paused?: boolean;
		metadata?: Snippet;
		actions?: Snippet;
		actionsOnHover?: boolean;
		onTrailerProgress?: (seconds: number) => void;
		onTrailerEnded?: () => void;
		onTrailerUnavailable?: () => void;
	} = $props();

	let trailerFailed = $state(false);
	let trailerPlaying = $state(false);
	let actionsHovered = $state(false);
	let video = $state<HTMLVideoElement | null>(null);

	$effect(() => {
		if (!video) return;
		if (paused) video.pause();
		else if (showTrailer) void video.play().catch(() => undefined);
	});
</script>

<section
	aria-labelledby={headingId}
	onpointerenter={() => (actionsHovered = true)}
	onpointerleave={() => (actionsHovered = false)}
	class="group relative left-1/2 -mt-20 h-[clamp(28rem,62svh,40rem)] w-[100dvw] -translate-x-1/2 overflow-hidden bg-background"
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
	<div
		class="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-background via-background/60 to-transparent"
	></div>

	<div
		class={cn(
			'relative mx-auto flex size-full max-w-[110rem] items-end px-4 pt-28 pb-8 text-foreground transition-opacity duration-700 sm:px-6 sm:pb-10 lg:px-8',
			trailerPlaying && 'opacity-50'
		)}
	>
		<div class="flex max-w-3xl min-w-0 flex-col gap-4">
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
			{#if metadata}
				<div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					{@render metadata()}
				</div>
			{/if}
			{#if tagline}
				<p class="line-clamp-2 text-lg text-muted-foreground italic">{tagline}</p>
			{/if}
			{#if description}
				<p
					class="line-clamp-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base"
				>
					{description}
				</p>
			{/if}
			{#if actions}
				<div
					class={cn(
						'flex flex-wrap items-center gap-2 transition-[opacity,transform] duration-200',
						actionsOnHover &&
							!actionsHovered &&
							'md:translate-y-1 md:opacity-0 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100'
					)}
				>
					{@render actions()}
				</div>
			{/if}
		</div>
	</div>
</section>
