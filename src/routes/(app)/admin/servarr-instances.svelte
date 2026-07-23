<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Switch } from '$lib/components/ui/switch';
	import { adminFetch, type MaskedServarrInstance } from './admin-client';

	let { service }: { service: 'sonarr' | 'radarr' } = $props();
	let label = $derived(service === 'sonarr' ? 'Sonarr' : 'Radarr');
	let placeholder = $derived(service === 'sonarr' ? 'http://sonarr:8989' : 'http://radarr:7878');
	let instances = $state<MaskedServarrInstance[]>([]);
	let loading = $state(true);
	let replacementKeys = $state<Record<string, string>>({});
	let name = $state('');
	let url = $state('');
	let apiKey = $state('');
	let enabled = $state(true);
	let adding = $state(false);
	onMount(async () => {
		try {
			instances = await adminFetch<MaskedServarrInstance[]>(`/api/admin/servarr/${service}`);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : `Unable to load ${label}.`);
		} finally {
			loading = false;
		}
	});
	async function add(event: SubmitEvent) {
		event.preventDefault();
		adding = true;
		try {
			const created = await adminFetch<MaskedServarrInstance>(`/api/admin/servarr/${service}`, {
				method: 'POST',
				body: JSON.stringify({ label: name, url, apiKey, enabled })
			});
			instances = [...instances, created];
			name = '';
			url = '';
			apiKey = '';
			enabled = true;
			toast.success(`${created.label} added.`);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : 'Instance could not be added.');
		} finally {
			adding = false;
		}
	}
	async function save(instance: MaskedServarrInstance, apiKey: string) {
		try {
			const updated = await adminFetch<MaskedServarrInstance>(
				`/api/admin/servarr/${service}/${instance.id}`,
				{
					method: 'PUT',
					body: JSON.stringify({
						label: instance.label,
						url: instance.url,
						enabled: instance.enabled,
						...(apiKey.trim() ? { apiKey: apiKey.trim() } : {})
					})
				}
			);
			instances = instances.map((entry) => (entry.id === updated.id ? updated : entry));
			toast.success(`${updated.label} saved.`);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : 'Instance could not be saved.');
		}
	}
	async function remove(instance: MaskedServarrInstance) {
		if (!confirm(`Remove ${instance.label}?`)) return;
		try {
			await adminFetch(`/api/admin/servarr/${service}/${instance.id}`, { method: 'DELETE' });
			instances = instances.filter((entry) => entry.id !== instance.id);
			toast.success(`${instance.label} removed.`);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : 'Instance could not be removed.');
		}
	}
	async function test(instance: MaskedServarrInstance) {
		try {
			const state = await adminFetch<{ status: string; message?: string }>(
				`/api/admin/servarr/${service}/${instance.id}/test`,
				{ method: 'POST' }
			);
			toast[state.status === 'available' ? 'success' : 'warning'](
				state.message ?? 'Connection tested.'
			);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : 'Connection test failed.');
		}
	}
</script>

{#if loading}<p class="text-sm text-muted-foreground">Loading instances…</p>{:else}<div
		class="grid gap-4"
	>
		{#each instances as instance (instance.id)}<Card.Root
				><Card.Header
					><div class="flex items-center justify-between gap-3">
						<Card.Title>{instance.label}</Card.Title><label class="flex items-center gap-2 text-sm"
							><Switch bind:checked={instance.enabled} /> Enabled</label
						>
					</div></Card.Header
				><Card.Content
					><div class="grid gap-4 sm:grid-cols-2">
						<Field.Field
							><Field.Label>Label</Field.Label><Input bind:value={instance.label} /></Field.Field
						><Field.Field
							><Field.Label>URL</Field.Label><Input
								type="url"
								bind:value={instance.url}
							/></Field.Field
						><Field.Field
							><Field.Label>API key</Field.Label><Input
								type="password"
								bind:value={replacementKeys[instance.id]}
								placeholder={instance.apiKeyConfigured
									? 'Stored securely — replacement only'
									: 'Enter API key'}
							/></Field.Field
						>
					</div>
					<div class="mt-4 flex flex-wrap gap-2">
						<Button onclick={() => save(instance, replacementKeys[instance.id] ?? '')}>Save</Button
						><Button variant="outline" onclick={() => test(instance)}>Test</Button><Button
							variant="destructive"
							onclick={() => remove(instance)}>Delete</Button
						>
					</div></Card.Content
				></Card.Root
			>{:else}<Card.Root
				><Card.Content class="py-6 text-sm text-muted-foreground"
					>No {label} instances are configured.</Card.Content
				></Card.Root
			>{/each}
	</div>{/if}
<Card.Root class="mt-6"
	><Card.Header
		><Card.Title>Add {label}</Card.Title><Card.Description
			>Give each server a unique, recognizable label.</Card.Description
		></Card.Header
	><Card.Content
		><form class="grid gap-4 sm:grid-cols-2" onsubmit={add}>
			<Field.Field
				><Field.Label for={`${service}-name`}>Label</Field.Label><Input
					id={`${service}-name`}
					required
					bind:value={name}
					placeholder="Main library"
				/></Field.Field
			><Field.Field
				><Field.Label for={`${service}-url`}>URL</Field.Label><Input
					id={`${service}-url`}
					type="url"
					required
					bind:value={url}
					{placeholder}
				/></Field.Field
			><Field.Field
				><Field.Label for={`${service}-key`}>API key</Field.Label><Input
					id={`${service}-key`}
					type="password"
					required
					bind:value={apiKey}
				/></Field.Field
			>
			<div class="flex items-end justify-between gap-3">
				<label class="flex items-center gap-2 text-sm"
					><Switch bind:checked={enabled} /> Enabled</label
				><Button type="submit" disabled={adding}>{adding ? 'Adding…' : `Add ${label}`}</Button>
			</div>
		</form></Card.Content
	></Card.Root
>
