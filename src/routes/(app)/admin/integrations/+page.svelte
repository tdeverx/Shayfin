<script lang="ts">
	import { onMount } from 'svelte';
	import PuzzleIcon from '@lucide/svelte/icons/puzzle';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Tabs from '$lib/components/ui/tabs';
	import AdminHeading from '../admin-heading.svelte';
	import { adminFetch, type AdminSettings, type MaskedIntegration } from '../admin-client';
	import IntegrationPanel from './integration-panel.svelte';

	type Service = 'seerr' | 'sonarr' | 'radarr';
	let settings = $state<AdminSettings | null>(null);
	let error = $state<string | null>(null);
	let active = $state('seerr');

	onMount(async () => {
		try {
			settings = await adminFetch<AdminSettings>('/api/admin/settings');
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Integration settings are unavailable.';
		}
	});

	function update(service: Service, value: MaskedIntegration) {
		if (!settings) return;
		settings.integrations[service] = value;
	}
</script>

<AdminHeading
	title="Integrations"
	description="Connect optional services without exposing their API keys to the browser. Each capability disappears when it is disabled or unavailable."
/>

{#if error}
	<Alert variant="destructive">
		<PuzzleIcon />
		<AlertTitle>Integrations could not be loaded</AlertTitle>
		<AlertDescription>{error}</AlertDescription>
	</Alert>
{/if}

{#if settings}
	<Tabs.Root bind:value={active}>
		<Tabs.List class="w-full sm:w-fit">
			<Tabs.Trigger value="seerr">Seerr</Tabs.Trigger>
			<Tabs.Trigger value="sonarr">Sonarr</Tabs.Trigger>
			<Tabs.Trigger value="radarr">Radarr</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="seerr"
			><IntegrationPanel
				service="seerr"
				initial={settings.integrations.seerr}
				onSaved={update}
			/></Tabs.Content
		>
		<Tabs.Content value="sonarr"
			><IntegrationPanel
				service="sonarr"
				initial={settings.integrations.sonarr}
				onSaved={update}
			/></Tabs.Content
		>
		<Tabs.Content value="radarr"
			><IntegrationPanel
				service="radarr"
				initial={settings.integrations.radarr}
				onSaved={update}
			/></Tabs.Content
		>
	</Tabs.Root>
{:else if !error}
	<div class="flex flex-col gap-4">
		<Skeleton class="h-9 w-72" /><Skeleton class="h-96 w-full" />
	</div>
{/if}
