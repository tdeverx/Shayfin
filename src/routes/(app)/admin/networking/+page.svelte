<script lang="ts">
	import { onMount } from 'svelte';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import NetworkIcon from '@lucide/svelte/icons/network';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import WifiIcon from '@lucide/svelte/icons/wifi';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Spinner } from '$lib/components/ui/spinner';
	import AdminHeading from '../admin-heading.svelte';
	import { adminFetch, type CapabilityStatus, type NetworkDiagnostics } from '../admin-client';
	import CheckRow from './check-row.svelte';
	import { session } from '$lib/app/session.svelte';

	let diagnostics = $state<NetworkDiagnostics | null>(null);
	let error = $state<string | null>(null);
	let refreshing = $state(false);
	let websocketStatus = $state<CapabilityStatus>('unavailable');
	let websocketMessage = $state('Not checked yet.');

	onMount(() => {
		void refresh();
	});

	async function checkWebSocket(url: string) {
		if (!session.accessToken) {
			websocketStatus = 'misconfigured';
			websocketMessage = 'No active Jellyfin token is available.';
			return;
		}
		websocketStatus = 'unavailable';
		websocketMessage = 'Checking from this browser…';
		const target = new URL(url);
		target.searchParams.set('api_key', session.accessToken);
		await new Promise<void>((resolve) => {
			const socket = new WebSocket(target);
			const timer = window.setTimeout(() => {
				websocketStatus = 'degraded';
				websocketMessage = 'The browser did not establish a WebSocket within five seconds.';
				socket.close();
				resolve();
			}, 5_000);
			socket.onopen = () => {
				window.clearTimeout(timer);
				websocketStatus = 'available';
				websocketMessage = 'This browser established a Jellyfin WebSocket.';
				socket.close();
				resolve();
			};
			socket.onerror = () => {
				window.clearTimeout(timer);
				websocketStatus = 'degraded';
				websocketMessage = 'The browser could not open the Jellyfin WebSocket.';
				socket.close();
				resolve();
			};
		});
	}

	async function refresh() {
		refreshing = true;
		try {
			diagnostics = await adminFetch<NetworkDiagnostics>('/api/admin/diagnostics');
			error = null;
			await checkWebSocket(diagnostics.jellyfin.websocketUrl);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Networking diagnostics are unavailable.';
		} finally {
			refreshing = false;
		}
	}
</script>

<AdminHeading
	title="Networking"
	description="See which addresses Shayfin and this browser can reach, without pretending deployment-time TLS or ports are app settings."
>
	{#snippet actions()}
		<Button variant="outline" onclick={refresh} disabled={refreshing}>
			{#if refreshing}<Spinner data-icon="inline-start" />{:else}<RefreshCwIcon
					data-icon="inline-start"
				/>{/if}
			Run checks
		</Button>
	{/snippet}
</AdminHeading>

{#if error}
	<Alert variant="destructive">
		<NetworkIcon />
		<AlertTitle>Diagnostics could not run</AlertTitle>
		<AlertDescription>{error}</AlertDescription>
	</Alert>
{/if}

{#if diagnostics?.jellyfin.mixedContent}
	<Alert variant="destructive">
		<ShieldAlertIcon />
		<AlertTitle>Mixed content will block browser-direct playback</AlertTitle>
		<AlertDescription
			>Shayfin is served over HTTPS, but the Jellyfin public URL uses HTTP. Make Jellyfin
			browser-reachable over HTTPS before using this deployment.</AlertDescription
		>
	</Alert>
{/if}

<section class="grid gap-4 md:grid-cols-3">
	<Card.Root size="sm">
		<Card.Header
			><Card.Title>Detected origin</Card.Title><Card.Description
				>The address this request used to reach Shayfin.</Card.Description
			></Card.Header
		>
		<Card.Content
			>{#if diagnostics}<p class="font-medium break-all">{diagnostics.origin}</p>{:else}<Skeleton
					class="h-6 w-full"
				/>{/if}</Card.Content
		>
	</Card.Root>
	<Card.Root size="sm">
		<Card.Header
			><Card.Title>Deployment host</Card.Title><Card.Description
				>Observed host and port, not a mutable app setting.</Card.Description
			></Card.Header
		>
		<Card.Content
			>{#if diagnostics}<div class="flex items-center gap-2">
					<Badge variant="outline">{diagnostics.deployment.protocol.toUpperCase()}</Badge>
					<p class="font-medium break-all">
						{diagnostics.deployment.host}:{diagnostics.deployment.port}
					</p>
				</div>{:else}<Skeleton class="h-6 w-full" />{/if}</Card.Content
		>
	</Card.Root>
	<Card.Root size="sm">
		<Card.Header
			><Card.Title>Protocol pairing</Card.Title><Card.Description
				>Browser security compatibility for media requests.</Card.Description
			></Card.Header
		>
		<Card.Content
			>{#if diagnostics}<Badge
					variant={diagnostics.jellyfin.mixedContent ? 'destructive' : 'secondary'}
					>{diagnostics.jellyfin.mixedContent ? 'Mixed content' : 'Compatible'}</Badge
				>{:else}<Skeleton class="h-5 w-24" />{/if}</Card.Content
		>
	</Card.Root>
</section>

<div class="grid items-start gap-6 xl:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<GlobeIcon class="text-muted-foreground" /><Card.Title>Jellyfin reachability</Card.Title>
			</div>
			<Card.Description
				>Public is browser-facing. Internal is used only by the Shayfin server.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			{#if diagnostics}
				<CheckRow
					label="Public URL from container"
					value={diagnostics.jellyfin.publicUrl}
					status={diagnostics.jellyfin.publicReachableFromContainer ? 'available' : 'degraded'}
				/>
				<Separator />
				<CheckRow
					label="Internal URL from container"
					value={diagnostics.jellyfin.internalUrl}
					status={diagnostics.jellyfin.internalReachableFromContainer ? 'available' : 'degraded'}
				/>
				<Separator />
				<CheckRow
					label="CORS response"
					value={diagnostics.jellyfin.corsAllowOrigin ?? 'No Access-Control-Allow-Origin returned'}
					status={diagnostics.jellyfin.cors === 'allowed'
						? 'available'
						: diagnostics.jellyfin.cors === 'blocked'
							? 'degraded'
							: 'unavailable'}
				/>
			{:else}
				<div class="flex flex-col gap-4">
					{#each [0, 1, 2] as index (index)}<Skeleton class="h-14 w-full" />{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<WifiIcon class="text-muted-foreground" /><Card.Title>Browser WebSocket</Card.Title>
			</div>
			<Card.Description
				>Opened directly from this browser with the current Jellyfin session.</Card.Description
			>
		</Card.Header>
		<Card.Content class="flex flex-col gap-4">
			{#if diagnostics}
				<CheckRow
					label="Jellyfin socket"
					value={diagnostics.jellyfin.websocketUrl}
					status={websocketStatus}
				>
					{#snippet detail()}{websocketMessage}{/snippet}
				</CheckRow>
				<Alert>
					<NetworkIcon />
					<AlertTitle>Browser-direct by design</AlertTitle>
					<AlertDescription
						>Artwork, API traffic, media, and playback WebSockets do not pass through Shayfin. A
						container health check cannot prove that every client network can reach Jellyfin.</AlertDescription
					>
				</Alert>
			{:else}<Skeleton class="h-32 w-full" />{/if}
		</Card.Content>
	</Card.Root>
</div>
