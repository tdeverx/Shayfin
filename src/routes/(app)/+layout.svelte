<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { searchLocalMedia, dedupeAgainstLocal } from '$lib/jellyfin';
	import AppShell from '$lib/components/app/app-shell.svelte';
	import RequestDialog from '$lib/components/app/request-dialog.svelte';
	import SearchCommand from '$lib/components/app/search-command.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { session } from '$lib/app/session.svelte';
	import { themeAudio } from '$lib/app/theme-audio';
	import type { UnifiedSearchItem } from '$lib/app/models';
	import type { ProviderIdentifiable } from '$lib/jellyfin';
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
	let themeAudioEnabled = $state(false);
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
		themeAudioEnabled = session.themeAudioEnabled;
		ready = true;
	});

	$effect(() => {
		if (ready && session.user) {
			session.setThemeAudio(themeAudioEnabled);
			if (!themeAudioEnabled) themeAudio.fadeAndStop();
		}
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
				tmdbId: Number(result.providerIds.tmdb)
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
		bind:themeAudioEnabled
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
	<div class="mx-auto max-w-7xl space-y-6 px-6 py-20">
		<Skeleton class="h-80 w-full rounded-xl" />
		<Skeleton class="h-6 w-48" />
		<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
			{#each [0, 1, 2, 3] as skeleton (skeleton)}<Skeleton class="aspect-video rounded-xl" />{/each}
		</div>
	</div>
{/if}
