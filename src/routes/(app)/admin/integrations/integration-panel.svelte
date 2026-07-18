<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SaveIcon from '@lucide/svelte/icons/save';
	import { toast } from 'svelte-sonner';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Switch } from '$lib/components/ui/switch';
	import StatusBadge from '../status-badge.svelte';
	import { adminFetch, type CapabilityState, type MaskedIntegration } from '../admin-client';

	type Service = 'seerr' | 'sonarr' | 'radarr';

	let {
		service,
		initial,
		onSaved
	}: {
		service: Service;
		initial: MaskedIntegration;
		onSaved: (service: Service, value: MaskedIntegration) => void;
	} = $props();

	const content = {
		seerr: {
			label: 'Seerr',
			description:
				'Adds discovery, requests, request history, and the ownership map used to protect download privacy.',
			placeholder: 'http://seerr:5055'
		},
		sonarr: {
			label: 'Sonarr',
			description:
				'Reads episodic download progress and import state from the API v3 queue. Shayfin never mutates it.',
			placeholder: 'http://sonarr:8989'
		},
		radarr: {
			label: 'Radarr',
			description:
				'Reads movie download progress and import state from the API v3 queue. Shayfin never mutates it.',
			placeholder: 'http://radarr:7878'
		}
	} as const;

	let initialized = $state(false);
	let enabled = $state(false);
	let url = $state('');
	let apiKey = $state('');
	let apiKeyConfigured = $state(false);
	let mappedUsers = $state<number | undefined>();
	let busy = $state<'save' | 'test' | 'sync' | null>(null);
	let testState = $state<CapabilityState | null>(null);

	$effect(() => {
		if (initialized) return;
		enabled = initial.enabled;
		url = initial.url;
		apiKeyConfigured = initial.apiKeyConfigured;
		mappedUsers = initial.mappedUsers;
		initialized = true;
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!url.trim()) {
			toast.error(`Enter the ${content[service].label} URL before saving.`);
			return;
		}
		busy = 'save';
		try {
			const body: { enabled: boolean; url: string; apiKey?: string } = { enabled, url };
			if (apiKey.trim()) body.apiKey = apiKey.trim();
			const saved = await adminFetch<MaskedIntegration>(`/api/admin/integrations/${service}`, {
				method: 'PUT',
				body: JSON.stringify(body)
			});
			url = saved.url;
			enabled = saved.enabled;
			apiKeyConfigured = saved.apiKeyConfigured;
			mappedUsers = saved.mappedUsers;
			apiKey = '';
			testState = null;
			onSaved(service, saved);
			toast.success(`${content[service].label} settings saved.`);
		} catch (cause) {
			toast.error(
				cause instanceof Error ? cause.message : 'Integration settings could not be saved.'
			);
		} finally {
			busy = null;
		}
	}

	async function testConnection() {
		busy = 'test';
		try {
			testState = await adminFetch<CapabilityState>(`/api/admin/integrations/${service}/test`, {
				method: 'POST'
			});
			if (testState.status === 'available')
				toast.success(testState.message ?? 'Connection available.');
			else toast.warning(testState.message ?? 'The integration is degraded.');
		} catch (cause) {
			testState = {
				status: 'misconfigured',
				message: cause instanceof Error ? cause.message : 'Connection test failed.'
			};
			toast.error(testState.message ?? 'Connection test failed.');
		} finally {
			busy = null;
		}
	}

	async function syncUsers() {
		busy = 'sync';
		try {
			const result = await adminFetch<{ total: number; mapped: number; missing: string[] }>(
				'/api/admin/integrations/seerr/sync-users',
				{ method: 'POST' }
			);
			mappedUsers = result.mapped;
			onSaved(service, { enabled, url, apiKeyConfigured, mappedUsers });
			if (result.missing.length) {
				toast.warning(`Mapped ${result.mapped} of ${result.total} Jellyfin users.`);
			} else {
				toast.success(`Mapped all ${result.mapped} Jellyfin users.`);
			}
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : 'User synchronization failed.');
		} finally {
			busy = null;
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex flex-col gap-1">
				<div class="flex items-center gap-2">
					<Card.Title>{content[service].label}</Card.Title>
					{#if apiKeyConfigured}<Badge variant="secondary"><KeyRoundIcon />Key stored</Badge>{/if}
				</div>
				<Card.Description>{content[service].description}</Card.Description>
			</div>
			<div class="flex items-center gap-3">
				<span class="text-sm text-muted-foreground">{enabled ? 'Enabled' : 'Hidden'}</span>
				<Switch bind:checked={enabled} aria-label={`Enable ${content[service].label}`} />
			</div>
		</div>
	</Card.Header>
	<Card.Content class="flex flex-col gap-5">
		<form id={`${service}-form`} onsubmit={save}>
			<Field.Group>
				<Field.Field>
					<Field.Label for={`${service}-url`}>Service URL</Field.Label>
					<Input
						id={`${service}-url`}
						type="url"
						inputmode="url"
						placeholder={content[service].placeholder}
						bind:value={url}
					/>
					<Field.Description
						>A container-reachable URL; no trailing API path is needed.</Field.Description
					>
				</Field.Field>
				<Field.Field>
					<Field.Label for={`${service}-key`}>API key</Field.Label>
					<Input
						id={`${service}-key`}
						type="password"
						autocomplete="off"
						placeholder={apiKeyConfigured
							? 'Stored securely — enter a replacement only'
							: 'Enter API key'}
						bind:value={apiKey}
					/>
					<Field.Description
						>Leaving this blank preserves the encrypted key already stored in Shayfin.</Field.Description
					>
				</Field.Field>
			</Field.Group>
		</form>

		{#if testState}
			<Alert variant={testState.status === 'misconfigured' ? 'destructive' : 'default'}>
				{#if testState.status === 'available'}<CheckIcon />{:else}<FlaskConicalIcon />{/if}
				<AlertTitle class="flex items-center gap-2"
					>Connection test <StatusBadge status={testState.status} /></AlertTitle
				>
				<AlertDescription
					>{testState.message ?? 'No additional details were returned.'}</AlertDescription
				>
			</Alert>
		{/if}

		{#if service === 'seerr'}
			<div
				class="flex flex-col gap-3 rounded-xl bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between"
			>
				<div>
					<p class="font-medium">Jellyfin user map</p>
					<p class="text-xs text-muted-foreground">
						{mappedUsers ?? 0} users currently mapped to Seerr request identities.
					</p>
				</div>
				<Button
					variant="outline"
					onclick={syncUsers}
					disabled={busy !== null || !enabled || !apiKeyConfigured}
				>
					{#if busy === 'sync'}<Spinner data-icon="inline-start" />{:else}<RefreshCwIcon
							data-icon="inline-start"
						/>{/if}
					Sync users
				</Button>
			</div>
		{/if}
	</Card.Content>
	<Card.Footer class="flex-wrap justify-end gap-2">
		<Button
			variant="outline"
			onclick={testConnection}
			disabled={busy !== null || !enabled || !apiKeyConfigured}
		>
			{#if busy === 'test'}<Spinner data-icon="inline-start" />{:else}<FlaskConicalIcon
					data-icon="inline-start"
				/>{/if}
			Test connection
		</Button>
		<Button type="submit" form={`${service}-form`} disabled={busy !== null || !url.trim()}>
			{#if busy === 'save'}<Spinner data-icon="inline-start" />{:else}<SaveIcon
					data-icon="inline-start"
				/>{/if}
			Save {content[service].label}
		</Button>
	</Card.Footer>
</Card.Root>
