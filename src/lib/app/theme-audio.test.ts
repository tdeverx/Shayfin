import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { themeAudio } from './theme-audio.js';

class FakeAudio {
	static instances: FakeAudio[] = [];

	readonly src: string;
	volume = 1;
	paused = true;
	play = vi.fn(async () => {
		this.paused = false;
	});
	pause = vi.fn(() => {
		this.paused = true;
	});

	constructor(src: string) {
		this.src = src;
		FakeAudio.instances.push(this);
	}
}

describe('theme audio manager', () => {
	let animationFrames: FrameRequestCallback[];

	beforeEach(() => {
		FakeAudio.instances = [];
		animationFrames = [];
		vi.stubGlobal('Audio', FakeAudio);
		vi.stubGlobal(
			'requestAnimationFrame',
			vi.fn((callback: FrameRequestCallback) => {
				animationFrames.push(callback);
				return animationFrames.length;
			})
		);
		vi.spyOn(performance, 'now').mockReturnValue(100);
	});

	afterEach(() => {
		themeAudio.stopImmediately();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('replaces an active preview instead of overlapping theme tracks', async () => {
		await themeAudio.play('/first.mp3', 0.4);
		await themeAudio.play('/second.mp3', 0.25);

		expect(FakeAudio.instances).toHaveLength(2);
		expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
		expect(FakeAudio.instances[1].play).toHaveBeenCalledOnce();
		expect(FakeAudio.instances[1].volume).toBe(0.25);
	});

	it('fades a preview to silence before stopping it', async () => {
		await themeAudio.play('/theme.mp3', 0.4);
		const audio = FakeAudio.instances[0];

		themeAudio.fadeAndStop(500);
		expect(animationFrames).toHaveLength(1);

		animationFrames.shift()?.(350);
		expect(audio.volume).toBeCloseTo(0.2);
		expect(audio.paused).toBe(false);

		animationFrames.shift()?.(600);
		expect(audio.pause).toHaveBeenCalledOnce();
		expect(audio.volume).toBe(0.4);
	});
});
