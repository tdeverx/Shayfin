export interface NextUpTimingInput {
	hasNext: boolean;
	dismissed: boolean;
	duration: number;
	currentTime: number;
	segmentType?: string | null;
}

export function shouldRevealNextUp(input: NextUpTimingInput): boolean {
	if (!input.hasNext || input.dismissed) return false;
	if (input.segmentType === 'Outro') return true;
	return input.duration > 0 && Math.max(0, input.duration - input.currentTime) <= 90;
}

export function shouldStartNextUpCountdown(
	input: NextUpTimingInput & { autoplay: boolean; countdownStarted: boolean }
): boolean {
	return (
		input.autoplay &&
		!input.countdownStarted &&
		shouldRevealNextUp(input) &&
		input.duration > 0 &&
		Math.max(0, input.duration - input.currentTime) <= 15
	);
}
