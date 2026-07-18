import { describe, expect, it } from 'vitest';
import { mapDefaultHomeSections } from './home.js';

describe('default home mapping', () => {
	it('keeps the expected order and drops empty fallback sections', () => {
		const sections = mapDefaultHomeSections({
			spotlight: [{ Id: 'featured' }],
			resume: [],
			nextUp: [{ Id: 'episode' }],
			latest: [{ Id: 'new' }],
			favorites: []
		});
		expect(sections.map(({ id, variant, order }) => ({ id, variant, order }))).toEqual([
			{ id: 'spotlight', variant: 'spotlight', order: 0 },
			{ id: 'next-up', variant: 'landscape', order: 20 },
			{ id: 'latest', variant: 'portrait', order: 30 }
		]);
	});
});
