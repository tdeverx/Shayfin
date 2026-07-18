import { randomBytes, timingSafeEqual } from 'node:crypto';

let setupToken: string | undefined;

export function getSetupToken(): string {
	if (setupToken) return setupToken;
	setupToken = process.env.SHAYFIN_SETUP_TOKEN?.trim() || randomBytes(18).toString('base64url');
	console.info(`[shayfin] One-time setup code: ${setupToken}`);
	return setupToken;
}

export function verifySetupToken(candidate: string): boolean {
	const expected = Buffer.from(getSetupToken());
	const provided = Buffer.from(candidate);
	return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function resetSetupTokenForTests(): void {
	setupToken = undefined;
}
