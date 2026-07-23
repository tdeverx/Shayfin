<script lang="ts">
	import './layout.css';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from '$lib/components/ui/sonner';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { queryClient } from '$lib/core/query/query-client';

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

<QueryClientProvider client={queryClient}>
	<Tooltip.Provider>
		{@render children()}
	</Tooltip.Provider>
</QueryClientProvider>
<Toaster theme="system" position="bottom-right" richColors />
