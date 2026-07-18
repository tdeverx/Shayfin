import { describe, expect, it } from 'vitest';
import {
	dedupeAgainstLocal,
	normalizeLocalSearch,
	normalizeProviderIds,
	providerIdentityKeys
} from './search.js';

describe('local search normalization', () => {
	it('normalizes supported items and provider id casing', () => {
		const results = normalizeLocalSearch([
			{
				Id: 'episode-1',
				Name: 'Arrival',
				Type: 'Episode',
				SeriesName: 'Signal',
				ParentIndexNumber: 2,
				IndexNumber: 4,
				ProductionYear: 2026,
				ProviderIds: { Tmdb: ' 101 ', TVDB: '202' },
				ImageTags: { Primary: 'image-tag' }
			},
			{ Id: 'audio', Name: 'Song', Type: 'Audio' },
			{ Name: 'Missing id', Type: 'Movie' }
		]);

		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			id: 'episode-1',
			mediaType: 'episode',
			subtitle: 'Signal · S2E4',
			providerIds: { tmdb: '101', tvdb: '202' },
			imageTag: 'image-tag'
		});
		expect(normalizeProviderIds({ IMDB: 'tt123' })).toEqual({
			tmdb: undefined,
			tvdb: undefined,
			imdb: 'tt123'
		});
	});
});

describe('provider deduplication', () => {
	it('removes discover results that match a local provider id and media type', () => {
		const local = [{ mediaType: 'movie' as const, providerIds: { tmdb: '42' } }];
		const discover = [
			{ mediaType: 'movie' as const, providerIds: { tmdb: '42' }, title: 'Local movie' },
			{ mediaType: 'series' as const, providerIds: { tmdb: '42' }, title: 'Different type' },
			{ mediaType: 'movie' as const, providerIds: { tmdb: '84' }, title: 'Remote movie' }
		];

		expect(dedupeAgainstLocal(local, discover).map((item) => item.title)).toEqual([
			'Different type',
			'Remote movie'
		]);
		expect(providerIdentityKeys(local[0])).toEqual(['movie:tmdb:42']);
	});
});
