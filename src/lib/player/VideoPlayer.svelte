<script lang="ts" module>
	import type { VideoPlayerProps as PublicVideoPlayerProps } from './types.js';

	export type Props = PublicVideoPlayerProps;
</script>

<script lang="ts">
	import Hls from 'hls.js';
	import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
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
	import { onMount, tick } from 'svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import { JellyfinPlaybackClient } from './client.js';
	import ControlButton from './ControlButton.svelte';
	import { createBrowserDeviceProfile } from './device-profile.js';
	import {
		buildPlaybackProgressPayload,
		buildPlaybackStopPayload,
		clamp,
		formatPlayerTime,
		getExternalSubtitleTrack,
		MEDIA_SEGMENT_LABELS,
		PLAY_METHOD_LABELS,
		secondsToTicks,
		selectActiveSegment,
		selectMediaSource,
		selectPlaybackRoute,
		shouldUseNativeHls,
		ticksToSeconds
	} from './playback.js';
	import type {
		PlaybackProgressPayload,
		PlaybackRoute,
		PlayerMediaSegment,
		PlayerMediaSource,
		PlayerMediaStream,
		SupportedMediaSegmentType,
		VideoPlayerProps
	} from './types.js';

	const PROGRESS_REPORT_INTERVAL_MS = 10_000;
	const CONTROLS_HIDE_DELAY_MS = 2_500;
	const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

	interface PlaybackSnapshot {
		serverUrl: string;
		accessToken: string;
		userId: string;
		itemId: string;
		deviceId: string;
		startTicks: number;
		onThemeAudioStop?: () => void;
	}

	let {
		serverUrl,
		accessToken,
		userId,
		itemId,
		deviceId,
		startTicks = 0,
		nextItemId = null,
		onNext,
		onExit,
		onThemeAudioStop,
		class: className
	}: VideoPlayerProps = $props();

	let containerElement: HTMLDivElement;
	let videoElement: HTMLVideoElement;
	let hlsInstance: Hls | null = null;
	let playbackClient: JellyfinPlaybackClient | null = null;
	let deviceProfile: DeviceProfile | null = null;
	let activeRoute = $state<PlaybackRoute | null>(null);
	let mediaSource = $state<PlayerMediaSource | null>(null);
	let mediaSegments = $state<PlayerMediaSegment[]>([]);
	let activeItemId = $state<string | null>(null);
	let selectedAudioIndex = $state<number | null>(null);
	let selectedSubtitleIndex = $state<number | null>(null);
	let currentTime = $state(0);
	let duration = $state(0);
	let bufferedTime = $state(0);
	let volume = $state(1);
	let previousVolume = 1;
	let muted = $state(false);
	let paused = $state(true);
	let playbackRate = $state(1);
	let isLoading = $state(true);
	let isBuffering = $state(false);
	let playbackError = $state<string | null>(null);
	let controlsVisible = $state(true);
	let sliderSeeking = $state(false);
	let sliderSeekTime = $state(0);
	let isFullscreen = $state(false);
	let isPictureInPicture = $state(false);
	let pictureInPictureSupported = $state(false);
	let mounted = $state(false);
	let retryNonce = $state(0);
	let playbackStartedReported = false;
	let playbackStoppedReported = false;
	let lastProgressReportAt = 0;
	let suppressPlaybackEvents = false;
	let operationGeneration = 0;
	let activeAbortController: AbortController | null = null;
	let controlsTimer: ReturnType<typeof setTimeout> | undefined;

	let audioStreams = $derived(
		(mediaSource?.MediaStreams ?? []).filter(
			(stream): stream is PlayerMediaStream => stream.Type === 'Audio' && stream.Index !== undefined
		)
	);
	let subtitleStreams = $derived(
		(mediaSource?.MediaStreams ?? []).filter(
			(stream): stream is PlayerMediaStream =>
				stream.Type === 'Subtitle' && stream.Index !== undefined
		)
	);
	let activeSegment = $derived(selectActiveSegment(mediaSegments, secondsToTicks(currentTime)));
	let subtitleTrack = $derived(
		getExternalSubtitleTrack(serverUrl, accessToken, mediaSource, selectedSubtitleIndex)
	);
	let displayedSeekTime = $derived(sliderSeeking ? sliderSeekTime : currentTime);
	let routeLabel = $derived(activeRoute ? PLAY_METHOD_LABELS[activeRoute.playMethod] : 'Preparing');

	function safelyStopThemeAudio(callback = onThemeAudioStop): void {
		try {
			callback?.();
		} catch {
			// Theme audio is a separate enhancement and must never block video playback.
		}
	}

	function getDefaultStreamIndex(
		streams: PlayerMediaStream[],
		serverDefault: number | null | undefined,
		allowNone: boolean
	): number | null {
		if (typeof serverDefault === 'number' && serverDefault >= 0) return serverDefault;
		const preferred = streams.find((stream) => stream.IsDefault)?.Index;
		if (typeof preferred === 'number') return preferred;
		const first = streams[0]?.Index;
		return !allowNone && typeof first === 'number' ? first : null;
	}

	function updateNegotiatedState(
		info: Awaited<ReturnType<JellyfinPlaybackClient['getPlaybackInfo']>>,
		requestedMediaSourceId?: string | null,
		requestedAudioIndex?: number | null,
		requestedSubtitleIndex?: number | null
	): PlaybackRoute {
		if (info.ErrorCode) throw new Error(`Jellyfin could not start playback (${info.ErrorCode}).`);

		const source = selectMediaSource(info.MediaSources, requestedMediaSourceId);
		const nextRoute = selectPlaybackRoute({
			serverUrl,
			accessToken,
			itemId: activeItemId ?? itemId,
			deviceId,
			playSessionId: info.PlaySessionId,
			mediaSource: source
		});

		mediaSource = source;
		activeRoute = nextRoute;
		const sourceAudioStreams = (source.MediaStreams ?? []).filter(
			(stream) => stream.Type === 'Audio' && stream.Index !== undefined
		);
		const sourceSubtitleStreams = (source.MediaStreams ?? []).filter(
			(stream) => stream.Type === 'Subtitle' && stream.Index !== undefined
		);
		selectedAudioIndex =
			requestedAudioIndex ??
			getDefaultStreamIndex(sourceAudioStreams, source.DefaultAudioStreamIndex, false);
		selectedSubtitleIndex =
			requestedSubtitleIndex === undefined
				? getDefaultStreamIndex(sourceSubtitleStreams, source.DefaultSubtitleStreamIndex, true)
				: requestedSubtitleIndex;
		return nextRoute;
	}

	async function initializePlayback(
		snapshot: PlaybackSnapshot,
		signal: AbortSignal,
		generation: number
	): Promise<void> {
		isLoading = true;
		isBuffering = false;
		playbackError = null;
		activeItemId = snapshot.itemId;
		safelyStopThemeAudio(snapshot.onThemeAudioStop);

		try {
			const client = new JellyfinPlaybackClient(
				snapshot.serverUrl,
				snapshot.accessToken,
				snapshot.deviceId
			);
			const profile = createBrowserDeviceProfile(videoElement);
			playbackClient = client;
			deviceProfile = profile;

			const [playbackInfo, segments] = await Promise.all([
				client.getPlaybackInfo(snapshot.itemId, {
					userId: snapshot.userId,
					startTimeTicks: snapshot.startTicks,
					deviceProfile: profile,
					signal
				}),
				client.getMediaSegments(snapshot.itemId, signal)
			]);
			if (signal.aborted || generation !== operationGeneration) return;

			mediaSegments = segments;
			const route = updateNegotiatedState(playbackInfo);
			await tick();
			await attachPlaybackRoute(route, ticksToSeconds(snapshot.startTicks), signal);
			if (signal.aborted || generation !== operationGeneration) return;

			isLoading = false;
			suppressPlaybackEvents = false;
			try {
				await videoElement.play();
			} catch (error) {
				if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') throw error;
			}
		} catch (error) {
			if (signal.aborted || generation !== operationGeneration) return;
			playbackError = error instanceof Error ? error.message : 'Playback could not be started.';
			isLoading = false;
			isBuffering = false;
			suppressPlaybackEvents = false;
		}
	}

	function attachPlaybackRoute(
		route: PlaybackRoute,
		positionSeconds: number,
		signal: AbortSignal
	): Promise<void> {
		suppressPlaybackEvents = true;
		isLoading = true;
		teardownMediaSource();

		return new Promise((resolve, reject) => {
			let settled = false;
			let recoveryAttempts = 0;

			const finish = (error?: Error) => {
				if (settled) return;
				settled = true;
				videoElement.removeEventListener('loadedmetadata', handleMetadata);
				videoElement.removeEventListener('error', handleVideoError);
				signal.removeEventListener('abort', handleAbort);
				if (error) reject(error);
				else resolve();
			};

			const handleMetadata = () => {
				duration = Number.isFinite(videoElement.duration) ? videoElement.duration : 0;
				if (positionSeconds > 0 && videoElement.seekable.length > 0) {
					const seekEnd = videoElement.seekable.end(videoElement.seekable.length - 1);
					videoElement.currentTime = clamp(positionSeconds, 0, seekEnd);
				}
				videoElement.playbackRate = playbackRate;
				finish();
			};
			const handleVideoError = () => {
				finish(new Error('The browser could not load the negotiated media stream.'));
			};
			const handleAbort = () => finish(new DOMException('Playback was cancelled.', 'AbortError'));

			videoElement.addEventListener('loadedmetadata', handleMetadata, { once: true });
			videoElement.addEventListener('error', handleVideoError, { once: true });
			signal.addEventListener('abort', handleAbort, { once: true });

			const nativeHls = route.isHls && shouldUseNativeHls(videoElement);
			if (route.isHls && !nativeHls) {
				if (!Hls.isSupported()) {
					finish(new Error('This browser cannot play Jellyfin HLS streams.'));
					return;
				}

				const instance = new Hls({
					enableWorker: true,
					backBufferLength: 90,
					maxBufferLength: 30
				});
				hlsInstance = instance;
				instance.on(Hls.Events.MEDIA_ATTACHED, () => instance.loadSource(route.url));
				instance.on(Hls.Events.ERROR, (_event, data) => {
					if (!data.fatal) return;
					recoveryAttempts += 1;
					if (data.type === Hls.ErrorTypes.NETWORK_ERROR && recoveryAttempts <= 2) {
						instance.startLoad();
						return;
					}
					if (data.type === Hls.ErrorTypes.MEDIA_ERROR && recoveryAttempts <= 2) {
						instance.recoverMediaError();
						return;
					}
					const error = new Error('The HLS stream stopped after an unrecoverable playback error.');
					if (settled) playbackError = error.message;
					else finish(error);
				});
				instance.attachMedia(videoElement);
				return;
			}

			videoElement.src = route.url;
			videoElement.load();
		});
	}

	function teardownMediaSource(): void {
		hlsInstance?.destroy();
		hlsInstance = null;
		if (!videoElement) return;
		videoElement.pause();
		videoElement.removeAttribute('src');
		videoElement.load();
	}

	function currentProgressPayload(): PlaybackProgressPayload | null {
		if (!activeRoute || !activeItemId) return null;
		const position = Number.isFinite(videoElement?.currentTime)
			? videoElement.currentTime
			: currentTime;
		return buildPlaybackProgressPayload({
			itemId: activeItemId,
			mediaSourceId: mediaSource?.Id ?? null,
			audioStreamIndex: selectedAudioIndex,
			subtitleStreamIndex: selectedSubtitleIndex,
			positionSeconds: position,
			paused: videoElement?.paused ?? paused,
			muted: videoElement?.muted ?? muted,
			volume: videoElement?.volume ?? volume,
			playMethod: activeRoute.playMethod,
			playSessionId: activeRoute.playSessionId,
			liveStreamId: mediaSource?.LiveStreamId ?? null,
			canSeek: videoElement?.seekable.length > 0
		});
	}

	function reportPlaybackStart(): void {
		const client = playbackClient;
		const payload = currentProgressPayload();
		if (!client || !payload || playbackStartedReported) return;
		playbackStartedReported = true;
		playbackStoppedReported = false;
		lastProgressReportAt = Date.now();
		void client.reportPlaybackStart(payload).catch(() => {
			// Playback continues if presence reporting is temporarily unavailable.
		});
	}

	function reportPlaybackProgress(force = false): void {
		const client = playbackClient;
		const payload = currentProgressPayload();
		if (!client || !payload || !playbackStartedReported || playbackStoppedReported) return;
		const now = Date.now();
		if (!force && now - lastProgressReportAt < PROGRESS_REPORT_INTERVAL_MS) return;
		lastProgressReportAt = now;
		void client.reportPlaybackProgress(payload).catch(() => {
			// A later periodic report will reconcile the session position.
		});
	}

	async function reportPlaybackStopped(failed = false, keepalive = false): Promise<void> {
		const client = playbackClient;
		const route = activeRoute;
		const currentItem = activeItemId;
		if (!client || !route || !currentItem || !playbackStartedReported || playbackStoppedReported) {
			return;
		}

		playbackStoppedReported = true;
		const payload = buildPlaybackStopPayload({
			itemId: currentItem,
			mediaSourceId: mediaSource?.Id ?? null,
			positionSeconds: Number.isFinite(videoElement?.currentTime)
				? videoElement.currentTime
				: currentTime,
			playSessionId: route.playSessionId,
			liveStreamId: mediaSource?.LiveStreamId ?? null,
			failed
		});
		try {
			await client.reportPlaybackStopped(payload, keepalive);
		} catch {
			// Navigation and player teardown must not wait on presence reporting.
		}
	}

	async function renegotiateStreams(
		audioStreamIndex: number | null,
		subtitleStreamIndex: number | null
	): Promise<void> {
		const client = playbackClient;
		const profile = deviceProfile;
		const currentItem = activeItemId;
		const controller = activeAbortController;
		if (!client || !profile || !currentItem || !controller || isLoading) return;

		const positionTicks = secondsToTicks(videoElement.currentTime);
		const resumePlaying = !videoElement.paused;
		isLoading = true;
		playbackError = null;
		reportPlaybackProgress(true);

		try {
			await reportPlaybackStopped(false);
			const playbackInfo = await client.getPlaybackInfo(currentItem, {
				userId,
				startTimeTicks: positionTicks,
				deviceProfile: profile,
				audioStreamIndex,
				subtitleStreamIndex,
				mediaSourceId: mediaSource?.Id,
				signal: controller.signal
			});
			if (controller.signal.aborted) return;

			const route = updateNegotiatedState(
				playbackInfo,
				mediaSource?.Id,
				audioStreamIndex,
				subtitleStreamIndex
			);
			playbackStartedReported = false;
			playbackStoppedReported = false;
			await tick();
			await attachPlaybackRoute(route, ticksToSeconds(positionTicks), controller.signal);
			if (controller.signal.aborted) return;
			isLoading = false;
			suppressPlaybackEvents = false;
			if (resumePlaying) await videoElement.play();
		} catch (error) {
			if (controller.signal.aborted) return;
			playbackError =
				error instanceof Error ? error.message : 'The selected stream could not load.';
			isLoading = false;
			suppressPlaybackEvents = false;
		}
	}

	function showControls(): void {
		controlsVisible = true;
		if (controlsTimer) clearTimeout(controlsTimer);
		if (!paused) {
			controlsTimer = setTimeout(() => {
				controlsVisible = false;
			}, CONTROLS_HIDE_DELAY_MS);
		}
	}

	function togglePlayback(): void {
		if (!videoElement || isLoading) return;
		showControls();
		if (videoElement.paused) void videoElement.play();
		else videoElement.pause();
	}

	function handleTimeUpdate(): void {
		currentTime = videoElement.currentTime;
		duration = Number.isFinite(videoElement.duration) ? videoElement.duration : duration;
		if (!sliderSeeking) sliderSeekTime = currentTime;
		reportPlaybackProgress();
	}

	function handleBufferProgress(): void {
		if (!videoElement.buffered.length) {
			bufferedTime = 0;
			return;
		}
		bufferedTime = videoElement.buffered.end(videoElement.buffered.length - 1);
	}

	function handlePlay(): void {
		paused = false;
		isBuffering = false;
		safelyStopThemeAudio();
		if (!suppressPlaybackEvents) reportPlaybackStart();
		showControls();
	}

	function handlePause(): void {
		paused = true;
		isBuffering = false;
		controlsVisible = true;
		if (controlsTimer) clearTimeout(controlsTimer);
		if (!suppressPlaybackEvents) reportPlaybackProgress(true);
	}

	function handleEnded(): void {
		paused = true;
		void reportPlaybackStopped(false, true);
		if (nextItemId && onNext) void onNext(nextItemId);
	}

	function handleVideoError(): void {
		if (suppressPlaybackEvents) return;
		playbackError = 'The browser reported a media playback error.';
		void reportPlaybackStopped(true);
	}

	function handleSeekInput(value: number): void {
		sliderSeeking = true;
		sliderSeekTime = value;
		showControls();
	}

	function handleSeekCommit(value: number): void {
		videoElement.currentTime = clamp(value, 0, duration || 0);
		currentTime = videoElement.currentTime;
		sliderSeeking = false;
		reportPlaybackProgress(true);
	}

	function seekBy(seconds: number): void {
		if (!duration) return;
		videoElement.currentTime = clamp(videoElement.currentTime + seconds, 0, duration);
		currentTime = videoElement.currentTime;
		reportPlaybackProgress(true);
	}

	function handleVolume(value: number): void {
		const normalized = clamp(value / 100, 0, 1);
		videoElement.volume = normalized;
		videoElement.muted = normalized === 0;
		volume = normalized;
		muted = videoElement.muted;
		if (normalized > 0) previousVolume = normalized;
		showControls();
	}

	function toggleMute(): void {
		if (videoElement.muted || videoElement.volume === 0) {
			videoElement.muted = false;
			videoElement.volume = previousVolume || 1;
		} else {
			previousVolume = videoElement.volume;
			videoElement.muted = true;
		}
		muted = videoElement.muted;
		volume = videoElement.volume;
		reportPlaybackProgress(true);
	}

	function setPlaybackSpeed(value: string): void {
		const nextRate = Number(value);
		if (!PLAYBACK_SPEEDS.includes(nextRate as (typeof PLAYBACK_SPEEDS)[number])) return;
		playbackRate = nextRate;
		videoElement.playbackRate = nextRate;
	}

	async function toggleFullscreen(): Promise<void> {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else if (containerElement.requestFullscreen) await containerElement.requestFullscreen();
			else {
				const safariVideo = videoElement as HTMLVideoElement & {
					webkitEnterFullscreen?: () => void;
				};
				safariVideo.webkitEnterFullscreen?.();
			}
		} catch {
			playbackError = 'Fullscreen is not available in this browser.';
		}
	}

	async function togglePictureInPicture(): Promise<void> {
		if (!pictureInPictureSupported) return;
		try {
			if (document.pictureInPictureElement) await document.exitPictureInPicture();
			else await videoElement.requestPictureInPicture();
		} catch {
			playbackError = 'Picture-in-picture is not available for this stream.';
		}
	}

	function skipActiveSegment(): void {
		if (!activeSegment?.EndTicks) return;
		videoElement.currentTime = ticksToSeconds(activeSegment.EndTicks) + 0.05;
		currentTime = videoElement.currentTime;
		reportPlaybackProgress(true);
	}

	function handleExit(): void {
		void reportPlaybackStopped(false, true);
		if (onExit) void onExit();
		else if (history.length > 1) history.back();
	}

	function handleKeyboard(event: KeyboardEvent): void {
		const target = event.target;
		if (
			target instanceof HTMLButtonElement ||
			target instanceof HTMLInputElement ||
			(target instanceof HTMLElement && target.closest('[role="slider"]'))
		) {
			return;
		}

		switch (event.key.toLowerCase()) {
			case ' ':
			case 'k':
				event.preventDefault();
				togglePlayback();
				break;
			case 'arrowleft':
				event.preventDefault();
				seekBy(-10);
				break;
			case 'arrowright':
				event.preventDefault();
				seekBy(10);
				break;
			case 'm':
				toggleMute();
				break;
			case 'f':
				void toggleFullscreen();
				break;
		}
	}

	onMount(() => {
		mounted = true;
		volume = videoElement.volume;
		muted = videoElement.muted;
		pictureInPictureSupported =
			document.pictureInPictureEnabled &&
			typeof videoElement.requestPictureInPicture === 'function';

		const handleFullscreenChange = () => {
			isFullscreen = document.fullscreenElement === containerElement;
		};
		const handleEnterPictureInPicture = () => (isPictureInPicture = true);
		const handleLeavePictureInPicture = () => (isPictureInPicture = false);
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') reportPlaybackProgress(true);
		};
		const handlePageHide = () => void reportPlaybackStopped(false, true);

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pagehide', handlePageHide);
		videoElement.addEventListener('enterpictureinpicture', handleEnterPictureInPicture);
		videoElement.addEventListener('leavepictureinpicture', handleLeavePictureInPicture);

		return () => {
			mounted = false;
			if (controlsTimer) clearTimeout(controlsTimer);
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pagehide', handlePageHide);
			videoElement.removeEventListener('enterpictureinpicture', handleEnterPictureInPicture);
			videoElement.removeEventListener('leavepictureinpicture', handleLeavePictureInPicture);
		};
	});

	$effect(() => {
		const snapshot: PlaybackSnapshot = {
			serverUrl,
			accessToken,
			userId,
			itemId,
			deviceId,
			startTicks: Math.max(0, startTicks ?? 0),
			onThemeAudioStop
		};
		void retryNonce;
		if (!mounted || !videoElement) return;

		const generation = ++operationGeneration;
		const controller = new AbortController();
		activeAbortController = controller;
		playbackStartedReported = false;
		playbackStoppedReported = false;
		void initializePlayback(snapshot, controller.signal, generation);

		return () => {
			controller.abort();
			if (activeAbortController === controller) activeAbortController = null;
			if (generation === operationGeneration) {
				suppressPlaybackEvents = true;
				void reportPlaybackStopped(false, true);
				teardownMediaSource();
			}
		};
	});
