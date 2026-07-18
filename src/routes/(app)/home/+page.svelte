<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
	import {
		HomeScreenSectionsAdapter,
		MediaBarEnhancedAdapter,
		loadDefaultHome,
		resolveHeroTrailer,
		selectFallbackHeroSection,
		subscribeToInvalidations,
		type HeroTrailer,
		type HomeSectionModel
	} from '$lib/jellyfin';
	import DownloadStrip from '$lib/components/app/download-strip.svelte';
	import CollectionFeature from '$lib/components/app/collection-feature.svelte';
	import MediaRail from '$lib/components/app/media-rail.svelte';
	import HeroCarousel from '$lib/components/app/hero-carousel.svelte';
	import * as Empty from '$lib/components/ui/empty';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { session } from '$lib/app/session.svelte';
	import { toMediaCard, toSpotlight } from '$lib/app/media';
	import type { DownloadModel, MediaSectionModel } from '$lib/app/models';
	import type { DownloadProgress } from '$lib/server/contracts';

	let sections = $state<HomeSectionModel[]>([]);
	let downloads = $state<DownloadModel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let heroItems = $state<BaseItemDto[]>([]);
	let heroSourceSectionId = $state<string | null>(null);
	let heroTrailer = $state<HeroTrailer | null>(null);
	let heroTrailerItemId = $state<string | null>(null);
	let trailerOverrides = $state<Record<string, string>>({});
	let preferLocalTrailers = $state(false);
	let onlyLocalTrailers = $state(false);
	let heroLoadToken = 0;
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;

	let heroModels = $derived.by(() => {
		const api = session.api;
		return api
			? heroItems.map((item) => toSpotlight(api, item)).filter((item) => item !== null)
			: [];
	});

	let rails = $derived.by(() => {
		const api = session.api;
		if (!api) return [];
		return sections
			.filter((section) => section.id !== heroSourceSectionId)
			.map((section, sectionIndex): MediaSectionModel => {
				const seen = new SvelteSet<string>();
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
			const [plugin, mediaBar] = await Promise.all([
				new HomeScreenSectionsAdapter(api).loadHome(userId, navigator.language),
				new MediaBarEnhancedAdapter(api).loadHero(userId)
			]);
			sections = plugin.data?.length ? plugin.data : await loadDefaultHome(api, userId);
			if (mediaBar.data?.items.length) {
				heroItems = mediaBar.data.items;
				heroSourceSectionId = null;
				trailerOverrides = mediaBar.data.trailerOverrides;
				preferLocalTrailers = mediaBar.data.preferLocalTrailers;
				onlyLocalTrailers = mediaBar.data.onlyLocalTrailers;
			} else {
				const fallback = selectFallbackHeroSection(sections);
				heroItems = fallback?.items ?? [];
				heroSourceSectionId = fallback?.id ?? null;
				trailerOverrides = {};
				preferLocalTrailers = false;
				onlyLocalTrailers = false;
			}
			if (heroItems[0]?.Id) await selectHeroItem(heroItems[0].Id);
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Your home screen could not be loaded.';
		} finally {
			loading = false;
		}
	}

	async function selectHeroItem(id: string) {
		const item = heroItems.find((candidate) => candidate.Id === id);
		const api = session.api;
		const userId = session.user?.id;
		if (!item || !api || !userId) return;
		const token = ++heroLoadToken;
		heroTrailer = null;
		heroTrailerItemId = null;
		const trailer = await resolveHeroTrailer(api, item, userId, {
			override: trailerOverrides[id],
			preferLocal: preferLocalTrailers,
			onlyLocal: onlyLocalTrailers
		});
		if (token === heroLoadToken) {
			heroTrailer = trailer;
			heroTrailerItemId = id;
		}
	}

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
		};
	});
</script>

<svelte:head><title>Home · Shayfin</title></svelte:head>

{#if loading}
	<div class="flex flex-col gap-9">
		<div
			class="relative left-1/2 -mt-20 h-[clamp(28rem,62svh,40rem)] w-[100dvw] -translate-x-1/2 overflow-hidden bg-background"
		>
			<Skeleton class="absolute inset-0 size-full rounded-none" />
			<div
				class="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-background via-background/60 to-transparent"
			></div>
			<div
				class="relative mx-auto flex size-full max-w-[110rem] items-end px-4 pt-28 pb-8 sm:px-6 sm:pb-10 lg:px-8"
			>
				<div class="flex w-full max-w-xl flex-col gap-4">
					<Skeleton class="h-20 w-72 max-w-[75vw]" />
					<div class="flex gap-2">
						<Skeleton class="h-6 w-14" /><Skeleton class="h-6 w-12" /><Skeleton class="h-6 w-16" />
					</div>
					<Skeleton class="h-5 w-80 max-w-[80vw]" />
				</div>
			</div>
		</div>
		{#each [0, 1] as row (row)}
			<div class="flex flex-col gap-3">
				<Skeleton class="h-6 w-48" />
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{#each [0, 1, 2, 3] as card (card)}<Skeleton class="aspect-video rounded-4xl" />{/each}
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
		{#if heroModels.length}<HeroCarousel
				items={heroModels}
				trailer={heroTrailerItemId ? heroTrailer : null}
				onItemChange={selectHeroItem}
			/>{/if}
		<DownloadStrip {downloads} />
		{#each rails as section (section.id)}
			{#if section.variant === 'collection'}<CollectionFeature {section} />{:else}<MediaRail
					{section}
				/>{/if}
		{/each}
	</div>
{/if}
