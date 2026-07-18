<script lang="ts">
	import { onMount } from 'svelte';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { toast } from 'svelte-sonner';
	import * as Accordion from '$lib/components/ui/accordion';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Spinner } from '$lib/components/ui/spinner';
	import { session } from '$lib/app/session.svelte';
	import AdminHeading from '../admin-heading.svelte';
	import StatusBadge from '../status-badge.svelte';
	import {
		adminFetch,
		type AdminSettings,
		type DownloadResponse,
		type HealthResponse,
		type NetworkDiagnostics
	} from '../admin-client';

	let live = $state<HealthResponse | null>(null);
	let ready = $state<HealthResponse | null>(null);
	let settings = $state<AdminSettings | null>(null);
	let diagnostics = $state<NetworkDiagnostics | null>(null);
	let downloads = $state<DownloadResponse | null>(null);
	let error = $state<string | null>(null);
	let refreshing = $state(false);

	onMount(() => {
		void refresh();
	});

	async function health(path: string): Promise<HealthResponse> {
		const response = await fetch(path);
		return (await response.json()) as HealthResponse;
	}

	async function refresh() {
		refreshing = true;
		error = null;
		const results = await Promise.allSettled([
			health('/api/health/live'),
			health('/api/health/ready'),
			adminFetch<AdminSettings>('/api/admin/settings'),
			adminFetch<NetworkDiagnostics>('/api/admin/diagnostics'),
			adminFetch<DownloadResponse>('/api/external/downloads')
		]);
		if (results[0].status === 'fulfilled') live = results[0].value;
		if (results[1].status === 'fulfilled') ready = results[1].value;
		if (results[2].status === 'fulfilled') settings = results[2].value;
		if (results[3].status === 'fulfilled') diagnostics = results[3].value;
		if (results[4].status === 'fulfilled') downloads = results[4].value;
		const failed = results.filter((result) => result.status === 'rejected');
		if (failed.length)
			error = `${failed.length} diagnostic ${failed.length === 1 ? 'check' : 'checks'} could not be completed.`;
		refreshing = false;
	}

	function report() {
		return {
			generatedAt: new Date().toISOString(),
			appVersion: live?.version ?? session.bootstrap?.version,
			user: session.user
				? {
						id: session.user.id,
						name: session.user.name,
						administrator: session.user.isAdministrator
					}
				: null,
			live,
			ready,
			settings,
			diagnostics,
			externalCapabilities: downloads?.capabilities
		};
	}

	async function copyReport() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(report(), null, 2));
			toast.success('Masked diagnostics copied.');
		} catch {
			toast.error('The browser could not copy diagnostics.');
		}
	}
</script>

<AdminHeading
	title="System"
	description="Container health, masked configuration, and external capability status in one support-friendly view."
