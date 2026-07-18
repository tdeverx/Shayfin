import { describe, expect, it } from 'vitest';
import { nextEpisodeId } from './items.js';

describe('nextEpisodeId', () => {
	it('continues into the next season when Jellyfin returns aired episode order', () => {
		const episodes = [
			{ Id: 'season-1-finale', ParentIndexNumber: 1, IndexNumber: 10 },
			{ Id: 'season-2-premiere', ParentIndexNumber: 2, IndexNumber: 1 }
		];

		expect(nextEpisodeId(episodes, 'season-1-finale')).toBe('season-2-premiere');
		expect(nextEpisodeId(episodes, 'season-2-premiere')).toBeNull();
	});
});
