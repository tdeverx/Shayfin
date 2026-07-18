<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import ImageOffIcon from '@lucide/svelte/icons/image-off';
	import { Progress } from '$lib/components/ui/progress';
	import type { MediaCardModel } from '$lib/app/models';

	let {
		item,
		variant = 'landscape'
	}: {
		item: MediaCardModel;
		variant?: 'landscape' | 'portrait';
	} = $props();

	const resolvePath = resolve as (path: string) => ResolvedPathname;
</script>

<a href={resolvePath(item.href)} class="group block min-w-0 outline-none">
	<div
		class="relative overflow-hidden rounded-4xl border border-border bg-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-ring {variant ===
		'portrait'
			? 'aspect-[2/3]'
			: 'aspect-video'}"
	>
		{#if item.imageUrl}
			<img
				src={item.imageUrl}
				alt=""
				loading="lazy"
				class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
			/>
		{:else}
			<div class="flex size-full items-center justify-center text-muted-foreground">
				<ImageOffIcon />
			</div>
		{/if}
		{#if variant === 'landscape'}
			<div
				class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-white"
			>
				<strong class="block truncate text-sm">{item.title}</strong>
				{#if item.secondary}<small class="block truncate text-white/70">{item.secondary}</small
					>{/if}
			</div>
		{/if}
		{#if item.progress !== undefined}
			<Progress value={item.progress} class="absolute inset-x-2 bottom-1 h-1" />
		{/if}
	</div>
	{#if variant === 'portrait'}
		<strong class="mt-2 block truncate text-sm font-medium">{item.title}</strong>
		{#if item.year}<small class="text-muted-foreground">{item.year}</small>{/if}
	{/if}
</a>
