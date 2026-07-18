<script lang="ts">
	import { onMount } from 'svelte';
	import CaptionsIcon from '@lucide/svelte/icons/captions';
	import CirclePlayIcon from '@lucide/svelte/icons/circle-play';
	import MonitorPlayIcon from '@lucide/svelte/icons/monitor-play';
	import PictureInPictureIcon from '@lucide/svelte/icons/picture-in-picture';
	import RadioIcon from '@lucide/svelte/icons/radio';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import AdminHeading from '../admin-heading.svelte';
	import StatusBadge from '../status-badge.svelte';

	interface Capability {
		label: string;
		description: string;
		available: boolean;
	}

	let capabilities = $state<Capability[] | null>(null);
	let codecs = $state<{ label: string; support: string }[] | null>(null);

	onMount(() => {
		const video = document.createElement('video');
		const mediaSource = 'MediaSource' in window;
		capabilities = [
			{
				label: 'Native HLS',
				description: 'Preferred on Safari when Jellyfin returns an HLS stream.',
				available: video.canPlayType('application/vnd.apple.mpegurl') !== ''
			},
			{
				label: 'Media Source Extensions',
				description: 'Allows hls.js playback in Chromium and Firefox.',
				available: mediaSource
			},
			{
				label: 'Picture in Picture',
				description: 'Lets the custom player detach into a floating browser window.',
				available: document.pictureInPictureEnabled === true
			},
			{
				label: 'Fullscreen API',
				description: 'Allows the player surface to enter browser fullscreen.',
				available: document.fullscreenEnabled === true
			}
		];

		codecs = [
			{
				label: 'H.264 + AAC (MP4)',
				support: video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
			},
			{ label: 'HEVC (MP4)', support: video.canPlayType('video/mp4; codecs="hvc1"') },
			{ label: 'AV1 (MP4)', support: video.canPlayType('video/mp4; codecs="av01.0.05M.08"') },
			{ label: 'VP9 (WebM)', support: video.canPlayType('video/webm; codecs="vp9"') },
			{ label: 'Opus (WebM)', support: video.canPlayType('audio/webm; codecs="opus"') }
		];
	});
</script>

<AdminHeading
	title="Playback"
	description="A browser capability snapshot for this device. Jellyfin still makes the final direct-play or transcoding decision per item."
/>

<Alert>
	<MonitorPlayIcon />
	<AlertTitle>Playback policy remains in Jellyfin</AlertTitle>
	<AlertDescription
		>Shayfin reports browser capabilities during negotiation and owns the player controls, but it
		does not duplicate Jellyfin transcoding or user playback policy settings.</AlertDescription
	>
</Alert>

<section class="grid gap-4 lg:grid-cols-3">
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<CirclePlayIcon class="text-muted-foreground" /><Card.Title>Direct play</Card.Title>
			</div>
			<Card.Description
				>The browser consumes the stored video and audio without server conversion.</Card.Description
			>
		</Card.Header>
		<Card.Content><Badge variant="secondary">Lowest server load</Badge></Card.Content>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<RadioIcon class="text-muted-foreground" /><Card.Title>Direct stream</Card.Title>
			</div>
			<Card.Description
				>Jellyfin remuxes compatible streams when only the container needs to change.</Card.Description
			>
		</Card.Header>
		<Card.Content><Badge variant="outline">Container change</Badge></Card.Content>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<CaptionsIcon class="text-muted-foreground" /><Card.Title>HLS transcode</Card.Title>
			</div>
			<Card.Description
				>Jellyfin transcodes unsupported codecs or burns subtitle formats the browser cannot render.</Card.Description
			>
		</Card.Header>
		<Card.Content><Badge variant="outline">Capability fallback</Badge></Card.Content>
	</Card.Root>
</section>

<div class="grid items-start gap-6 xl:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<Card.Title>This browser</Card.Title>
			<Card.Description
				>Detected with standard browser media APIs on the current device.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			{#if capabilities}
				{#each capabilities as capability, index (capability.label)}
					{#if index > 0}<Separator />{/if}
					<div class="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
						<div>
							<p class="font-medium">{capability.label}</p>
							<p class="mt-1 text-xs text-muted-foreground">{capability.description}</p>
						</div>
						<StatusBadge
							status={capability.available ? 'available' : 'unavailable'}
							label={capability.available ? 'Supported' : 'Unavailable'}
						/>
					</div>
				{/each}
			{:else}
				<div class="flex flex-col gap-4">
					{#each [0, 1, 2, 3] as index (index)}<Skeleton class="h-14 w-full" />{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<PictureInPictureIcon class="text-muted-foreground" /><Card.Title>Codec hints</Card.Title>
			</div>
			<Card.Description
				>These are browser declarations, not a guarantee for every profile, level, bit depth, or
				device decoder.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			{#if codecs}
				{#each codecs as codec, index (codec.label)}
					{#if index > 0}<Separator />{/if}
					<div class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
						<span class="font-medium">{codec.label}</span>
						<Badge variant={codec.support === 'probably' ? 'secondary' : 'outline'}
							>{codec.support || 'No declaration'}</Badge
						>
					</div>
				{/each}
			{:else}<Skeleton class="h-64 w-full" />{/if}
		</Card.Content>
	</Card.Root>
</div>
