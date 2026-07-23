<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import MaximizeIcon from '@lucide/svelte/icons/maximize';
	import MinimizeIcon from '@lucide/svelte/icons/minimize';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PictureInPictureIcon from '@lucide/svelte/icons/picture-in-picture';
	import PlayIcon from '@lucide/svelte/icons/play';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import SkipForwardIcon from '@lucide/svelte/icons/skip-forward';
	import Volume2Icon from '@lucide/svelte/icons/volume-2';
	import VolumeXIcon from '@lucide/svelte/icons/volume-x';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import { PLAYBACK_SPEEDS } from './constants.js';
	import { BITRATE_OPTIONS, RESOLUTION_OPTIONS, type PlaybackQuality } from '$lib/app/preferences';
	import ControlButton from './ControlButton.svelte';
	import { formatPlayerTime } from './playback.js';
	import type { NextUpModel, PlayerMediaStream } from './types.js';

	interface Props {
		routeLabel: string;
		title?: string;
		secondary?: string;
		isLoading: boolean;
		isBuffering: boolean;
		playbackError: string | null;
		segmentLabel: string | null;
		controlsVisible: boolean;
		paused: boolean;
		muted: boolean;
		volume: number;
		bufferedTime: number;
		duration: number;
		displayedSeekTime: number;
		nextItemId: string | null;
		nextUp: NextUpModel | null;
		showNextUp: boolean;
		nextCountdown: number | null;
		quality: PlaybackQuality;
		audioStreams: PlayerMediaStream[];
		subtitleStreams: PlayerMediaStream[];
		selectedAudioIndex: number | null;
		selectedSubtitleIndex: number | null;
		playbackRate: number;
		pictureInPictureSupported: boolean;
		isPictureInPicture: boolean;
		isFullscreen: boolean;
		onExit: () => void;
		onRetry: () => void;
		onSkipSegment: () => void;
		onSeekInput: (value: number) => void;
		onSeekCommit: (value: number) => void;
		onTogglePlayback: () => void;
		onToggleMute: () => void;
		onVolume: (value: number) => void;
		onNext?: (itemId: string) => void | Promise<void>;
		onDismissNext: () => void;
		onSelectQuality: (quality: PlaybackQuality) => void;
		onSaveDefaultQuality?: (quality: PlaybackQuality) => void;
		onSelectAudio: (index: number) => void;
		onSelectSubtitle: (index: number | null) => void;
		onPlaybackSpeed: (value: string) => void;
		onTogglePictureInPicture: () => void;
		onToggleFullscreen: () => void;
	}

	let {
		routeLabel,
		title,
		secondary,
		isLoading,
		isBuffering,
		playbackError,
		segmentLabel,
		controlsVisible,
		paused,
		muted,
		volume,
		bufferedTime,
		duration,
		displayedSeekTime,
		nextItemId,
		nextUp,
		showNextUp,
		nextCountdown,
		quality,
		audioStreams,
		subtitleStreams,
		selectedAudioIndex,
		selectedSubtitleIndex,
		playbackRate,
		pictureInPictureSupported,
		isPictureInPicture,
		isFullscreen,
		onExit,
		onRetry,
		onSkipSegment,
		onSeekInput,
		onSeekCommit,
		onTogglePlayback,
		onToggleMute,
		onVolume,
		onNext,
		onDismissNext,
		onSelectQuality,
		onSaveDefaultQuality,
		onSelectAudio,
		onSelectSubtitle,
		onPlaybackSpeed,
		onTogglePictureInPicture,
		onToggleFullscreen
	}: Props = $props();
</script>

