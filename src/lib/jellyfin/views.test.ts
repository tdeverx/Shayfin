import { describe, expect, it } from 'vitest';
import { collapseUserViews } from './views.js';

describe('collapseUserViews', () => {
	it('combines multiple supported libraries into one navigation destination', () => {
		expect(
			collapseUserViews([
				{ Id: 'movies-a', CollectionType: 'movies', Name: 'Movies' },
				{ Id: 'movies-b', CollectionType: 'movies', Name: 'Kids movies' },
				{ Id: 'shows-a', CollectionType: 'tvshows', Name: 'Shows' },
				{ Id: 'music-a', CollectionType: 'music', Name: 'Music' },
				{ Id: 'live-a', CollectionType: 'livetv', Name: 'Live TV' }
			])
		).toEqual([
			{ type: 'movies', label: 'Movies', href: '/movies', libraryIds: ['movies-a', 'movies-b'] },
			{ type: 'series', label: 'Series', href: '/series', libraryIds: ['shows-a'] }
		]);
	});

	it('drops unsupported and malformed views', () => {
		expect(
			collapseUserViews([{ CollectionType: 'movies' }, { Id: 'books', CollectionType: 'books' }])
		).toEqual([]);
	});
});
