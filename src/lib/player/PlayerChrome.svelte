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
	import ControlButton from './ControlButton.svelte';
	import { formatPlayerTime } from './playback.js';
	import type { PlayerMediaStream } from './types.js';

	interface Props {
		routeLabel: string;
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
		onSelectAudio: (index: number) => void;
		onSelectSubtitle: (index: number | null) => void;
		onPlaybackSpeed: (value: string) => void;
		onTogglePictureInPicture: () => void;
		onToggleFullscreen: () => void;
	}

	let {
		routeLabel,
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
		onSelectAudio,
		onSelectSubtitle,
		onPlaybackSpeed,
		onTogglePictureInPicture,
		onToggleFullscreen
	}: Props = $props();
</script>

<Tooltip.Provider delayDuration={250}>
	<div class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
		<ControlButton
			label="Exit player"
			icon={ArrowLeftIcon}
			variant="secondary"
			onclick={onExit}
			class="pointer-events-auto"
		/>
		<Badge variant="secondary">{routeLabel}</Badge>
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
			class="absolute right-4 bottom-28 shadow-lg"
			onclick={onSkipSegment}
		>
			<SkipForwardIcon data-icon="inline-start" />
			{segmentLabel}
		</Button>
	{/if}

	<div
		class={cn(
			'absolute inset-x-0 bottom-0 flex flex-col gap-2 border-t bg-background/90 p-3 backdrop-blur transition-opacity',
			!controlsVisible && !paused && 'pointer-events-none opacity-0'
		)}
	>
		<Progress
			value={bufferedTime}
			max={duration || 1}
			class="h-1"
			aria-label="Buffered playback progress"
		/>
		<div class="flex items-center gap-3">
			<span class="min-w-11 text-right text-xs text-muted-foreground tabular-nums">
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
			<span class="min-w-11 text-xs text-muted-foreground tabular-nums">
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
				/>
				<ControlButton
					label={muted ? 'Unmute' : 'Mute'}
					icon={muted || volume === 0 ? VolumeXIcon : Volume2Icon}
					onclick={onToggleMute}
					pressed={muted}
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
