<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, type Snippet } from 'svelte';
	import { session } from '$lib/app/session.svelte';
	import { Spinner } from '$lib/components/ui/spinner';

	let { children }: { children: Snippet } = $props();
	let allowed = $state(false);

	onMount(async () => {
		await session.initialize();
		if (!session.user?.isAdministrator) {
			await goto(resolve('/home'), { replaceState: true });
			return;
		}
		allowed = true;
	});
</script>

{#if allowed}
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-8">
		{@render children()}
	</div>
{:else}
	<div class="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
		<Spinner />
		Checking administrator access
	</div>
{/if}
