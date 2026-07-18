<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
	import {
		HomeScreenSectionsAdapter,
		loadDefaultHome,
		loadThemeSongs,
		subscribeToInvalidations,
		type HomeSectionModel
	} from '$lib/jellyfin';
	import DownloadStrip from '$lib/components/app/download-strip.svelte';
	import CollectionFeature from '$lib/components/app/collection-feature.svelte';
	import MediaRail from '$lib/components/app/media-rail.svelte';
	import Spotlight from '$lib/components/app/spotlight.svelte';
	import * as Empty from '$lib/components/ui/empty';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { session } from '$lib/app/session.svelte';
	import { themeAudio } from '$lib/app/theme-audio';
	import { toMediaCard, toSpotlight } from '$lib/app/media';
	import type { DownloadModel, MediaSectionModel } from '$lib/app/models';
	import type { DownloadProgress } from '$lib/server/contracts';

	let sections = $state<HomeSectionModel[]>([]);
	let downloads = $state<DownloadModel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let themeAvailable = $state(false);
	let themeUrl = $state<string | null>(null);
	let themeItemId = $state<string | null>(null);
	let retryThemeOnInteraction: (() => void) | null = null;
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;

	let spotlight = $derived.by(() => {
		const api = session.api;
		const first = sections[0];
		const item = first?.variant === 'collection' ? undefined : first?.items[0];
		return api && item ? toSpotlight(api, item) : null;
	});

	let rails = $derived.by(() => {
		const api = session.api;
		if (!api) return [];
		return sections
			.map((section, sectionIndex): MediaSectionModel => {
				const seen = new SvelteSet<string>();
				const promotedId =
					sectionIndex === 0 && section.variant !== 'collection' ? section.items[0]?.Id : undefined;
				return {
					id: `${section.id}-${section.order}-${sectionIndex}`,
					title: section.title,
					variant:
						section.variant === 'collection'
							? 'collection'
							: section.variant === 'portrait'
								? 'portrait'
								: 'landscape',
					backdropUrl: section.items
						.map((item) => toMediaCard(api, item, 'landscape')?.backdropUrl)
						.find(Boolean),
					items: section.items.flatMap((item) => {
						if (item.Id === promotedId) return [];
						const card = toMediaCard(
							api,
							item,
							section.variant === 'portrait' || section.variant === 'collection'
								? 'portrait'
								: 'landscape'
						);
						if (!card || seen.has(card.id)) return [];
						seen.add(card.id);
						return [card];
					})
				};
			})
			.filter((section) => section.items.length > 0);
	});

	async function loadHome() {
		const api = session.api;
		const userId = session.user?.id;
		if (!api || !userId) return;
		error = null;
		try {
			const plugin = await new HomeScreenSectionsAdapter(api).loadHome(userId, navigator.language);
			sections = plugin.data?.length ? plugin.data : await loadDefaultHome(api, userId);
			await probeTheme(sections[0]?.variant === 'collection' ? undefined : sections[0]?.items[0]);
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Your home screen could not be loaded.';
		} finally {
			loading = false;
		}
	}

	async function probeTheme(item?: BaseItemDto) {
		themeAvailable = false;
		themeUrl = null;
		themeItemId = null;
		if (!session.api || !item?.Id) return;
		const candidates = [item.Id, item.SeriesId].filter((id): id is string => Boolean(id));
		for (const id of candidates) {
			try {
				const songs = await loadThemeSongs(session.api, id, session.user?.id);
				if (songs[0]) {
					themeAvailable = true;
					themeUrl = songs[0].streamUrl;
					themeItemId = id;
					return;
				}
			} catch {
				// Try the parent series when an episode has no theme of its own.
			}
		}
	}

	async function playTheme(manual = true) {
		if (!themeUrl || !session.themeAudioEnabled) {
			if (!manual) return;
			toast.info('Enable theme music from the sound button first.');
			return;
		}
		try {
			await themeAudio.play(themeUrl);
		} catch {
			if (manual) toast.error('Theme music could not be played.');
			else if (!retryThemeOnInteraction) {
				retryThemeOnInteraction = () => {
					retryThemeOnInteraction = null;
					void playTheme(false);
				};
				document.addEventListener('pointerdown', retryThemeOnInteraction, { once: true });
			}
		}
	}

	$effect(() => {
		const enabled = session.themeAudioEnabled;
		const url = themeUrl;
		const id = themeItemId;
		if (enabled && url && id) queueMicrotask(() => void playTheme(false));
		else themeAudio.fadeAndStop();
	});

	async function loadDownloads() {
		if (!session.accessToken) return;
		try {
			const response = await fetch('/api/external/downloads', {
				headers: session.authorizationHeaders
			});
			if (!response.ok) return;
			const body = (await response.json()) as { downloads: DownloadProgress[] };
			downloads = body.downloads.map((item) => ({
				id: item.id,
				title: item.title,
				service: item.service,
				progress: item.progress,
				eta: item.eta,
				state: item.state
			}));
		} catch {
			// Optional integration: the home experience remains intact.
		}
	}

	onMount(() => {
		void loadHome();
		void loadDownloads();
		const subscription = session.api
			? subscribeToInvalidations(session.api, () => {
					clearTimeout(refreshTimer);
					refreshTimer = setTimeout(() => void loadHome(), 500);
				})
			: undefined;
		let poll = setInterval(() => void loadDownloads(), document.hidden ? 60_000 : 15_000);
		const visibility = () => {
			clearInterval(poll);
			poll = setInterval(() => void loadDownloads(), document.hidden ? 60_000 : 15_000);
			void loadDownloads();
		};
		document.addEventListener('visibilitychange', visibility);
		return () => {
			subscription?.close();
			clearInterval(poll);
			clearTimeout(refreshTimer);
			document.removeEventListener('visibilitychange', visibility);
			if (retryThemeOnInteraction)
				document.removeEventListener('pointerdown', retryThemeOnInteraction);
			themeAudio.fadeAndStop();
		};
	});
</script>

<svelte:head><title>Home · Shayfin</title></svelte:head>

{#if loading}
	<div class="space-y-8">
		<Skeleton class="h-[23rem] w-full rounded-xl" />
		{#each [0, 1] as row (row)}
			<div class="space-y-3">
				<Skeleton class="h-6 w-48" />
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{#each [0, 1, 2, 3] as card (card)}<Skeleton class="aspect-video rounded-xl" />{/each}
				</div>
			</div>
		{/each}
	</div>
{:else if error}
	<Empty.Root class="min-h-[24rem] border border-border">
		<Empty.Header>
			<Empty.Title>Home is taking a break</Empty.Title>
			<Empty.Description>{error}</Empty.Description>
		</Empty.Header>
	</Empty.Root>
{:else if sections.length === 0}
	<Empty.Root class="min-h-[24rem] border border-border">
		<Empty.Header>
			<Empty.Title>Your library is ready for its first feature</Empty.Title>
			<Empty.Description
				>Add a movie or episode in Jellyfin and it will appear here.</Empty.Description
			>
		</Empty.Header>
	</Empty.Root>
{:else}
	<div class="space-y-9">
		{#if spotlight}<Spotlight
				item={spotlight}
				themeAudioAvailable={themeAvailable}
				onThemeAudio={playTheme}
			/>{/if}
		<DownloadStrip {downloads} />
		{#each rails as section (section.id)}
			{#if section.variant === 'collection'}<CollectionFeature {section} />{:else}<MediaRail
					{section}
				/>{/if}
		{/each}
	</div>
{/if}
