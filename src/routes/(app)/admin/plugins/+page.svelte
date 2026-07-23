<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import AdminHeading from '../admin-heading.svelte';
	import { adminFetch, type AdminSettings } from '../admin-client';
	import PluginPanel from '../integrations/plugin-panel.svelte';
	let settings = $state<AdminSettings | null>(null);
	let error = $state<string | null>(null);
	onMount(async () => {
		try {
			settings = await adminFetch<AdminSettings>('/api/admin/settings');
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Plugin settings are unavailable.';
		}
	});
</script>

<AdminHeading
	title="Plugins"
	description="Enable only the Jellyfin plugins you use. Disabled plugin features disappear from the app."
/>
{#if error}<Alert variant="destructive"
		><AlertTitle>Plugins are unavailable</AlertTitle><AlertDescription>{error}</AlertDescription
		></Alert
	>{/if}
{#if settings}<div class="grid gap-4">
		<PluginPanel
			plugin="homeScreenSections"
			initial={settings.plugins.homeScreenSections}
		/><PluginPanel
			plugin="mediaBarEnhanced"
			initial={settings.plugins.mediaBarEnhanced}
		/><PluginPanel
			plugin="achievementBadges"
			initial={settings.plugins.achievementBadges}
		/><PluginPanel plugin="getAvatar" initial={settings.plugins.getAvatar} />
	</div>{:else if !error}<Skeleton class="h-96 w-full" />{/if}
