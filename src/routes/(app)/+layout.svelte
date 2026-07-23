<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { AchievementBadgesAdapter, searchLocalMedia, dedupeAgainstLocal } from '$lib/jellyfin';
	import { pluginEnabled } from '$lib/app/plugin-capabilities';
	import AppShell from '$lib/components/app/app-shell.svelte';
	import RequestDialog from '$lib/components/app/request-dialog.svelte';
	import SearchCommand from '$lib/components/app/search-command.svelte';
	import { session } from '$lib/app/session.svelte';
	import { themeAudio } from '$lib/app/theme-audio';
	import { imageForItem } from '$lib/app/media';
	import { itemEntityKey, markEntitiesStale, markQueriesStale } from '$lib/app/data-cache';
	import type { UnifiedSearchItem } from '$lib/app/models';
	import { subscribeToInvalidations, type ProviderIdentifiable } from '$lib/jellyfin';
	import type { UnifiedSearchResult } from '$lib/server/contracts';

	let { children }: { children: Snippet } = $props();
	let ready = $state(false);
	let searchOpen = $state(false);
	let query = $state('');
	let localResults = $state<UnifiedSearchItem[]>([]);
	let externalResults = $state<UnifiedSearchItem[]>([]);
	let searchLoading = $state(false);
	let selectedRequest = $state<UnifiedSearchItem | null>(null);
	let requestOpen = $state(false);
	let knownAchievementIds: Set<string> | null = null;
	const resolvePath = resolve as (path: string) => ResolvedPathname;

	onMount(async () => {
		await session.initialize();
		if (!session.bootstrap?.configured) {
			await goto(resolve('/setup'));
			return;
		}
		if (!session.user || !session.api) {
			await goto(resolve('/login'));
			return;
		}
		ready = true;
	});

	$effect(() => {
		if (ready && session.user && !session.themeAudioEnabled) themeAudio.fadeAndStop();
	});

	$effect(() => {
		const api = session.api;
		const userId = session.user?.id;
		const serverId = session.bootstrap?.jellyfin?.server.id;
		if (!ready || !api || !userId) return;
		const subscription = subscribeToInvalidations(api, (event) => {
			if (event.itemIds.length) {
				markEntitiesStale(event.itemIds.map((id) => itemEntityKey(serverId, userId, id)));
			}
			if (
				event.type === 'LibraryChanged' ||
				event.type === 'UserDataChanged' ||
				event.type === 'UserUpdated'
			) {
				markQueriesStale((key) => key.startsWith(`${serverId ?? 'server'}:${userId}:`));
			}
		});
		return () => subscription.close();
	});

	$effect(() => {
		const api = session.api;
		const userId = session.user?.id;
		if (
			!ready ||
			!api ||
			!userId ||
			!pluginEnabled(session.bootstrap, 'achievementBadges') ||
			session.bootstrap?.plugins?.achievementBadges.unlockNotifications === false
		)
			return;
		let active = true;
		let pluginPreferences: Awaited<ReturnType<AchievementBadgesAdapter['getPreferences']>>['data'];
		const poll = async () => {
			const adapter = new AchievementBadgesAdapter(api);
			pluginPreferences ??= (await adapter.getPreferences(userId)).data;
			const result = await adapter.getRecent(userId, 20);
			if (!active || result.status !== 'available' || !result.data) return;
			const current = new Set(
				result.data.filter((badge) => badge.unlocked).map((badge) => badge.id)
			);
			if (knownAchievementIds) {
				for (const badge of result.data) {
					if (badge.unlocked && !knownAchievementIds.has(badge.id)) {
						if (pluginPreferences?.toastEnabled !== false) {
							toast.success('Achievement unlocked', { description: badge.title });
						}
					}
				}
			}
			knownAchievementIds = current;
		};
		void poll();
		const timer = setInterval(() => void poll(), 30_000);
		return () => {
			active = false;
			clearInterval(timer);
		};
	});

	$effect(() => {
		const text = query.trim();
		const api = session.api;
		const userId = session.user?.id;
		if (!searchOpen || text.length < 2 || !api || !userId) {
			localResults = [];
			externalResults = [];
			searchLoading = false;
			return;
		}

		const controller = new AbortController();
		const timeout = setTimeout(async () => {
			searchLoading = true;
			const localPromise: Promise<ProviderIdentifiable[]> = searchLocalMedia(api, userId, text, {
				limit: 20,
				signal: controller.signal
			})
				.then((local) => {
					if (controller.signal.aborted) return [];
					localResults = local.map((result) => ({
						id: result.id,
						source: 'jellyfin',
						title: result.name,
						kind: result.mediaType,
						year: result.year,
						imageUrl: imageForItem(api, result.item, 180),
						overview: result.item.Overview ?? undefined,
						secondary: result.subtitle,
						href: `/item/${encodeURIComponent(result.id)}`
					}));
					return local.map((result) => ({
						mediaType: result.mediaType,
						providerIds: result.providerIds
					}));
				})
				.catch(() => {
					if (!controller.signal.aborted) localResults = [];
					return [];
				});

			const externalPromise: Promise<UnifiedSearchResult[]> = fetch(
				`/api/external/search?q=${encodeURIComponent(text)}`,
				{
					headers: session.authorizationHeaders,
					signal: controller.signal
				}
			)
				.then(async (response) => {
					if (!response.ok) throw new Error('Seerr search unavailable');
					return ((await response.json()) as { results: UnifiedSearchResult[] }).results;
				})
				.catch(() => {
					if (!controller.signal.aborted) externalResults = [];
					return [];
				});

			const [localProviderIds, external] = await Promise.all([localPromise, externalPromise]);
			if (controller.signal.aborted) return;
			const discover = external.map((result) => ({
				...result,
				mediaType: result.mediaType === 'tv' ? ('series' as const) : ('movie' as const),
				providerIds: { tmdb: String(result.providerIds.tmdbId) }
			}));
			externalResults = dedupeAgainstLocal(localProviderIds, discover).map((result) => ({
				id: result.id,
				source: 'seerr',
				title: result.title,
				kind: result.mediaType,
				requestStatus: result.requestStatus ?? (result.requested ? result.availability : undefined),
				tmdbId: Number(result.providerIds.tmdb),
				imageUrl: result.posterPath
					? `https://image.tmdb.org/t/p/w185${result.posterPath}`
					: undefined,
				overview: result.overview
			}));
			searchLoading = false;
		}, 220);

		return () => {
			clearTimeout(timeout);
			controller.abort();
		};
	});

	function handleSearchSelect(item: UnifiedSearchItem) {
		searchOpen = false;
		if (item.source === 'jellyfin' && item.href) {
			void goto(resolvePath(item.href));
			return;
		}
		selectedRequest = item;
		requestOpen = true;
	}

	async function logout() {
		await session.logout();
		await goto(resolve('/login'));
	}

	function keyboard(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			searchOpen = !searchOpen;
		}
	}
</script>

<svelte:window onkeydown={keyboard} />

{#if ready && session.user}
	<AppShell
		user={session.user}
		navigation={session.navigation}
		connected={!session.error}
		serverVersion={session.bootstrap?.jellyfin?.server.version}
		onSearch={() => (searchOpen = true)}
		onLogout={logout}
	>
		{@render children()}
	</AppShell>
	<SearchCommand
		bind:open={searchOpen}
		bind:query
		{localResults}
		{externalResults}
		loading={searchLoading}
		onSelect={handleSearchSelect}
	/>
	<RequestDialog
		bind:open={requestOpen}
		item={selectedRequest}
		headers={session.authorizationHeaders}
	/>
{:else}
	<div class="grid min-h-screen place-items-center bg-background px-6 text-center">
		<div class="space-y-2">
			<div
				class="mx-auto size-8 animate-pulse rounded-full border-2 border-primary border-t-transparent"
			></div>
			<p class="text-sm text-muted-foreground">Opening Shayfin…</p>
		</div>
	</div>
{/if}
