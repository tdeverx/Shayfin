<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, description, actions }: { title: string; description: string; actions?: Snippet } =
		$props();
</script>

<header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
	<div class="flex max-w-3xl flex-col gap-1">
		<p class="text-xs font-medium tracking-widest text-muted-foreground uppercase">
			Administration
		</p>
		<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
		<p class="text-sm leading-relaxed text-muted-foreground">{description}</p>
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
	{/if}
</header>