</script>

<svelte:window
	onkeydown={handleKeyboard}
	onpointermove={showControls}
	onpointerdown={showControls}
/>

<Tooltip.Provider delayDuration={250}>
	<div
		bind:this={containerElement}
		class={cn(
			'relative isolate flex h-full min-h-64 w-full overflow-hidden rounded-xl bg-muted outline-none',
			!controlsVisible && !paused && 'cursor-none',
			className
		)}
		role="region"
		aria-label="Video player"
	>
		<!-- The video plane and controls intentionally own the only player-specific geometry. -->
		<video
			bind:this={videoElement}
			class="size-full object-contain"
			preload="auto"
			playsinline
			crossorigin="anonymous"
			onclick={togglePlayback}
			ontimeupdate={handleTimeUpdate}
			onprogress={handleBufferProgress}
			ondurationchange={handleTimeUpdate}
			onplay={handlePlay}
			onpause={handlePause}
			onwaiting={() => (isBuffering = true)}
			onplaying={() => (isBuffering = false)}
			onended={handleEnded}
			onerror={handleVideoError}
			onseeked={() => reportPlaybackProgress(true)}
			onvolumechange={() => {
				volume = videoElement.volume;
				muted = videoElement.muted;
			}}
		>
			{#if subtitleTrack}
				<track
					kind="subtitles"
					src={subtitleTrack.src}
					srclang={subtitleTrack.language}
					label={subtitleTrack.label}
					default
				/>
			{/if}
		</video>

		<div class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
			<ControlButton
				label="Exit player"
				icon={ArrowLeftIcon}
				variant="secondary"
				onclick={handleExit}
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
					<Button variant="secondary" onclick={() => (retryNonce += 1)}>Try again</Button>
				</div>
			</div>
		{/if}

		{#if activeSegment?.Type && activeSegment.EndTicks}
			<Button
				variant="secondary"
				class="absolute right-4 bottom-28 shadow-lg"
				onclick={skipActiveSegment}
			>
				<SkipForwardIcon data-icon="inline-start" />
				{MEDIA_SEGMENT_LABELS[activeSegment.Type as SupportedMediaSegmentType]}
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
					onValueChange={handleSeekInput}
					onValueCommit={handleSeekCommit}
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
						onclick={togglePlayback}
						disabled={isLoading}
					/>
					<ControlButton
						label={muted ? 'Unmute' : 'Mute'}
						icon={muted || volume === 0 ? VolumeXIcon : Volume2Icon}
						onclick={toggleMute}
						pressed={muted}
					/>
					<Slider
						type="single"
						value={muted ? 0 : volume * 100}
						min={0}
						max={100}
						step={1}
						onValueChange={handleVolume}
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
										onValueChange={(value) =>
											void renegotiateStreams(Number(value), selectedSubtitleIndex)}
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
									onValueChange={(value) =>
										void renegotiateStreams(
											selectedAudioIndex,
											value === 'off' ? null : Number(value)
										)}
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
								<DropdownMenu.RadioGroup
									value={String(playbackRate)}
									onValueChange={setPlaybackSpeed}
								>
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
							onclick={() => void togglePictureInPicture()}
							pressed={isPictureInPicture}
						/>
					{/if}
					<ControlButton
						label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
						icon={isFullscreen ? MinimizeIcon : MaximizeIcon}
						onclick={() => void toggleFullscreen()}
						pressed={isFullscreen}
					/>
				</div>
			</div>
		</div>
	</div>
</Tooltip.Provider>