<Tooltip.Provider delayDuration={250}>
	<div
		class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6"
	>
		<ControlButton
			label="Exit player"
			icon={ArrowLeftIcon}
			variant="secondary"
			onclick={onExit}
			class="pointer-events-auto"
		/>
		<div class="flex min-w-0 flex-col items-end gap-1 text-right drop-shadow-lg">
			{#if title}<strong class="max-w-[60vw] truncate text-sm text-white">{title}</strong>{/if}
			{#if secondary}<span class="max-w-[60vw] truncate text-xs text-white/70">{secondary}</span
				>{/if}
			<Badge variant="secondary">{routeLabel}</Badge>
		</div>
	</div>

	{#if isLoading || isBuffering}
		<div
			class="pointer-events-none absolute inset-0 flex items-center justify-center"
			aria-live="polite"
		>
			<Badge variant="secondary">
				<Spinner data-icon="inline-start" />
				{isLoading ? 'Preparing playback' : 'Buffering'}
			</Badge>
		</div>
	{/if}

	{#if playbackError}
		<div class="absolute inset-0 flex items-center justify-center p-6" aria-live="assertive">
			<div
				class="flex max-w-md flex-col items-center gap-3 rounded-xl border bg-background/90 p-5 text-center shadow-lg backdrop-blur"
			>
				<Badge variant="destructive">Playback error</Badge>
				<p class="text-sm text-muted-foreground">{playbackError}</p>
				<Button variant="secondary" onclick={onRetry}>Try again</Button>
			</div>
		</div>
	{/if}

	{#if segmentLabel}
		<Button
			variant="secondary"
			class="absolute right-4 bottom-36 rounded-full shadow-xl sm:right-8"
			onclick={onSkipSegment}
		>
			<SkipForwardIcon data-icon="inline-start" />
			{segmentLabel}
		</Button>
	{/if}

	{#if showNextUp && nextUp && nextItemId && onNext}
		<aside
			class="absolute bottom-36 left-4 w-[min(22rem,calc(100%-2rem))] overflow-hidden rounded-4xl border border-white/15 bg-black/70 p-3 text-white shadow-2xl backdrop-blur-xl sm:left-8"
			aria-label="Next up"
		>
			<div class="flex gap-3">
				{#if nextUp.imageUrl}<img
						src={nextUp.imageUrl}
						alt=""
						class="aspect-video w-28 rounded-3xl object-cover"
					/>{/if}
				<div class="min-w-0 flex-1">
					<p class="text-xs font-medium text-white/60">
						Next up{nextCountdown !== null ? ` · ${nextCountdown}s` : ''}
					</p>
					<strong class="mt-1 block truncate text-sm">{nextUp.title}</strong>
					{#if nextUp.secondary}<p class="truncate text-xs text-white/60">
							{nextUp.secondary}
						</p>{/if}
				</div>
			</div>
			<div class="mt-3 flex gap-2">
				<Button size="sm" onclick={() => onNext?.(nextItemId)}>Play now</Button>
				<Button size="sm" variant="secondary" onclick={onDismissNext}>Not yet</Button>
			</div>
		</aside>
	{/if}

	<div
		class={cn(
			'absolute inset-x-3 bottom-3 mx-auto flex max-w-6xl flex-col gap-2 rounded-[2rem] border border-white/10 bg-background/75 p-3 shadow-2xl backdrop-blur-xl transition-all sm:inset-x-6 sm:bottom-6 sm:p-4',
			!controlsVisible && !paused && 'pointer-events-none opacity-0'
		)}
	>
		<Progress
			value={bufferedTime}
			max={duration || 1}
			class="h-1"
			aria-label="Buffered playback progress"
		/>
		<div class="flex items-center gap-2 sm:gap-3">
			<span class="hidden min-w-11 text-right text-xs text-muted-foreground tabular-nums sm:block">
				{formatPlayerTime(displayedSeekTime)}
			</span>
			<Slider
				type="single"
				value={displayedSeekTime}
				min={0}
				max={duration || 1}
				step={0.1}
				disabled={!duration || isLoading}
				onValueChange={onSeekInput}
				onValueCommit={onSeekCommit}
				aria-label="Seek"
			/>
			<span class="hidden min-w-11 text-xs text-muted-foreground tabular-nums sm:block">
				{formatPlayerTime(duration)}
			</span>
		</div>

		<div class="flex items-center justify-between gap-3">
			<div class="flex min-w-0 items-center gap-2">
				<ControlButton
					label={paused ? 'Play' : 'Pause'}
					icon={paused ? PlayIcon : PauseIcon}
					onclick={onTogglePlayback}
					disabled={isLoading}
					class="size-11 rounded-full"
				/>
				<ControlButton
					label={muted ? 'Unmute' : 'Mute'}
					icon={muted || volume === 0 ? VolumeXIcon : Volume2Icon}
					onclick={onToggleMute}
					pressed={muted}
					class="hidden sm:inline-flex"
				/>
				<Slider
					type="single"
					value={muted ? 0 : volume * 100}
					min={0}
					max={100}
					step={1}
					onValueChange={onVolume}
					aria-label="Volume"
					class="hidden w-24 sm:flex"
				/>
			</div>

			<div class="flex items-center gap-2">
				{#if nextItemId && onNext}
					<ControlButton
						label="Play next"
						icon={SkipForwardIcon}
						onclick={() => onNext?.(nextItemId as string)}
					/>
				{/if}

				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="secondary" size="icon" aria-label="Playback settings">
								<Settings2Icon />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="max-h-80 overflow-y-auto">
						{#if audioStreams.length}
							<DropdownMenu.Group>
								<DropdownMenu.Label>Audio</DropdownMenu.Label>
								<DropdownMenu.RadioGroup
									value={selectedAudioIndex?.toString() ?? ''}
									onValueChange={(value) => onSelectAudio(Number(value))}
								>
									{#each audioStreams as stream (stream.Index)}
										<DropdownMenu.RadioItem value={String(stream.Index)}>
											{stream.DisplayTitle ||
												stream.Title ||
												stream.Language ||
												`Track ${stream.Index}`}
										</DropdownMenu.RadioItem>
									{/each}
								</DropdownMenu.RadioGroup>
							</DropdownMenu.Group>
							<DropdownMenu.Separator />
						{/if}

						<DropdownMenu.Group>
							<DropdownMenu.Label>Subtitles</DropdownMenu.Label>
							<DropdownMenu.RadioGroup
								value={selectedSubtitleIndex?.toString() ?? 'off'}
								onValueChange={(value) => onSelectSubtitle(value === 'off' ? null : Number(value))}
							>
								<DropdownMenu.RadioItem value="off">Off</DropdownMenu.RadioItem>
								{#each subtitleStreams as stream (stream.Index)}
									<DropdownMenu.RadioItem value={String(stream.Index)}>
										{stream.DisplayTitle ||
											stream.Title ||
											stream.Language ||
											`Track ${stream.Index}`}
									</DropdownMenu.RadioItem>
								{/each}
							</DropdownMenu.RadioGroup>
						</DropdownMenu.Group>
						<DropdownMenu.Separator />

						<DropdownMenu.Group>
							<DropdownMenu.Label>
								<span class="flex items-center gap-2"><GaugeIcon /> Playback speed</span>
							</DropdownMenu.Label>
							<DropdownMenu.RadioGroup value={String(playbackRate)} onValueChange={onPlaybackSpeed}>
								{#each PLAYBACK_SPEEDS as speed (speed)}
									<DropdownMenu.RadioItem value={String(speed)}>
										{speed === 1 ? 'Normal' : `${speed}×`}
									</DropdownMenu.RadioItem>
								{/each}
							</DropdownMenu.RadioGroup>
						</DropdownMenu.Group>
						<DropdownMenu.Separator />
						<DropdownMenu.Group>
							<DropdownMenu.Label>Maximum resolution</DropdownMenu.Label>
							<DropdownMenu.RadioGroup
								value={String(quality.maxResolution)}
								onValueChange={(value) =>
									onSelectQuality({
										...quality,
										maxResolution:
											value === 'auto'
												? 'auto'
												: (Number(value) as PlaybackQuality['maxResolution'])
									})}
							>
								{#each RESOLUTION_OPTIONS as option (option)}
									<DropdownMenu.RadioItem value={String(option)}
										>{option === 'auto' ? 'Auto' : `${option}p`}</DropdownMenu.RadioItem
									>
								{/each}
							</DropdownMenu.RadioGroup>
						</DropdownMenu.Group>
						<DropdownMenu.Separator />
						<DropdownMenu.Group>
							<DropdownMenu.Label>Maximum bitrate</DropdownMenu.Label>
							<DropdownMenu.RadioGroup
								value={String(quality.maxBitrateMbps)}
								onValueChange={(value) =>
									onSelectQuality({
										...quality,
										maxBitrateMbps:
											value === 'auto'
												? 'auto'
												: (Number(value) as PlaybackQuality['maxBitrateMbps'])
									})}
							>
								{#each BITRATE_OPTIONS as option (option)}
									<DropdownMenu.RadioItem value={String(option)}
										>{option === 'auto' ? 'Auto' : `${option} Mbps`}</DropdownMenu.RadioItem
									>
								{/each}
							</DropdownMenu.RadioGroup>
							{#if onSaveDefaultQuality}
								<DropdownMenu.Item onclick={() => onSaveDefaultQuality?.(quality)}
									>Make current quality default</DropdownMenu.Item
								>
							{/if}
						</DropdownMenu.Group>
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				{#if pictureInPictureSupported}
					<ControlButton
						label={isPictureInPicture ? 'Exit picture-in-picture' : 'Picture-in-picture'}
						icon={PictureInPictureIcon}
						onclick={onTogglePictureInPicture}
						pressed={isPictureInPicture}
					/>
				{/if}
				<ControlButton
					label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
					icon={isFullscreen ? MinimizeIcon : MaximizeIcon}
					onclick={onToggleFullscreen}
					pressed={isFullscreen}
				/>
			</div>
		</div>
	</div>
</Tooltip.Provider>
