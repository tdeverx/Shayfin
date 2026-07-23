<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Switch } from '$lib/components/ui/switch';
	import AdminHeading from '../admin-heading.svelte';
	import { adminFetch, type CapabilityState, type MaskedIntegration } from '../admin-client';

	let value = $state<MaskedIntegration | null>(null);
	let enabled = $state(false);
	let url = $state('');
	let apiKey = $state('');
	let busy = $state(false);
	let result = $state<CapabilityState | null>(null);
	let error = $state<string | null>(null);
	onMount(async () => {
		try {
			value = await adminFetch<MaskedIntegration>('/api/admin/seerr');
			enabled = value.enabled;
			url = value.url;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Seerr settings are unavailable.';
		}
	});
	async function save(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		try {
			const body: { enabled: boolean; url: string; apiKey?: string } = { enabled, url };
			if (apiKey.trim()) body.apiKey = apiKey.trim();
			value = await adminFetch<MaskedIntegration>('/api/admin/seerr', {
				method: 'PUT',
				body: JSON.stringify(body)
			});
			apiKey = '';
			toast.success('Seerr settings saved.');
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : 'Seerr could not be saved.');
		} finally {
			busy = false;
		}
	}
	async function test() {
		busy = true;
		try {
			result = await adminFetch<CapabilityState>('/api/admin/seerr/test', { method: 'POST' });
		} catch (cause) {
			result = {
				status: 'misconfigured',
				message: cause instanceof Error ? cause.message : 'Connection test failed.'
			};
		} finally {
			busy = false;
		}
	}
	async function sync() {
		busy = true;
		try {
			const sync = await adminFetch<{ total: number; mapped: number; missing: string[] }>(
				'/api/admin/seerr/sync-users',
				{ method: 'POST' }
			);
			toast.success(`Mapped ${sync.mapped} of ${sync.total} Jellyfin users.`);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : 'User sync failed.');
		} finally {
			busy = false;
		}
	}
</script>

<AdminHeading
	title="Seerr"
	description="Discovery, requests, and the ownership map that keeps personal download queues private."
/>
{#if error}<Alert variant="destructive"
		><AlertTitle>Seerr is unavailable</AlertTitle><AlertDescription>{error}</AlertDescription
		></Alert
	>{/if}
<Card.Root>
	<Card.Content class="pt-6">
		<form class="flex flex-col gap-5" onsubmit={save}>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="font-medium">Enable Seerr</p>
					<p class="text-sm text-muted-foreground">Disabled services are hidden from non-admins.</p>
				</div>
				<Switch bind:checked={enabled} />
			</div>
			<Field.Field
				><Field.Label for="seerr-url">Service URL</Field.Label><Input
					id="seerr-url"
					type="url"
					required
					placeholder="http://seerr:5055"
					bind:value={url}
				/></Field.Field
			>
			<Field.Field
				><Field.Label for="seerr-key">API key</Field.Label><Input
					id="seerr-key"
					type="password"
					placeholder={value?.apiKeyConfigured
						? 'Stored securely — enter a replacement only'
						: 'Enter API key'}
					bind:value={apiKey}
				/></Field.Field
			>
			<div class="flex flex-wrap gap-2">
				<Button type="submit" disabled={busy || !url}
					>{#if busy}<Spinner data-icon="inline-start" />{/if}Save</Button
				><Button
					type="button"
					variant="outline"
					onclick={test}
					disabled={busy || !value?.apiKeyConfigured}>Test connection</Button
				><Button
					type="button"
					variant="outline"
					onclick={sync}
					disabled={busy || !enabled || !value?.apiKeyConfigured}>Sync Jellyfin users</Button
				>
			</div>
		</form>
	</Card.Content>
</Card.Root>
{#if result}<Alert
		><AlertTitle>Connection {result.status}</AlertTitle><AlertDescription
			>{result.message ?? 'No further details were returned.'}</AlertDescription
		></Alert
	>{/if}
