import { describe, expect, it } from 'vitest';
import { mapDefaultHomeSections, selectFallbackHeroSection } from './home.js';

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

	it('uses the entire first editorial row while skipping continue and next-up rows', () => {
		const sections = [
			{
				id: 'resume',
				title: 'Continue Watching / Next Up',
				variant: 'landscape' as const,
				order: 0,
				items: [{ Id: 'resume' }]
			},
			{
				id: 'latest-movies',
				title: 'Recently Added Movies',
				variant: 'portrait' as const,
				order: 1,
				items: [{ Id: 'one' }, { Id: 'two' }]
			}
		];
		const selected = selectFallbackHeroSection(sections);
		expect(selected?.id).toBe('latest-movies');
		expect(selected?.items.map((item) => item.Id)).toEqual(['one', 'two']);
	});
});
