import { describe, expect, it } from 'vitest';
import { shouldRevealNextUp, shouldStartNextUpCountdown } from './next-up';

describe('Next Up timing', () => {
	it('reveals at an outro marker or inside the 90 second fallback', () => {
		expect(
			shouldRevealNextUp({
				hasNext: true,
				dismissed: false,
				duration: 1_800,
				currentTime: 200,
				segmentType: 'Outro'
			})
		).toBe(true);
		expect(
			shouldRevealNextUp({ hasNext: true, dismissed: false, duration: 1_800, currentTime: 1_711 })
		).toBe(true);
		expect(
			shouldRevealNextUp({ hasNext: true, dismissed: false, duration: 1_800, currentTime: 1_000 })
		).toBe(false);
	});

	it('starts once inside 15 seconds only when autoplay is enabled', () => {
		const input = {
			hasNext: true,
			dismissed: false,
			duration: 1_800,
			currentTime: 1_786,
			autoplay: true,
			countdownStarted: false
		};
		expect(shouldStartNextUpCountdown(input)).toBe(true);
		expect(shouldStartNextUpCountdown({ ...input, autoplay: false })).toBe(false);
		expect(shouldStartNextUpCountdown({ ...input, dismissed: true })).toBe(false);
	});
});
