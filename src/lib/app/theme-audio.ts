class ThemeAudioManager {
	private current: HTMLAudioElement | null = null;

	async play(url: string, volume = 0.35): Promise<void> {
		this.stopImmediately();
		const audio = new Audio(url);
		audio.volume = volume;
		this.current = audio;
		try {
			await audio.play();
		} catch (error) {
			if (this.current === audio) this.current = null;
			throw error;
		}
	}

	fadeAndStop(durationMs = 500): void {
		const audio = this.current;
		if (!audio) return;
		this.current = null;
		const initialVolume = audio.volume;
		const startedAt = performance.now();

		const step = (now: number) => {
			const progress = Math.min((now - startedAt) / durationMs, 1);
			audio.volume = initialVolume * (1 - progress);
			if (progress < 1 && !audio.paused) {
				requestAnimationFrame(step);
				return;
			}
			audio.pause();
			audio.volume = initialVolume;
		};

		requestAnimationFrame(step);
	}

	stopImmediately(): void {
		this.current?.pause();
		this.current = null;
	}
}

export const themeAudio = new ThemeAudioManager();
