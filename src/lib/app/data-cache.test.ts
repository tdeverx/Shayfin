import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	clearDataCache,
	deleteCache,
	itemEntityKey,
	markEntitiesStale,
	patchEntity,
	readCache,
	readEntity,
	readQuery,
	upsertEntity,
	userCacheKey,
	writeCache,
	writeQuery
} from './data-cache';

afterEach(() => {
	clearDataCache();
	vi.useRealTimers();
});

describe('data cache', () => {
	it('scopes values by server, user, and surface', () => {
		const key = userCacheKey('server-1', 'user-1', 'library:movies');
		writeCache(key, ['movie-1']);

		expect(readCache<string[]>(key, 1_000)).toEqual({ value: ['movie-1'], stale: false });
		expect(readCache(userCacheKey('server-1', 'user-2', 'library:movies'), 1_000)).toBeNull();
	});

	it('keeps stale data available for background refresh', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-18T08:00:00Z'));
		writeCache('profile', { name: 'Nora' });
		vi.advanceTimersByTime(2_001);

		expect(readCache('profile', 2_000)).toEqual({ value: { name: 'Nora' }, stale: true });
		deleteCache('profile');
		expect(readCache('profile', 2_000)).toBeNull();
	});

	it('patches entities optimistically and can roll them back', () => {
		const key = itemEntityKey('server-1', 'user-1', 'movie-1');
		upsertEntity(key, { title: 'Movie', favorite: false });
		const rollback = patchEntity(key, { favorite: true });
		expect(readEntity<{ favorite: boolean }>(key)?.value.favorite).toBe(true);
		rollback?.();
		expect(readEntity<{ favorite: boolean }>(key)?.value.favorite).toBe(false);
		markEntitiesStale([key]);
		expect(readEntity(key)?.stale).toBe(true);
	});

	it('stores bounded paged query state separately from entities', () => {
		writeQuery('library', { itemIds: ['one'], startIndex: 1, hasMore: true, totalRecordCount: 2 });
		expect(readQuery('library', 1_000)?.value).toMatchObject({ itemIds: ['one'], hasMore: true });
	});
});
