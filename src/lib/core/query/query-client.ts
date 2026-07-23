import { QueryClient } from '@tanstack/svelte-query';

function retryable(error: unknown): boolean {
	if (error instanceof DOMException && error.name === 'AbortError') return false;
	if (error instanceof Response)
		return error.status === 408 || error.status === 429 || error.status >= 500;
	return true;
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60_000,
			gcTime: 30 * 60_000,
			retry: (attempt, error) => attempt < 1 && retryable(error),
			refetchOnWindowFocus: false
		},
		mutations: { retry: false }
	}
});

export const queryKeys = {
	root: (serverId: string | undefined, userId: string | undefined) =>
		['shayfin', serverId ?? 'server', userId ?? 'anonymous'] as const,
	home: (serverId: string | undefined, userId: string | undefined) =>
		[...queryKeys.root(serverId, userId), 'home'] as const,
	profile: (serverId: string | undefined, userId: string | undefined) =>
		[...queryKeys.root(serverId, userId), 'profile'] as const,
	item: (serverId: string | undefined, userId: string | undefined, itemId: string) =>
		[...queryKeys.root(serverId, userId), 'item', itemId] as const
};
