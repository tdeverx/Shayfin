<script lang="ts">
	import { onMount } from 'svelte';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import LinkIcon from '@lucide/svelte/icons/link';
	import NetworkIcon from '@lucide/svelte/icons/network';
	import PuzzleIcon from '@lucide/svelte/icons/puzzle';
	import ServerIcon from '@lucide/svelte/icons/server';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import AdminHeading from './admin-heading.svelte';
	import StatusBadge from './status-badge.svelte';
	import {
		adminFetch,
		type AdminSettings,
		type DownloadResponse,
		type NetworkDiagnostics
	} from './admin-client';

	let settings = $state<AdminSettings | null>(null);
	let diagnostics = $state<NetworkDiagnostics | null>(null);
	let downloads = $state<DownloadResponse | null>(null);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			[settings, diagnostics, downloads] = await Promise.all([
				adminFetch<AdminSettings>('/api/admin/settings'),
				adminFetch<NetworkDiagnostics>('/api/admin/diagnostics'),
				adminFetch<DownloadResponse>('/api/external/downloads')
			]);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Administrator status is unavailable.';
		}
	});

	let configuredIntegrations = $derived(
		settings
			? Object.values(settings.integrations).filter((integration) => integration.enabled).length
			: 0
	);
</script>

<AdminHeading
	title="Overview"
	description="Connection health, optional capabilities, and active work across this Shayfin instance."
>
	{#snippet actions()}
		<Button href="/admin/connections" variant="outline">
			<LinkIcon data-icon="inline-start" />
			Manage connection
		</Button>
	{/snippet}
</AdminHeading>

{#if error}
	<Alert variant="destructive">
		<ActivityIcon />
		<AlertTitle>Overview could not be refreshed</AlertTitle>
		<AlertDescription>{error}</AlertDescription>
	</Alert>
{/if}

<section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Shayfin status">
	<Card.Root size="sm">
		<Card.Header>
			<div class="flex items-center justify-between gap-3">
				<Card.Title>Jellyfin</Card.Title>
				<ServerIcon class="text-muted-foreground" />
			</div>
		</Card.Header>
		<Card.Content class="flex flex-col gap-2">
			{#if diagnostics && settings}
				<StatusBadge
					status={diagnostics.jellyfin.internalReachableFromContainer ? 'available' : 'degraded'}
					label={diagnostics.jellyfin.internalReachableFromContainer ? 'Connected' : 'Unavailable'}
				/>
				<p class="truncate text-xs text-muted-foreground">
					{settings.jellyfin?.serverName ?? 'Not configured'}
				</p>
			{:else}<Skeleton class="h-5 w-24" />{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root size="sm">
		<Card.Header>
			<div class="flex items-center justify-between gap-3">
				<Card.Title>Integrations</Card.Title>
				<PuzzleIcon class="text-muted-foreground" />
			</div>
		</Card.Header>
		<Card.Content class="flex flex-col gap-2">
			{#if settings}
				<p class="text-2xl font-semibold tabular-nums">
					{configuredIntegrations}<span class="text-sm font-normal text-muted-foreground">
						/ 3 enabled</span
					>
				</p>
				<p class="text-xs text-muted-foreground">Seerr, Sonarr, and Radarr are optional.</p>
			{:else}<Skeleton class="h-8 w-28" />{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root size="sm">
		<Card.Header>
			<div class="flex items-center justify-between gap-3">
				<Card.Title>Active downloads</Card.Title>
				<DownloadIcon class="text-muted-foreground" />
			</div>
		</Card.Header>
		<Card.Content class="flex flex-col gap-2">
			{#if downloads}
				<p class="text-2xl font-semibold tabular-nums">{downloads.downloads.length}</p>
				<p class="text-xs text-muted-foreground">Across the configured Servarr queues.</p>
			{:else}<Skeleton class="h-8 w-16" />{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root size="sm">
		<Card.Header>
			<div class="flex items-center justify-between gap-3">
				<Card.Title>Browser access</Card.Title>
				<NetworkIcon class="text-muted-foreground" />
			</div>
		</Card.Header>
		<Card.Content class="flex flex-col gap-2">
			{#if diagnostics}
				<StatusBadge
					status={diagnostics.jellyfin.cors === 'allowed' && !diagnostics.jellyfin.mixedContent
						? 'available'
						: 'degraded'}
					label={diagnostics.jellyfin.mixedContent
						? 'Mixed content'
						: `CORS ${diagnostics.jellyfin.cors}`}
				/>
				<p class="truncate text-xs text-muted-foreground">{diagnostics.origin}</p>
			{:else}<Skeleton class="h-5 w-28" />{/if}
		</Card.Content>
	</Card.Root>
</section>

<section class="grid gap-4 lg:grid-cols-3">
	<Card.Root>
		<Card.Header>
			<Card.Title>Connection</Card.Title>
			<Card.Description
				>One Jellyfin server supplies accounts, media, artwork, and playback.</Card.Description
			>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			<div class="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-3">
				<div class="min-w-0">
					<p class="font-medium">{settings?.jellyfin?.serverName ?? 'Loading server'}</p>
					<p class="truncate text-xs text-muted-foreground">
						{settings?.jellyfin?.publicUrl ?? 'Reading configuration…'}
					</p>
				</div>
				{#if settings?.jellyfin?.serverVersion}<Badge variant="outline"
						>{settings.jellyfin.serverVersion}</Badge
					>{/if}
			</div>
		</Card.Content>
		<Card.Footer
			><Button href="/admin/connections" variant="ghost"
				>Review URLs <ArrowRightIcon data-icon="inline-end" /></Button
			></Card.Footer
		>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Capabilities</Card.Title>
			<Card.Description
				>Disabled or unavailable services disappear cleanly from the user experience.</Card.Description
			>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			{#if settings}
				{#each Object.entries(settings.integrations) as [name, integration] (name)}
					<div class="flex items-center justify-between gap-3">
						<span class="font-medium capitalize">{name}</span>
						<Badge variant={integration.enabled ? 'secondary' : 'outline'}
							>{integration.enabled ? 'Enabled' : 'Hidden'}</Badge
						>
					</div>
				{/each}
			{:else}
				{#each [0, 1, 2] as index (index)}<Skeleton class="h-7 w-full" />{/each}
			{/if}
		</Card.Content>
		<Card.Footer
			><Button href="/admin/integrations" variant="ghost"
				>Configure integrations <ArrowRightIcon data-icon="inline-end" /></Button
			></Card.Footer
		>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Diagnostics</Card.Title>
			<Card.Description
				>Validate container reachability separately from what each browser can access.</Card.Description
			>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			<div class="flex items-center justify-between gap-3">
				<span>Internal Jellyfin</span>
				{#if diagnostics}<StatusBadge
						status={diagnostics.jellyfin.internalReachableFromContainer ? 'available' : 'degraded'}
					/>{:else}<Skeleton class="h-5 w-20" />{/if}
			</div>
			<div class="flex items-center justify-between gap-3">
				<span>Public Jellyfin</span>
				{#if diagnostics}<StatusBadge
						status={diagnostics.jellyfin.publicReachableFromContainer ? 'available' : 'degraded'}
					/>{:else}<Skeleton class="h-5 w-20" />{/if}
			</div>
		</Card.Content>
		<Card.Footer
			><Button href="/admin/system" variant="ghost"
				>Open diagnostics <ArrowRightIcon data-icon="inline-end" /></Button
			></Card.Footer
		>
	</Card.Root>
</section>
