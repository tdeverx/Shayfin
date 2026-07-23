<script lang="ts">
	import { onMount } from 'svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Spinner } from '$lib/components/ui/spinner';
	import * as Table from '$lib/components/ui/table';
	import AdminHeading from '../admin-heading.svelte';
	import StatusBadge from '../status-badge.svelte';
	import {
		adminFetch,
		prettyEta,
		type DownloadProgress,
		type DownloadResponse
	} from '../admin-client';
	import DownloadStateBadge from './download-state-badge.svelte';

	let response = $state<DownloadResponse | null>(null);
	let error = $state<string | null>(null);
	let refreshing = $state(false);
	let updatedAt = $state<Date | null>(null);
	let timeout: ReturnType<typeof setTimeout> | undefined;

	async function refresh(manual = false) {
		if (manual) refreshing = true;
		try {
			response = await adminFetch<DownloadResponse>('/api/external/downloads');
			error = null;
			updatedAt = new Date();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Download queues are unavailable.';
		} finally {
			refreshing = false;
		}
	}

	function schedule() {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(
			async () => {
				await refresh();
				schedule();
			},
			document.visibilityState === 'visible' ? 15_000 : 60_000
		);
	}

	onMount(() => {
		void refresh().then(schedule);
		const handleVisibility = () => schedule();
		document.addEventListener('visibilitychange', handleVisibility);
		return () => {
			if (timeout) clearTimeout(timeout);
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});

	function providerLabel(download: DownloadProgress): string {
		if (download.providerIds.tmdbId) return `TMDB ${download.providerIds.tmdbId}`;
		if (download.providerIds.tvdbId) return `TVDB ${download.providerIds.tvdbId}`;
		return download.mediaType === 'movie' ? 'Movie' : 'Series';
	}
</script>

<AdminHeading
	title="Downloads"
	description="A read-only view of normalized Sonarr and Radarr queues. Administrators can see all entries."
>
	{#snippet actions()}
		{#if updatedAt}<span class="hidden text-xs text-muted-foreground sm:inline"
				>Updated {updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span
			>{/if}
		<Button variant="outline" onclick={() => refresh(true)} disabled={refreshing}>
			{#if refreshing}<Spinner data-icon="inline-start" />{:else}<RefreshCwIcon
					data-icon="inline-start"
				/>{/if}
			Refresh
		</Button>
	{/snippet}
</AdminHeading>

{#if error}
	<Alert variant="destructive">
		<DownloadIcon />
		<AlertTitle>Queues could not be refreshed</AlertTitle>
		<AlertDescription>{error}</AlertDescription>
	</Alert>
{/if}

<section class="grid gap-3 sm:grid-cols-3" aria-label="Download service availability">
	{#if response}
		{#each response.capabilities as capability (`${capability.service}:${capability.instanceId ?? 'service'}`)}
			<Card.Root size="sm">
				<Card.Content class="flex items-center justify-between gap-3">
					<div>
						<p class="font-medium capitalize">{capability.instanceLabel ?? capability.service}</p>
						{#if capability.message}<p class="mt-1 text-xs text-muted-foreground">
								{capability.message}
							</p>{/if}
					</div>
					<StatusBadge status={capability.status} />
				</Card.Content>
			</Card.Root>
		{/each}
	{:else}
		{#each [0, 1, 2] as index (index)}<Skeleton class="h-24 w-full rounded-4xl" />{/each}
	{/if}
</section>

<Card.Root class="hidden md:flex">
	<Card.Header>
		<Card.Title>Queue</Card.Title>
		<Card.Description
			>Polling every 15 seconds while this tab is visible and every 60 seconds in the background.</Card.Description
		>
	</Card.Header>
	<Card.Content class="px-0">
		{#if response?.downloads.length}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Title</Table.Head>
						<Table.Head>Service</Table.Head>
						<Table.Head>State</Table.Head>
						<Table.Head>Progress</Table.Head>
						<Table.Head class="text-right">ETA</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each response.downloads as download (download.id)}
						<Table.Row>
							<Table.Cell>
								<p class="max-w-72 truncate font-medium">{download.title}</p>
								<p class="text-xs text-muted-foreground">{providerLabel(download)}</p>
								{#if download.message}<p class="mt-1 max-w-72 truncate text-xs text-destructive">
										{download.message}
									</p>{/if}
							</Table.Cell>
							<Table.Cell
								><Badge variant="outline" class="capitalize"
									>{download.service} · {download.instanceLabel}</Badge
								></Table.Cell
							>
							<Table.Cell><DownloadStateBadge state={download.state} /></Table.Cell>
							<Table.Cell class="min-w-48">
								<div class="flex items-center gap-3">
									<Progress value={download.progress} /><span
										class="w-10 text-right text-xs tabular-nums"
										>{Math.round(download.progress)}%</span
									>
								</div>
							</Table.Cell>
							<Table.Cell class="text-right text-xs">{prettyEta(download.eta)}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{:else if response}
			<Empty.Root>
				<Empty.Header>
					<Empty.Media variant="icon"><DownloadIcon /></Empty.Media>
					<Empty.Title>Nothing is downloading</Empty.Title>
					<Empty.Description
						>New Sonarr and Radarr queue entries will appear here automatically.</Empty.Description
					>
				</Empty.Header>
			</Empty.Root>
		{:else}
			<div class="flex flex-col gap-3 p-6">
				{#each [0, 1, 2, 3] as index (index)}<Skeleton class="h-12 w-full" />{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<section class="flex flex-col gap-3 md:hidden" aria-label="Download queue">
	{#if response?.downloads.length}
		{#each response.downloads as download (download.id)}
			<Card.Root size="sm">
				<Card.Header>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<Card.Title class="truncate">{download.title}</Card.Title>
							<Card.Description
								>{providerLabel(download)} ·
								<span class="capitalize">{download.service} · {download.instanceLabel}</span
								></Card.Description
							>
						</div>
						<DownloadStateBadge state={download.state} />
					</div>
				</Card.Header>
				<Card.Content class="flex flex-col gap-2">
					<div class="flex items-center gap-3">
						<Progress value={download.progress} /><span class="text-xs tabular-nums"
							>{Math.round(download.progress)}%</span
						>
					</div>
					<div class="flex justify-between text-xs text-muted-foreground">
						<span>Estimated finish</span><span>{prettyEta(download.eta)}</span>
					</div>
					{#if download.message}<p class="text-xs text-destructive">{download.message}</p>{/if}
				</Card.Content>
			</Card.Root>
		{/each}
	{:else if response}
		<Card.Root
			><Empty.Root
				><Empty.Header
					><Empty.Media variant="icon"><DownloadIcon /></Empty.Media><Empty.Title
						>Nothing is downloading</Empty.Title
					><Empty.Description>Queue entries will appear here automatically.</Empty.Description
					></Empty.Header
				></Empty.Root
			></Card.Root
		>
	{:else}
		{#each [0, 1, 2] as index (index)}<Skeleton class="h-36 w-full rounded-4xl" />{/each}
	{/if}
</section>
