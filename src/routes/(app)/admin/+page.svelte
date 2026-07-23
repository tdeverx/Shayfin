<script lang="ts">
	import { onMount } from 'svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ServerIcon from '@lucide/svelte/icons/server';
	import PuzzleIcon from '@lucide/svelte/icons/puzzle';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import AdminHeading from './admin-heading.svelte';
	import { adminFetch, type AdminSettings, type DownloadResponse } from './admin-client';
	let settings = $state<AdminSettings | null>(null);
	let downloads = $state<DownloadResponse | null>(null);
	let error = $state<string | null>(null);
	onMount(async () => {
		try {
			[settings, downloads] = await Promise.all([
				adminFetch<AdminSettings>('/api/admin/settings'),
				adminFetch<DownloadResponse>('/api/external/downloads')
			]);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Administrator status is unavailable.';
		}
	});
	let instanceCount = $derived(
		settings ? settings.integrations.sonarr.length + settings.integrations.radarr.length : 0
	);
</script>

<AdminHeading
	title="Overview"
	description="A focused snapshot of your Jellyfin connection, optional services, and active downloads."
/>
{#if error}<Alert variant="destructive"
		><AlertTitle>Overview could not be refreshed</AlertTitle><AlertDescription
			>{error}</AlertDescription
		></Alert
	>{/if}
<section class="grid gap-4 sm:grid-cols-3">
	<Card.Root
		><Card.Header
			><Card.Title class="flex items-center justify-between">Jellyfin <ServerIcon /></Card.Title
			></Card.Header
		><Card.Content
			>{#if settings}<p class="font-medium">{settings.jellyfin?.serverName ?? 'Not configured'}</p>
				<p class="truncate text-sm text-muted-foreground">
					{settings.jellyfin?.publicUrl ?? 'Add a server URL'}
				</p>{:else}<Skeleton class="h-10 w-full" />{/if}</Card.Content
		><Card.Footer
			><Button href="/admin/jellyfin" variant="ghost">Manage Jellyfin</Button></Card.Footer
		></Card.Root
	>
	<Card.Root
		><Card.Header
			><Card.Title class="flex items-center justify-between">Services <PuzzleIcon /></Card.Title
			></Card.Header
		><Card.Content
			>{#if settings}<p class="text-3xl font-semibold">{instanceCount}</p>
				<p class="text-sm text-muted-foreground">
					Named Sonarr and Radarr instances
				</p>{:else}<Skeleton class="h-10 w-24" />{/if}</Card.Content
		><Card.Footer
			><Button href="/admin/sonarr" variant="ghost">Configure services</Button></Card.Footer
		></Card.Root
	>
	<Card.Root
		><Card.Header
			><Card.Title class="flex items-center justify-between">Downloads <DownloadIcon /></Card.Title
			></Card.Header
		><Card.Content
			>{#if downloads}<p class="text-3xl font-semibold">{downloads.downloads.length}</p>
				<p class="text-sm text-muted-foreground">Across enabled queue sources</p>{:else}<Skeleton
					class="h-10 w-24"
				/>{/if}</Card.Content
		><Card.Footer
			><Button href="/admin/downloads" variant="ghost">View downloads</Button></Card.Footer
		></Card.Root
	>
</section>
