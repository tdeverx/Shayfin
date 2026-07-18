<script lang="ts">
	import DownloadIcon from '@lucide/svelte/icons/download';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import type { DownloadModel } from '$lib/app/models';

	let { downloads }: { downloads: DownloadModel[] } = $props();

	function formatEta(value: string): string {
		const target = new Date(value);
		if (Number.isNaN(target.valueOf())) return value;
		const minutes = Math.max(0, Math.round((target.valueOf() - Date.now()) / 60_000));
		if (minutes < 1) return 'Soon';
		if (minutes < 60) return `~${minutes}m`;
		const hours = Math.floor(minutes / 60);
		const remainder = minutes % 60;
		return remainder ? `~${hours}h ${remainder}m` : `~${hours}h`;
	}
</script>

{#if downloads.length > 0}
	<section aria-labelledby="downloads-title" class="flex flex-col gap-3">
		<h2 id="downloads-title" class="text-lg font-medium tracking-tight">On the way</h2>
		<div
			class="grid overflow-hidden rounded-4xl border border-border bg-card {downloads.length > 1
				? 'md:grid-cols-2'
				: ''}"
		>
			{#each downloads.slice(0, 4) as download, index (download.id)}
				<div
					class="flex min-w-0 items-center gap-3 p-3 {index > 0
						? 'border-t border-border md:border-t-0 md:border-l'
						: ''}"
				>
					<div
						class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-muted"
					>
						{#if download.imageUrl}<img
								src={download.imageUrl}
								alt=""
								class="size-full object-cover"
							/>{:else}<DownloadIcon />{/if}
					</div>
					<div class="flex min-w-0 flex-1 flex-col gap-2">
						<div class="flex items-center justify-between gap-3">
							<strong class="truncate text-sm">{download.title}</strong>
							<Badge variant="secondary"
								>{download.service === 'sonarr' ? 'Sonarr' : 'Radarr'}</Badge
							>
						</div>
						<Progress value={download.progress ?? 0} />
						<div class="flex justify-between gap-3 text-xs text-muted-foreground">
							<span
								>{download.progress === undefined
									? download.state
									: `${Math.round(download.progress)}%`}</span
							>
							{#if download.eta}<span>{formatEta(download.eta)}</span>{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}
