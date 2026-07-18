<script lang="ts">
	import './layout.css';
	import { Toaster } from '$lib/components/ui/sonner';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { children } = $props();
</script>

<svelte:head>
	<title>Shayfin</title>
	<meta
		name="description"
		content="A focused, independent Jellyfin client for movies, series, requests, and achievements."
	/>
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

<Tooltip.Provider>
	{@render children()}
</Tooltip.Provider>
<Toaster theme="system" position="bottom-right" richColors />
