import { describe, expect, it } from 'vitest';
import { joinServiceUrl, normalizeServiceUrl } from './url';

describe('service URL normalization', () => {
	it('trims input and removes query, fragment, and trailing slashes', () => {
		expect(normalizeServiceUrl('  https://media.example.test/jellyfin///?ignored=1#nope ')).toBe(
			'https://media.example.test/jellyfin'
		);
	});

	it('preserves a base path when joining an API route', () => {
		expect(joinServiceUrl('https://example.test/seerr/', '/api/v1/status')).toBe(
			'https://example.test/seerr/api/v1/status'
		);
	});

	it('rejects non-http protocols', () => {
		expect(() => normalizeServiceUrl('file:///etc/passwd')).toThrow('URL must use http or https');
	});

	it('rejects URLs containing embedded credentials', () => {
		expect(() => normalizeServiceUrl('https://api-key@example.test')).toThrow(
			'cannot contain credentials'
		);
	});
});
