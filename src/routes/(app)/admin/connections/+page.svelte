<script lang="ts">
	import { onMount } from 'svelte';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import InfoIcon from '@lucide/svelte/icons/info';
	import SaveIcon from '@lucide/svelte/icons/save';
	import ServerIcon from '@lucide/svelte/icons/server';
	import { toast } from 'svelte-sonner';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Spinner } from '$lib/components/ui/spinner';
	import AdminHeading from '../admin-heading.svelte';
	import { adminFetch, type AdminSettings } from '../admin-client';

	let settings = $state<AdminSettings | null>(null);
	let publicUrl = $state('');
	let internalUrl = $state('');
	let loadingError = $state<string | null>(null);
	let saving = $state(false);

	onMount(load);

	async function load() {
		try {
			settings = await adminFetch<AdminSettings>('/api/admin/settings');
			publicUrl = settings.jellyfin?.publicUrl ?? '';
			internalUrl = settings.jellyfin?.internalUrl ?? '';
		} catch (cause) {
			loadingError = cause instanceof Error ? cause.message : 'Unable to load connection settings.';
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		try {
			settings = await adminFetch<AdminSettings>('/api/admin/settings', {
				method: 'PUT',
				body: JSON.stringify({
					jellyfinPublicUrl: publicUrl,
					jellyfinInternalUrl: internalUrl.trim() || null
				})
			});
			publicUrl = settings.jellyfin?.publicUrl ?? publicUrl;
			internalUrl = settings.jellyfin?.internalUrl ?? '';
			toast.success('Jellyfin connection updated.');
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : 'The connection could not be saved.');
		} finally {
			saving = false;
		}
	}
</script>

<AdminHeading
	title="Connections"
	description="Choose the Jellyfin address browsers use and, when needed, a separate address for this container."
>
	{#snippet actions()}
		<Button href="/admin/networking" variant="outline">Open diagnostics</Button>
	{/snippet}
</AdminHeading>

{#if loadingError}
	<Alert variant="destructive">
		<ServerIcon />
		<AlertTitle>Connection settings are unavailable</AlertTitle>
		<AlertDescription>{loadingError}</AlertDescription>
	</Alert>
{/if}

<div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
	<Card.Root>
		<Card.Header>
			<Card.Title>Jellyfin URLs</Card.Title>
			<Card.Description
				>Saving revalidates the current administrator token against the proposed address.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			{#if settings}
				<form id="connection-form" onsubmit={save}>
					<Field.Group>
						<Field.Field>
							<Field.Label for="public-url">Public URL</Field.Label>
							<Input id="public-url" type="url" inputmode="url" required bind:value={publicUrl} />
							<Field.Description
								>Used directly by browsers for API calls, images, WebSockets, and playback.</Field.Description
							>
						</Field.Field>
						<Field.Field>
							<Field.Label for="internal-url"
								>Internal URL <span class="text-muted-foreground">(optional)</span></Field.Label
							>
							<Input
								id="internal-url"
								type="url"
								inputmode="url"
								placeholder="http://jellyfin:8096"
								bind:value={internalUrl}
							/>
							<Field.Description
								>Used only by Shayfin for token validation and server health probes.</Field.Description
							>
						</Field.Field>
					</Field.Group>
				</form>
			{:else}
				<div class="flex flex-col gap-4">
					<Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" />
				</div>
			{/if}
		</Card.Content>
		<Card.Footer class="justify-end">
			<Button type="submit" form="connection-form" disabled={saving || !settings || !publicUrl}>
				{#if saving}<Spinner data-icon="inline-start" />{:else}<SaveIcon
						data-icon="inline-start"
					/>{/if}
				Save connection
			</Button>
		</Card.Footer>
	</Card.Root>

	<div class="flex flex-col gap-4">
		<Card.Root size="sm">
			<Card.Header>
				<Card.Title>Server identity</Card.Title>
				<Card.Description
					>Recorded during setup and refreshed when the connection changes.</Card.Description
				>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				{#if settings?.jellyfin}
					<div>
						<p class="font-medium">{settings.jellyfin.serverName}</p>
						<p class="text-xs break-all text-muted-foreground">{settings.jellyfin.serverId}</p>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span class="text-xs text-muted-foreground">Version</span>
						<Badge variant="outline">{settings.jellyfin.serverVersion ?? 'Unknown'}</Badge>
					</div>
					<Button
						href={settings.jellyfin.publicUrl}
						target="_blank"
						rel="noreferrer"
						variant="outline"
						class="w-full"
					>
						Open Jellyfin <ExternalLinkIcon data-icon="inline-end" />
					</Button>
				{:else}<Skeleton class="h-28 w-full" />{/if}
			</Card.Content>
		</Card.Root>

		<Alert>
			<InfoIcon />
			<AlertTitle>TLS stays outside Shayfin</AlertTitle>
			<AlertDescription
				>HTTPS deployments still need an external terminator and an HTTPS-reachable Jellyfin public
				URL.</AlertDescription
			>
		</Alert>
	</div>
</div>
