import { describe, expect, it } from 'vitest';
import {
	dedupeSearchResults,
	normalizeAvailability,
	normalizeRequestStatus,
	normalizeSeerrRequests,
	normalizeSeerrSearchResponse
} from './seerr';
import {
	filterDownloadsForRequests,
	normalizeDownloadState,
	normalizeServarrQueue
} from './servarr';

describe('Seerr normalization', () => {
	it('normalizes availability and request statuses', () => {
		expect([1, 2, 3, 4, 5].map(normalizeAvailability)).toEqual([
			'unknown',
			'pending',
			'processing',
			'partial',
			'available'
		]);
		expect([1, 2, 3, 4, 5].map(normalizeRequestStatus)).toEqual([
			'pending',
			'approved',
			'declined',
			'failed',
			'completed'
		]);
	});

	it('skips unsupported media and deduplicates by media type and TMDB ID', () => {
		const results = normalizeSeerrSearchResponse({
			results: [
				{
					id: 100,
					mediaType: 'movie',
					title: 'First',
					mediaInfo: { tmdbId: 100, status: 5, requests: [{ status: 2 }] }
				},
				{ id: 100, mediaType: 'movie', title: 'Duplicate' },
				{ id: 100, mediaType: 'tv', name: 'Same provider, different type' },
				{ id: 9, mediaType: 'person', name: 'Unsupported' }
			]
		});

		expect(results).toHaveLength(2);
		expect(results[0]).toMatchObject({
			title: 'First',
			availability: 'available',
			requestStatus: 'approved',
			requested: true
		});
		expect(dedupeSearchResults([...results, results[0]])).toHaveLength(2);
	});

	it('normalizes request ownership provider IDs and statuses', () => {
		const requests = normalizeSeerrRequests({
			results: [
				{
					id: 7,
					type: 'tv',
					status: 1,
					is4k: false,
					media: { tmdbId: 22, tvdbId: 44 },
					seasons: [{ seasonNumber: 1 }, { season: 2 }]
				}
			]
		});

		expect(requests).toEqual([
			{
				id: 7,
				mediaType: 'tv',
				providerIds: { tmdbId: 22, tvdbId: 44 },
				status: 'pending',
				is4k: false,
				seasons: [1, 2],
				createdAt: undefined,
				updatedAt: undefined
			}
		]);
	});
});

describe('Servarr queue normalization', () => {
	it('maps progress, provider IDs, warnings, and importing states', () => {
		const downloads = [
			...normalizeServarrQueue(
				'radarr',
				[
					{
						id: 1,
						movieId: 8,
						title: 'Movie download',
						size: 1000,
						sizeleft: 250,
						status: 'downloading'
					}
				],
				[{ id: 8, title: 'Movie', tmdbId: 80 }]
			),
			...normalizeServarrQueue(
				'sonarr',
				[
					{
						id: 2,
						seriesId: 9,
						size: 500,
						sizeLeft: 0,
						trackedDownloadState: 'importPending'
					}
				],
				[{ id: 9, title: 'Series', tvdbId: 90 }]
			)
		];

		expect(downloads[0]).toMatchObject({
			progress: 75,
			state: 'downloading',
			providerIds: { tmdbId: 80 }
		});
		expect(downloads[1]).toMatchObject({
			progress: 100,
			state: 'importing',
			providerIds: { tvdbId: 90 }
		});
		expect(normalizeDownloadState({ id: 3, statusMessages: [{ title: 'Stalled' }] })).toBe(
			'warning'
		);
		expect(normalizeDownloadState({ id: 4, trackedDownloadStatus: 'error' })).toBe('failed');
		expect(normalizeDownloadState({ id: 5, trackedDownloadState: 'downloadFailed' })).toBe(
			'failed'
		);
	});

	it('filters a normal user queue to provider IDs from their Seerr requests', () => {
		const downloads = normalizeServarrQueue(
			'radarr',
			[
				{ id: 1, movieId: 1, status: 'downloading' },
				{ id: 2, movieId: 2, status: 'downloading' }
			],
			[
				{ id: 1, title: 'Mine', tmdbId: 101 },
				{ id: 2, title: 'Not mine', tmdbId: 202 }
			]
		);
		const visible = filterDownloadsForRequests(downloads, [
			{
				id: 99,
				mediaType: 'movie',
				providerIds: { tmdbId: 101 },
				status: 'approved',
				is4k: false,
				seasons: []
			}
		]);

		expect(visible.map((item) => item.title)).toEqual(['Mine']);
	});
});
