<script lang="ts">
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
	import LockIcon from '@lucide/svelte/icons/lock';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { Progress } from '$lib/components/ui/progress';
	import { Button } from '$lib/components/ui/button';
	import type { AchievementBadge } from '$lib/jellyfin';

	let {
		badge,
		rarityPercentage,
		equipped = false,
		canToggle = false,
		busy = false,
		onToggle
	}: {
		badge: AchievementBadge;
		rarityPercentage?: number;
		equipped?: boolean;
		canToggle?: boolean;
		busy?: boolean;
		onToggle?: () => void;
	} = $props();
	let progress = $derived(
		badge.targetValue > 0
			? Math.min(100, Math.max(0, (badge.currentValue / badge.targetValue) * 100))
			: badge.unlocked
				? 100
				: 0
	);
</script>

<Card.Root size="sm" class={!badge.unlocked ? 'opacity-70' : undefined}>
	<Card.Header>
		<div class="flex items-start gap-3">
			<div
				class="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
			>
				{#if badge.unlocked}<TrophyIcon />{:else}<LockIcon />{/if}
			</div>
			<div class="min-w-0 space-y-1">
				<Card.Title>{badge.title}</Card.Title><Card.Description
					>{badge.description}</Card.Description
				>
			</div>
		</div>
	</Card.Header>
	<Card.Content class="space-y-3">
		<div class="flex flex-wrap gap-2">
			<Badge variant="outline">{badge.category}</Badge><Badge variant="secondary"
				>{badge.rarity}</Badge
			>{#if typeof rarityPercentage === 'number'}<Badge variant="outline"
					>{rarityPercentage.toFixed(1)}% unlocked</Badge
				>{/if}{#if badge.unlocked}<Badge><CheckCircleIcon />Unlocked</Badge>{/if}
		</div>
		{#if badge.targetValue > 0}
			<div class="space-y-1.5">
				<Progress value={progress} aria-label={`${badge.title} progress`} />
				<p class="text-xs text-muted-foreground">
					{badge.currentValue.toLocaleString()} of {badge.targetValue.toLocaleString()}
				</p>
			</div>
		{/if}
		{#if badge.unlocked && onToggle}
			<Button
				variant={equipped ? 'secondary' : 'outline'}
				size="sm"
				disabled={!canToggle || busy}
				onclick={onToggle}
			>
				{busy ? 'Updating…' : equipped ? 'Unpin from profile' : 'Pin to profile'}
			</Button>
		{/if}
	</Card.Content>
</Card.Root>
