interface CacheEntry<T> {
	value: T;
	storedAt: number;
}

export interface CachedValue<T> {
	value: T;
	stale: boolean;
}

const entries = new Map<string, CacheEntry<unknown>>();

export function userCacheKey(
	serverId: string | undefined,
	userId: string,
	surface: string
): string {
	return `${serverId ?? 'server'}:${userId}:${surface}`;
}

export function readCache<T>(key: string, maxAgeMs: number): CachedValue<T> | null {
	const entry = entries.get(key) as CacheEntry<T> | undefined;
	if (!entry) return null;
	return { value: entry.value, stale: Date.now() - entry.storedAt > maxAgeMs };
}

export function writeCache<T>(key: string, value: T): void {
	entries.set(key, { value, storedAt: Date.now() });
}

export function deleteCache(key: string): void {
	entries.delete(key);
}

export function clearDataCache(): void {
	entries.clear();
}
