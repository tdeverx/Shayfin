<script lang="ts">
	import type { Snippet } from 'svelte';
	import StatusBadge from '../status-badge.svelte';
	import type { CapabilityStatus } from '../admin-client';

	let {
		label,
		value,
		status,
		detail
	}: { label: string; value: string; status: CapabilityStatus; detail?: Snippet } = $props();
</script>

<div
	class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
>
	<div class="min-w-0">
		<p class="font-medium">{label}</p>
		<p class="text-xs break-all text-muted-foreground">{value}</p>
		{#if detail}<div class="mt-1 text-xs text-muted-foreground">{@render detail()}</div>{/if}
	</div>
	<StatusBadge {status} />
</div>
