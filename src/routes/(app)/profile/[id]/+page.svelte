<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import { session } from '$lib/app/session.svelte';
	import { pluginEnabled } from '$lib/app/plugin-capabilities';
	import FeatureUnavailable from '$lib/components/app/feature-unavailable.svelte';
	import {
		AchievementBadgesAdapter,
		type AchievementBadge,
		type AchievementFriend
	} from '$lib/jellyfin';
	import MediaHero from '$lib/components/app/media-hero.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import { Skeleton } from '$lib/components/ui/skeleton';

	let friend = $state<AchievementFriend | null>(null);
	let equipped = $state<AchievementBadge[]>([]);
	let activity = $state<Record<string, unknown>[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	function text(
		record: Record<string, unknown> | undefined,
		...keys: string[]
	): string | undefined {
		if (!record) return undefined;
		for (const key of keys) if (typeof record[key] === 'string') return record[key] as string;
	}

	async function load() {
		loading = true;
		error = null;
		await session.initialize();
		if (!pluginEnabled(session.bootstrap, 'achievementBadges')) {
			loading = false;
			return;
		}
		const api = session.api;
		const user = session.user;
		const targetId = page.params.id;
		if (!api || !user || !targetId) {
			error = 'This friend profile is unavailable.';
			loading = false;
			return;
		}
		const adapter = new AchievementBadgesAdapter(api);
		const [config, friends, badges, feed] = await Promise.all([
			adapter.getPublicConfig(),
			adapter.getFriends(user.id),
			adapter.getPublicEquipped(targetId),
			adapter.getActivityFeed(targetId)
		]);
		if (config.data?.friendsEnabled === false) {
			error = 'Friends are disabled by the Achievement Badges server configuration.';
		} else {
			friend = friends.data?.friends.find((candidate) => candidate.userId === targetId) ?? null;
			equipped = config.data?.forceHideEquippedShowcase ? [] : (badges.data ?? []);
			activity = config.data?.activityFeedEnabled === false ? [] : (feed.data ?? []);
			if (!friend) error = 'This profile is not shared with you.';
		}
		loading = false;
	}

	onMount(() => void load());
</script>

<svelte:head><title>{friend?.name ?? 'Friend'} · Shayfin</title></svelte:head>

{#if !pluginEnabled(session.bootstrap, 'achievementBadges')}
	<FeatureUnavailable
		title="Friend profiles are unavailable"
		description="Achievement Badges is disabled by this server’s administrator."
	/>
{:else}<div class="mx-auto flex w-full max-w-7xl flex-col gap-8">
		{#if loading}<Skeleton class="h-[30rem] rounded-4xl" />
		{:else if error || !friend}<Empty.Root class="min-h-96 border"
				><Empty.Header
					><Empty.Title>Friend profile unavailable</Empty.Title><Empty.Description
						>{error}</Empty.Description
					></Empty.Header
				><Empty.Content
					><Button variant="outline" onclick={load}><RotateCcwIcon />Try again</Button
					></Empty.Content
				></Empty.Root
			>
		{:else}
			{@const visibleFriend = friend}
			{#snippet metadata()}<Badge variant={visibleFriend.isOnline ? 'default' : 'secondary'}
					>{visibleFriend.isOnline ? 'Online' : 'Offline'}</Badge
				>{/snippet}
			<MediaHero
				title={visibleFriend.name}
				tagline={text(visibleFriend.nowPlaying, 'Title', 'title', 'Name', 'name')
					? `Watching · ${text(visibleFriend.nowPlaying, 'Title', 'title', 'Name', 'name')}`
					: text(visibleFriend.lastWatched, 'Title', 'title', 'Name', 'name')
						? `Last watched · ${text(visibleFriend.lastWatched, 'Title', 'title', 'Name', 'name')}`
						: 'Achievement Badges friend'}
				headingId="friend-name"
				{metadata}
			/>
			{#if equipped.length}<section class="space-y-3">
					<h2 class="text-lg font-medium">Pinned achievements</h2>
					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each equipped as badge (badge.id)}<Card.Root size="sm"
								><Card.Header
									><Card.Title class="flex items-center gap-2"
										><TrophyIcon />{badge.title}</Card.Title
									><Card.Description>{badge.description}</Card.Description></Card.Header
								><Card.Content><Badge variant="secondary">{badge.rarity}</Badge></Card.Content
								></Card.Root
							>{/each}
					</div>
				</section>{/if}
			{#if activity.length}<section class="space-y-3">
					<h2 class="text-lg font-medium">Achievement activity</h2>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each activity as event, index (`${text(event, 'Id', 'id') ?? index}`)}<Card.Root
								size="sm"
								><Card.Header
									><Card.Title
										>{text(event, 'Title', 'title', 'BadgeTitle', 'badgeTitle') ??
											'Achievement activity'}</Card.Title
									><Card.Description
										>{text(event, 'Description', 'description', 'Message', 'message') ??
											'Shared by Achievement Badges'}</Card.Description
									></Card.Header
								></Card.Root
							>{/each}
					</div>
				</section>{/if}
		{/if}
	</div>{/if}
