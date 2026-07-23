<script lang="ts">
	import { onMount } from 'svelte';
	import Volume2Icon from '@lucide/svelte/icons/volume-2';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import ListVideoIcon from '@lucide/svelte/icons/list-video';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import { session } from '$lib/app/session.svelte';
	import { pluginEnabled } from '$lib/app/plugin-capabilities';
	import {
		BITRATE_OPTIONS,
		RESOLUTION_OPTIONS,
		type PlaybackBitrate,
		type PlaybackResolution
	} from '$lib/app/preferences';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import {
		AchievementBadgesAdapter,
		type AchievementPublicConfig,
		type AchievementUserPreferences
	} from '$lib/jellyfin';

	let achievementConfig = $state<AchievementPublicConfig | null>(null);
	let achievementPreferences = $state<AchievementUserPreferences | null>(null);
	let achievementSaving = $state(false);

	function setThemeMusic(checked: boolean) {
		session.setThemeAudio(checked);
	}

	function setResolution(value: unknown) {
		const parsed = value === 'auto' ? 'auto' : Number(value);
		if (!RESOLUTION_OPTIONS.includes(parsed as PlaybackResolution)) return;
		session.setPlaybackQuality({
			...session.preferences.playback.quality,
			maxResolution: parsed as PlaybackResolution
		});
	}

	function setBitrate(value: unknown) {
		const parsed = value === 'auto' ? 'auto' : Number(value);
		if (!BITRATE_OPTIONS.includes(parsed as PlaybackBitrate)) return;
		session.setPlaybackQuality({
			...session.preferences.playback.quality,
			maxBitrateMbps: parsed as PlaybackBitrate
		});
	}

	onMount(async () => {
		await session.initialize();
		if (!session.api || !session.user || !pluginEnabled(session.bootstrap, 'achievementBadges'))
			return;
		const adapter = new AchievementBadgesAdapter(session.api);
		const [config, preferences] = await Promise.all([
			adapter.getPublicConfig(),
			adapter.getPreferences(session.user.id)
		]);
		achievementConfig = config.data ?? null;
		achievementPreferences = preferences.data ?? null;
	});

	async function updateAchievementPreference(key: string, value: boolean) {
		if (!session.api || !session.user || !achievementPreferences || achievementSaving) return;
		achievementSaving = true;
		const result = await new AchievementBadgesAdapter(session.api).updatePreferences(
			session.user.id,
			{ [key]: value }
		);
		if (result.data) achievementPreferences = result.data;
		achievementSaving = false;
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
			<div class="grid gap-6">
				<div
					class="grid gap-4 rounded-3xl border border-border p-4 sm:grid-cols-[1fr_11rem_11rem] sm:items-end"
				>
					<div class="flex min-w-0 items-start gap-3">
						<div class="mt-0.5 rounded-full bg-muted p-2 text-muted-foreground">
							<GaugeIcon class="size-4" />
						</div>
						<div class="space-y-1">
							<Label>Default quality</Label>
							<p class="text-sm text-muted-foreground">
								Limit resolution and bandwidth for new playback sessions.
							</p>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="quality-resolution">Resolution</Label>
						<Select.Root
							type="single"
							value={String(session.preferences.playback.quality.maxResolution)}
							onValueChange={setResolution}
						>
							<Select.Trigger id="quality-resolution" class="w-full">
								<span data-slot="select-value">
									{session.preferences.playback.quality.maxResolution === 'auto'
										? 'Auto'
										: `${session.preferences.playback.quality.maxResolution}p`}
								</span>
							</Select.Trigger>
							<Select.Content>
								{#each RESOLUTION_OPTIONS as option (option)}
									<Select.Item value={String(option)}
										>{option === 'auto' ? 'Auto' : `${option}p`}</Select.Item
									>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div class="space-y-2">
						<Label for="quality-bitrate">Bitrate</Label>
						<Select.Root
							type="single"
							value={String(session.preferences.playback.quality.maxBitrateMbps)}
							onValueChange={setBitrate}
						>
							<Select.Trigger id="quality-bitrate" class="w-full">
								<span data-slot="select-value">
									{session.preferences.playback.quality.maxBitrateMbps === 'auto'
										? 'Auto'
										: `${session.preferences.playback.quality.maxBitrateMbps} Mbps`}
								</span>
							</Select.Trigger>
							<Select.Content>
								{#each BITRATE_OPTIONS as option (option)}
									<Select.Item value={String(option)}
										>{option === 'auto' ? 'Auto' : `${option} Mbps`}</Select.Item
									>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<div class="flex items-center justify-between gap-6 rounded-3xl border border-border p-4">
					<div class="flex min-w-0 items-start gap-3">
						<div class="mt-0.5 rounded-full bg-muted p-2 text-muted-foreground">
							<ListVideoIcon class="size-4" />
						</div>
						<div class="space-y-1">
							<Label for="autoplay-next">Autoplay Next Up</Label>
							<p class="text-sm text-muted-foreground">
								Continue to the next episode after the end-of-episode countdown.
							</p>
						</div>
					</div>
					<Switch
						id="autoplay-next"
						checked={session.preferences.playback.autoplayNext}
						onCheckedChange={(checked) => session.setAutoplayNext(checked)}
					/>
				</div>

				<div class="flex items-center justify-between gap-6 rounded-3xl border border-border p-4">
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
			</div>
		</Card.Content>
	</Card.Root>

	{#if achievementPreferences}
		<Card.Root>
			<Card.Header>
				<Card.Title>Achievements and social</Card.Title>
				<Card.Description
					>Stored by Achievement Badges and shared across compatible clients.</Card.Description
				>
			</Card.Header>
			<Card.Content class="grid gap-4">
				<div class="flex items-center justify-between gap-6 rounded-3xl border p-4">
					<div class="flex items-start gap-3">
						<div class="rounded-full bg-muted p-2"><ShieldIcon class="size-4" /></div>
						<div>
							<Label for="achievement-privacy">Privacy mode</Label>
							<p class="text-sm text-muted-foreground">
								Limit what friends can see about your activity.
							</p>
						</div>
					</div>
					<Switch
						id="achievement-privacy"
						checked={achievementConfig?.forcePrivacyMode || achievementPreferences.privacyMode}
						disabled={achievementSaving || achievementConfig?.forcePrivacyMode}
						onCheckedChange={(value) => updateAchievementPreference('PrivacyMode', value)}
					/>
				</div>
				<div class="flex items-center justify-between gap-6 rounded-3xl border p-4">
					<div>
						<Label for="achievement-spoilers">Spoiler protection</Label>
						<p class="text-sm text-muted-foreground">
							Hide achievement details that may reveal story progress.
						</p>
					</div>
					<Switch
						id="achievement-spoilers"
						checked={achievementConfig?.forceSpoilerMode || achievementPreferences.spoilerMode}
						disabled={achievementSaving || achievementConfig?.forceSpoilerMode}
						onCheckedChange={(value) => updateAchievementPreference('SpoilerMode', value)}
					/>
				</div>
				<div class="flex items-center justify-between gap-6 rounded-3xl border p-4">
					<div>
						<Label for="achievement-toasts">Unlock notifications</Label>
						<p class="text-sm text-muted-foreground">
							Show an in-app notification when a badge unlocks.
						</p>
					</div>
					<Switch
						id="achievement-toasts"
						checked={achievementPreferences.toastEnabled}
						disabled={achievementSaving}
						onCheckedChange={(value) => updateAchievementPreference('ToastEnabled', value)}
					/>
				</div>
				<div class="flex items-center justify-between gap-6 rounded-3xl border p-4">
					<div>
						<Label for="achievement-showcase">Show pinned badges</Label>
						<p class="text-sm text-muted-foreground">
							Allow your equipped achievements to appear on your profile.
						</p>
					</div>
					<Switch
						id="achievement-showcase"
						checked={!achievementConfig?.forceHideEquippedShowcase &&
							!achievementPreferences.hideEquippedShowcase}
						disabled={achievementSaving || achievementConfig?.forceHideEquippedShowcase}
						onCheckedChange={(value) => updateAchievementPreference('HideEquippedShowcase', !value)}
					/>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
