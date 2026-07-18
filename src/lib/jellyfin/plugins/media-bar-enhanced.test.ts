import { describe, expect, it } from 'vitest';
import {
	activeMediaBarSelection,
	parseMediaBarSelection,
	type MediaBarEnhancedConfig
} from './media-bar-enhanced.js';

const config: MediaBarEnhancedConfig = {
	isEnabled: true,
	enableCustomMediaIds: true,
	customMediaIds: 'default-id',
	enableSeasonalContent: true,
	seasonalSections: JSON.stringify([
		{ StartDay: 1, StartMonth: 12, EndDay: 5, EndMonth: 1, MediaIds: 'winter-id' }
	]),
	includeWatchedContent: false,
	sortBy: 'Original',
	sortOrder: 'Ascending',
	maxItems: 20,
	maxMovies: 20,
	maxTvShows: 20,
	applyLimitsToCustomIds: false,
	preferLocalTrailers: true,
	onlyLocalTrailers: false,
	shuffleInterval: 7000
};

describe('Media Bar Enhanced selection', () => {
	it('parses IDs, genre/tag filters, and trailer overrides', () => {
		const parsed = parseMediaBarSelection(
			'genre:Action\ntag:Featured\n0123456789abcdef0123456789abcdef [https://youtu.be/trailer]'
		);
		expect(parsed).toEqual({
			ids: ['0123456789abcdef0123456789abcdef'],
			genres: ['Action'],
			tags: ['Featured'],
			trailerOverrides: {
				'0123456789abcdef0123456789abcdef': 'https://youtu.be/trailer'
			}
		});
	});

	it('honors seasonal ranges that cross the year boundary', () => {
		expect(activeMediaBarSelection(config, new Date(2026, 11, 20))).toBe('winter-id');
		expect(activeMediaBarSelection(config, new Date(2026, 6, 20))).toBe('default-id');
	});
});
