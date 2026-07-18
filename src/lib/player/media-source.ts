import Hls from 'hls.js';
import { clamp, shouldUseNativeHls } from './playback.js';
import type { PlaybackRoute } from './types.js';

export class MediaSourceController {
	private hls: Hls | null = null;

	constructor(
		private readonly video: HTMLVideoElement,
		private readonly onDuration: (duration: number) => void,
		private readonly onFatalError: (message: string) => void
	) {}

	attach(
		route: PlaybackRoute,
		positionSeconds: number,
		playbackRate: number,
		signal: AbortSignal
	): Promise<void> {
		this.teardown();

		return new Promise((resolve, reject) => {
			let settled = false;
			let recoveryAttempts = 0;

			const finish = (error?: Error) => {
				if (settled) return;
				settled = true;
				this.video.removeEventListener('loadedmetadata', handleMetadata);
				this.video.removeEventListener('error', handleVideoError);
				signal.removeEventListener('abort', handleAbort);
				if (error) reject(error);
				else resolve();
			};

			const handleMetadata = () => {
				const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
				this.onDuration(duration);
				if (positionSeconds > 0 && this.video.seekable.length > 0) {
					const seekEnd = this.video.seekable.end(this.video.seekable.length - 1);
					this.video.currentTime = clamp(positionSeconds, 0, seekEnd);
				}
				this.video.playbackRate = playbackRate;
				finish();
			};
			const handleVideoError = () =>
				finish(new Error('The browser could not load the negotiated media stream.'));
			const handleAbort = () => finish(new DOMException('Playback was cancelled.', 'AbortError'));

			this.video.addEventListener('loadedmetadata', handleMetadata, { once: true });
			this.video.addEventListener('error', handleVideoError, { once: true });
			signal.addEventListener('abort', handleAbort, { once: true });

			const nativeHls = route.isHls && shouldUseNativeHls(this.video);
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
				this.hls = instance;
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
					const message = 'The HLS stream stopped after an unrecoverable playback error.';
					if (settled) this.onFatalError(message);
					else finish(new Error(message));
				});
				instance.attachMedia(this.video);
				return;
			}

			this.video.src = route.url;
			this.video.load();
		});
	}

	teardown(): void {
		this.hls?.destroy();
		this.hls = null;
		this.video.pause();
		this.video.removeAttribute('src');
		this.video.load();
	}
}