>
	{#snippet actions()}
		<Button variant="outline" onclick={copyReport} disabled={!live}>
			<ClipboardIcon data-icon="inline-start" />
			Copy report
		</Button>
		<Button variant="outline" onclick={refresh} disabled={refreshing}>
			{#if refreshing}<Spinner data-icon="inline-start" />{:else}<RefreshCwIcon
					data-icon="inline-start"
				/>{/if}
			Refresh
		</Button>
	{/snippet}
</AdminHeading>

{#if error}
	<Alert>
		<SettingsIcon />
		<AlertTitle>Some diagnostics are incomplete</AlertTitle>
		<AlertDescription>{error} Available results are still shown below.</AlertDescription>
	</Alert>
{/if}

<section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<Card.Root size="sm">
		<Card.Header
			><Card.Title>Process</Card.Title><Card.Description
				>Lightweight liveness endpoint</Card.Description
			></Card.Header
		>
		<Card.Content
			>{#if live}<StatusBadge
					status={live.status === 'ok' ? 'available' : 'degraded'}
					label={live.status}
				/>{:else}<Skeleton class="h-5 w-20" />{/if}</Card.Content
		>
	</Card.Root>
	<Card.Root size="sm">
		<Card.Header
			><Card.Title>Readiness</Card.Title><Card.Description
				>Configuration and Jellyfin probe</Card.Description
			></Card.Header
		>
		<Card.Content
			>{#if ready}<StatusBadge
					status={ready.status === 'ready' ? 'available' : 'degraded'}
					label={ready.status}
				/>{:else}<Skeleton class="h-5 w-20" />{/if}</Card.Content
		>
	</Card.Root>
	<Card.Root size="sm">
		<Card.Header
			><Card.Title>Shayfin</Card.Title><Card.Description
				>Running application version</Card.Description
			></Card.Header
		>
		<Card.Content
			>{#if live}<Badge variant="outline">{live.version}</Badge>{:else}<Skeleton
					class="h-5 w-16"
				/>{/if}</Card.Content
		>
	</Card.Root>
	<Card.Root size="sm">
		<Card.Header
			><Card.Title>Jellyfin</Card.Title><Card.Description
				>Configured server version</Card.Description
			></Card.Header
		>
		<Card.Content
			>{#if settings}<Badge variant="outline">{settings.jellyfin?.serverVersion ?? 'Unknown'}</Badge
				>{:else}<Skeleton class="h-5 w-16" />{/if}</Card.Content
		>
	</Card.Root>
</section>

<div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
	<Card.Root>
		<Card.Header>
			<Card.Title>Health checks</Card.Title>
			<Card.Description
				>External integrations do not affect container readiness or trigger restart loops.</Card.Description
			>
		</Card.Header>
		<Card.Content class="flex flex-col gap-0">
			<div class="flex items-center justify-between gap-4 py-3 first:pt-0">
				<div>
					<p class="font-medium">Configuration store</p>
					<p class="text-xs text-muted-foreground">Encrypted runtime configuration is readable.</p>
				</div>
				{#if ready}<StatusBadge
						status={ready.checks?.config ? 'available' : 'degraded'}
					/>{:else}<Skeleton class="h-5 w-20" />{/if}
			</div>
			<Separator />
			<div class="flex items-center justify-between gap-4 py-3">
				<div>
					<p class="font-medium">Jellyfin readiness</p>
					<p class="text-xs text-muted-foreground">
						The internal or public server URL answers a health probe.
					</p>
				</div>
				{#if ready}<StatusBadge
						status={ready.checks?.jellyfin ? 'available' : 'degraded'}
					/>{:else}<Skeleton class="h-5 w-20" />{/if}
			</div>
			<Separator />
			<div class="flex items-center justify-between gap-4 py-3 last:pb-0">
				<div>
					<p class="font-medium">Browser compatibility</p>
					<p class="text-xs text-muted-foreground">
						CORS and protocol pairing support browser-direct traffic.
					</p>
				</div>
				{#if diagnostics}<StatusBadge
						status={diagnostics.jellyfin.cors === 'allowed' && !diagnostics.jellyfin.mixedContent
							? 'available'
							: 'degraded'}
					/>{:else}<Skeleton class="h-5 w-20" />{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>External services</Card.Title>
			<Card.Description
				>Current queue-path capability without making these services readiness dependencies.</Card.Description
			>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			{#if downloads}
				{#each Object.entries(downloads.capabilities) as [service, capability] (service)}
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="font-medium capitalize">{service}</p>
							{#if capability.message}<p class="mt-1 text-xs text-muted-foreground">
									{capability.message}
								</p>{/if}
						</div>
						<StatusBadge status={capability.status} />
					</div>
				{/each}
			{:else}
				{#each [0, 1, 2] as index (index)}<Skeleton class="h-12 w-full" />{/each}
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<Card.Root>
	<Card.Header>
		<Card.Title>Masked runtime details</Card.Title>
		<Card.Description
			>Secret values are never included. Expand a section before copying or inspecting support data.</Card.Description
		>
	</Card.Header>
	<Card.Content>
		<Accordion.Root type="multiple">
			<Accordion.Item value="identity">
				<Accordion.Trigger>Server and administrator identity</Accordion.Trigger>
				<Accordion.Content>
					<div class="grid gap-3 rounded-xl bg-muted/50 p-4 text-xs sm:grid-cols-2">
						<div>
							<span class="block text-muted-foreground">Jellyfin server</span><span
								>{settings?.jellyfin?.serverName ?? 'Unavailable'}</span
							>
						</div>
						<div>
							<span class="block text-muted-foreground">Server ID</span><span class="break-all"
								>{settings?.jellyfin?.serverId ?? 'Unavailable'}</span
							>
						</div>
						<div>
							<span class="block text-muted-foreground">Signed in as</span><span
								>{session.user?.name ?? 'Unavailable'}</span
							>
						</div>
						<div>
							<span class="block text-muted-foreground">Administrator</span><span
								>{session.user?.isAdministrator ? 'Yes' : 'No'}</span
							>
						</div>
					</div>
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="json">
				<Accordion.Trigger>Diagnostic JSON preview</Accordion.Trigger>
				<Accordion.Content
					><pre class="max-h-96 overflow-auto rounded-xl bg-muted/50 p-4 text-xs">{JSON.stringify(
							report(),
							null,
							2
						)}</pre></Accordion.Content
				>
			</Accordion.Item>
		</Accordion.Root>
	</Card.Content>
</Card.Root>

<Alert>
	<CheckCircleIcon />
	<AlertTitle>Deployment controls stay outside the app</AlertTitle>
	<AlertDescription
		>Listen host, port, TLS termination, restart policy, and container resource limits belong to
		your Docker deployment rather than mutable admin settings.</AlertDescription
	>
</Alert>
