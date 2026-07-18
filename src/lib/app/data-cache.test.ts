import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDataCache, deleteCache, readCache, userCacheKey, writeCache } from './data-cache';

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
});
