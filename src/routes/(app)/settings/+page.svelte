<script lang="ts">
	import Volume2Icon from '@lucide/svelte/icons/volume-2';
	import { session } from '$lib/app/session.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';

	function setThemeMusic(checked: boolean) {
		session.setThemeAudio(checked);
	}
</script>

<svelte:head><title>Settings · Shayfin</title></svelte:head>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="space-y-1">
		<p class="text-sm text-muted-foreground">Your account</p>
		<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
		<p class="text-sm text-muted-foreground">Preferences stored for this Jellyfin account.</p>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Playback experience</Card.Title>
			<Card.Description>Control optional sound and playback behaviour.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex items-center justify-between gap-6">
				<div class="flex min-w-0 items-start gap-3">
					<div class="mt-0.5 rounded-full bg-muted p-2 text-muted-foreground">
						<Volume2Icon class="size-4" />
					</div>
					<div class="space-y-1">
						<Label for="theme-music">Theme music</Label>
						<p class="text-sm text-muted-foreground">
							Automatically play available theme music on detail pages at half volume.
						</p>
					</div>
				</div>
				<Switch
					id="theme-music"
					checked={session.themeAudioEnabled}
					onCheckedChange={setThemeMusic}
					aria-label="Theme music"
				/>
			</div>
		</Card.Content>
	</Card.Root>
</div>
