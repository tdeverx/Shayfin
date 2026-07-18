<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
	import { loadEpisodes, loadItemDetail, nextEpisodeId } from '$lib/jellyfin';
	import { VideoPlayer } from '$lib/player';
	import { session } from '$lib/app/session.svelte';
	import { themeAudio } from '$lib/app/theme-audio';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import { Skeleton } from '$lib/components/ui/skeleton';

	let item = $state<BaseItemDto | null>(null);
	let nextItemId = $state<string | null>(null);
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
		item = null;
		nextItemId = null;
		try {
			const detail = await loadItemDetail(api, userId, itemId);
			let nextId: string | null = null;
			if (detail.Type === 'Episode' && detail.SeriesId) {
				const episodes = await loadEpisodes(api, userId, detail.SeriesId);
				nextId = nextEpisodeId(episodes, detail.Id ?? itemId);
			}
			if (generation !== loadGeneration) return;
			item = detail;
			nextItemId = nextId;
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
</script>

<svelte:head><title>{item?.Name ?? 'Player'} · Shayfin</title></svelte:head>

<div class="fixed inset-0 z-50 grid min-h-svh place-items-center bg-black text-white">
	{#if loading}
		<Skeleton class="size-full rounded-none bg-zinc-900" />
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
			accessToken={session.accessToken}
			userId={session.user.id}
			itemId={item.Id ?? page.params.id ?? ''}
			deviceId={session.api.deviceInfo.id}
			startTicks={item.UserData?.Played ? 0 : item.UserData?.PlaybackPositionTicks}
			{nextItemId}
			onThemeAudioStop={() => themeAudio.fadeAndStop()}
			onNext={(id) => goto(resolve('/(app)/watch/[id]', { id }))}
			onExit={exitPlayer}
			class="size-full"
		/>
	{/if}
</div>
