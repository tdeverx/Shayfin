import { describe, expect, it } from 'vitest';
import { parseByteRange } from './youtube';

describe('parseByteRange', () => {
	it('supports open and closed browser video ranges', () => {
		expect(parseByteRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
		expect(parseByteRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
		expect(parseByteRange('bytes=900-2000', 1000)).toEqual({ start: 900, end: 999 });
	});

	it('rejects malformed and unsatisfiable ranges', () => {
		expect(parseByteRange('items=0-10', 1000)).toBeNull();
		expect(parseByteRange('bytes=1000-', 1000)).toBeNull();
		expect(parseByteRange(null, 1000)).toBeNull();
	});
});
