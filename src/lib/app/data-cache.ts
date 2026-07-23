interface CacheEntry<T> {
	value: T;
	storedAt: number;
}

export interface EntityRecord<T> extends CacheEntry<T> {
	stale: boolean;
}

export interface PagedQueryState {
	itemIds: string[];
	startIndex: number;
	totalRecordCount?: number;
	hasMore: boolean;
}

export interface CachedValue<T> {
	value: T;
	stale: boolean;
}

const entries = new Map<string, CacheEntry<unknown>>();
const entities = new Map<string, EntityRecord<unknown>>();
const queries = new Map<string, CacheEntry<PagedQueryState>>();

export function itemEntityKey(
	serverId: string | undefined,
	userId: string,
	itemId: string
): string {
	return `${serverId ?? 'server'}:${userId}:item:${itemId}`;
}

export function readEntity<T>(key: string): EntityRecord<T> | null {
	return (entities.get(key) as EntityRecord<T> | undefined) ?? null;
}

export function upsertEntity<T>(key: string, value: T): void {
	entities.set(key, { value, storedAt: Date.now(), stale: false });
}

export function patchEntity<T>(key: string, patch: Partial<T>): (() => void) | null {
	const existing = entities.get(key) as EntityRecord<T> | undefined;
	if (!existing || typeof existing.value !== 'object' || existing.value === null) return null;
	const previous = existing.value;
	entities.set(key, {
		value: { ...previous, ...patch },
		storedAt: Date.now(),
		stale: false
	});
	return () => entities.set(key, { ...existing, value: previous });
}

export function markEntitiesStale(keys: Iterable<string>): void {
	for (const key of keys) {
		const entry = entities.get(key);
		if (entry) entities.set(key, { ...entry, stale: true });
	}
}

export function writeQuery(key: string, value: PagedQueryState): void {
	queries.set(key, { value, storedAt: Date.now() });
}

export function readQuery(key: string, maxAgeMs: number): CachedValue<PagedQueryState> | null {
	const entry = queries.get(key);
	if (!entry) return null;
	return { value: entry.value, stale: Date.now() - entry.storedAt > maxAgeMs };
}

export function markQueriesStale(predicate: (key: string) => boolean = () => true): void {
	for (const [key, entry] of queries) {
		if (predicate(key)) queries.set(key, { ...entry, storedAt: 0 });
	}
}

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
	entities.clear();
	queries.clear();
}
