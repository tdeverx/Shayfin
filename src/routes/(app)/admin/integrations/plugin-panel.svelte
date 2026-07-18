<script lang="ts">
	import SaveIcon from '@lucide/svelte/icons/save';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Switch } from '$lib/components/ui/switch';
	import { adminFetch } from '../admin-client';

	type PluginName = 'homeScreenSections' | 'mediaBarEnhanced' | 'achievementBadges' | 'getAvatar';
	let {
		plugin,
		initial
	}: { plugin: PluginName; initial: { enabled: boolean; unlockNotifications?: boolean } } =
		$props();

	const copy = {
		homeScreenSections: {
			title: 'Home Screen Sections',
			description: 'Use the plugin’s section order and per-user home layout when it is available.'
		},
		mediaBarEnhanced: {
			title: 'Media Bar Enhanced',
			description: 'Prefer its curated and seasonal selections for Shayfin’s home hero.'
		},
		achievementBadges: {
			title: 'Achievement Badges',
			description:
				'Show badge progress, rank, quests, records and equipped badges throughout Shayfin.'
		},
		getAvatar: {
			title: 'GetAvatar',
			description: 'Allow users to browse and select avatars supplied by the Jellyfin plugin.'
		}
	} as const;

	let enabled = $state(false);
	let unlockNotifications = $state(true);
	let saving = $state(false);
	let initialized = $state(false);
	$effect(() => {
		if (initialized) return;
		enabled = initial.enabled;
		unlockNotifications = initial.unlockNotifications ?? true;
		initialized = true;
	});

	async function save() {
		saving = true;
		try {
			const body = { enabled, ...(plugin === 'achievementBadges' ? { unlockNotifications } : {}) };
			await adminFetch(`/api/admin/plugins/${plugin}`, {
				method: 'PUT',
				body: JSON.stringify(body)
			});
			toast.success(`${copy[plugin].title} settings saved.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Plugin settings could not be saved.');
		} finally {
			saving = false;
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-start justify-between gap-4">
			<div class="space-y-1">
				<Card.Title>{copy[plugin].title}</Card.Title><Card.Description
					>{copy[plugin].description}</Card.Description
				>
			</div>
			<div class="flex shrink-0 items-center gap-3">
				<span class="text-sm text-muted-foreground">{enabled ? 'Enabled' : 'Hidden'}</span><Switch
					bind:checked={enabled}
					aria-label={`Enable ${copy[plugin].title}`}
				/>
			</div>
		</div>
	</Card.Header>
	{#if plugin === 'achievementBadges'}
		<Card.Content>
			<div class="flex items-start justify-between gap-4 rounded-xl bg-muted/50 p-4">
				<div>
					<p class="font-medium">Unlock notifications</p>
					<p class="text-sm text-muted-foreground">
						Poll for new badge unlocks and show Shayfin toasts.
					</p>
				</div>
				<Switch
					bind:checked={unlockNotifications}
					disabled={!enabled}
					aria-label="Show achievement unlock notifications"
				/>
			</div>
		</Card.Content>
	{/if}
	<Card.Footer class="justify-end"
		><Button onclick={save} disabled={saving}
			>{#if saving}<Spinner data-icon="inline-start" />{:else}<SaveIcon
					data-icon="inline-start"
				/>{/if}Save</Button
		></Card.Footer
	>
</Card.Root>
