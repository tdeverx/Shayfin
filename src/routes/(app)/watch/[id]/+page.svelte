<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
	import { loadFollowingEpisode, loadItemDetail } from '$lib/jellyfin';
	import { VideoPlayer, type NextUpModel, type PlayerPresentation } from '$lib/player';
	import { session } from '$lib/app/session.svelte';
	import {
		backdropForItem,
		imageForItem,
		itemSecondary,
		logoForItem,
		posterForItem
	} from '$lib/app/media';
	import { themeAudio } from '$lib/app/theme-audio';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import { Skeleton } from '$lib/components/ui/skeleton';

	let item = $state<BaseItemDto | null>(null);
	let nextItemId = $state<string | null>(null);
	let nextUp = $state<NextUpModel | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let loadGeneration = 0;

	async function load(itemId: string) {
		const api = session.api;
		const userId = session.user?.id;
		if (!api || !userId || !itemId) return;
		const generation = ++loadGeneration;
		loading = true;
		error = null;
		// Keep prior artwork while changing episodes. It gives the loading state a
		// meaningful backdrop instead of a blank skeleton.
		nextItemId = null;
		nextUp = null;
		try {
			const detail = await loadItemDetail(api, userId, itemId);
			if (generation !== loadGeneration) return;
			item = detail;
			loading = false;

			// Next Up is useful enhancement data, never part of time-to-player.
			if (detail.Type !== 'Episode' || !detail.SeriesId) return;
			let nextId: string | null = null;
			let nextModel: NextUpModel | null = null;
			const nextEpisode = await loadFollowingEpisode(
				api,
				userId,
				detail.SeriesId,
				detail.Id ?? itemId
			);
			if (nextEpisode?.Id) {
				nextId = nextEpisode.Id;
				nextModel = {
					id: nextEpisode.Id,
					title: nextEpisode.Name ?? 'Next episode',
					secondary: itemSecondary(nextEpisode),
					imageUrl: imageForItem(api, nextEpisode, 640)
				};
			}
			if (generation !== loadGeneration) return;
			nextItemId = nextId;
			nextUp = nextModel;
		} catch (reason) {
			if (generation === loadGeneration) {
				error = reason instanceof Error ? reason.message : 'Playback could not be prepared.';
			}
		} finally {
			if (generation === loadGeneration) loading = false;
		}
	}

	async function exitPlayer() {
		const returnId = item?.Type === 'Episode' && item.SeriesId ? item.SeriesId : item?.Id;
		await goto(returnId ? resolve('/(app)/item/[id]', { id: returnId }) : resolve('/home'));
	}

	$effect(() => {
		const itemId = page.params.id;
		if (itemId) void load(itemId);
	});

	let presentation = $derived.by<PlayerPresentation | undefined>(() => {
		if (!item || !session.api) return undefined;
		return {
			title: item.Name ?? 'Untitled',
			secondary: itemSecondary(item),
			backdropUrl: backdropForItem(session.api, item, 1920),
			posterUrl: posterForItem(session.api, item, 560),
			logoUrl: logoForItem(session.api, item, 720)
		};
	});
</script>

<svelte:head><title>{item?.Name ?? 'Player'} · Shayfin</title></svelte:head>

<div class="fixed inset-0 z-50 grid min-h-svh place-items-center bg-black text-white">
	{#if loading}
		{#if item && session.api && backdropForItem(session.api, item, 1920)}
			<img
				src={backdropForItem(session.api, item, 1920)}
				alt=""
				class="size-full object-cover opacity-70"
			/>
		{:else}
			<Skeleton class="size-full rounded-none bg-zinc-900" />
		{/if}
	{:else if error || !item || !session.bootstrap?.jellyfin || !session.accessToken || !session.user || !session.api}
		<Empty.Root class="text-white">
			<Empty.Header>
				<Empty.Title>Playback is unavailable</Empty.Title>
				<Empty.Description class="text-zinc-400"
					>{error ?? 'Your Jellyfin session is incomplete.'}</Empty.Description
				>
			</Empty.Header>
			<Empty.Content><Button onclick={exitPlayer}>Return to details</Button></Empty.Content>
		</Empty.Root>
	{:else}
		<VideoPlayer
			serverUrl={session.bootstrap.jellyfin.publicUrl}
			serverId={session.bootstrap.jellyfin.server.id}
			accessToken={session.accessToken}
			userId={session.user.id}
			itemId={item.Id ?? page.params.id ?? ''}
			deviceId={session.api.deviceInfo.id}
			startTicks={item.UserData?.Played ? 0 : item.UserData?.PlaybackPositionTicks}
			{nextItemId}
			{nextUp}
			{presentation}
			quality={session.preferences.playback.quality}
			autoplayNext={session.preferences.playback.autoplayNext}
			onSaveDefaultQuality={(quality) => session.setPlaybackQuality(quality)}
			onThemeAudioStop={() => themeAudio.fadeAndStop()}
			onNext={(id) => goto(resolve('/(app)/watch/[id]', { id }))}
			onExit={exitPlayer}
			class="size-full"
		/>
	{/if}
</div>
