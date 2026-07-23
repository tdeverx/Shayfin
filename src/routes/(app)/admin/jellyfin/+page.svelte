<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import AdminHeading from '../admin-heading.svelte';
	import { adminFetch, type AdminSettings } from '../admin-client';
	let settings = $state<AdminSettings | null>(null);
	let publicUrl = $state('');
	let internalUrl = $state('');
	let error = $state<string | null>(null);
	let saving = $state(false);
	onMount(async () => {
		try {
			settings = await adminFetch<AdminSettings>('/api/admin/settings');
			publicUrl = settings.jellyfin?.publicUrl ?? '';
			internalUrl = settings.jellyfin?.internalUrl ?? '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Jellyfin settings are unavailable.';
		}
	});
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
			toast.success('Jellyfin connection updated.');
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : 'Jellyfin could not be saved.');
		} finally {
			saving = false;
		}
	}
</script>

<AdminHeading
	title="Jellyfin"
	description="The server Shayfin enhances. Browser traffic uses the public URL; the internal URL is optional."
/>
{#if error}<Alert variant="destructive"
		><AlertTitle>Jellyfin is unavailable</AlertTitle><AlertDescription>{error}</AlertDescription
		></Alert
	>{/if}
<Card.Root
	><Card.Content class="pt-6"
		><form class="flex flex-col gap-5" onsubmit={save}>
			<Field.Field
				><Field.Label for="public-url">Public URL</Field.Label><Input
					id="public-url"
					type="url"
					required
					bind:value={publicUrl}
				/></Field.Field
			><Field.Field
				><Field.Label for="internal-url"
					>Internal URL <span class="text-muted-foreground">(optional)</span></Field.Label
				><Input
					id="internal-url"
					type="url"
					placeholder="http://jellyfin:8096"
					bind:value={internalUrl}
				/></Field.Field
			>
			<div>
				<Button type="submit" disabled={!settings || saving}
					>{saving ? 'Saving…' : 'Save Jellyfin settings'}</Button
				>
			</div>
		</form></Card.Content
	></Card.Root
>
