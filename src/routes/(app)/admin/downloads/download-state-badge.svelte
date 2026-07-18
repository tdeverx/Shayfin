<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import type { DownloadProgress } from '../admin-client';

	let { state }: { state: DownloadProgress['state'] } = $props();
</script>

{#if state === 'failed'}
	<Badge variant="destructive">Failed</Badge>
{:else if state === 'warning'}
	<Badge variant="outline">Warning</Badge>
{:else if state === 'completed'}
	<Badge variant="secondary">Completed</Badge>
{:else if state === 'importing'}
	<Badge variant="secondary">Importing</Badge>
{:else if state === 'downloading'}
	<Badge>Downloading</Badge>
{:else}
	<Badge variant="outline">Queued</Badge>
{/if}
