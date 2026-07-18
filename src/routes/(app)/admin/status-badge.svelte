<script lang="ts">
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { Badge } from '$lib/components/ui/badge';
	import type { CapabilityStatus } from './admin-client';

	let { status, label }: { status: CapabilityStatus; label?: string } = $props();
	let display = $derived(label ?? status.charAt(0).toUpperCase() + status.slice(1));
</script>

{#if status === 'available'}
	<Badge variant="secondary"><CircleCheckIcon />{display}</Badge>
{:else if status === 'degraded'}
	<Badge variant="outline"><TriangleAlertIcon />{display}</Badge>
{:else if status === 'misconfigured'}
	<Badge variant="destructive"><CircleXIcon />{display}</Badge>
{:else}
	<Badge variant="outline"><CircleHelpIcon />{display}</Badge>
{/if}
