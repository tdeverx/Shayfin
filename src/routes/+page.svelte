<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Spinner } from '$lib/components/ui/spinner';
	import { session } from '$lib/app/session.svelte';

	onMount(async () => {
		await session.initialize();
		if (!session.bootstrap?.configured) await goto(resolve('/setup'), { replaceState: true });
		else if (session.user) await goto(resolve('/home'), { replaceState: true });
		else await goto(resolve('/login'), { replaceState: true });
	});
</script>

<main class="flex min-h-screen items-center justify-center" aria-label="Loading Shayfin">
	<Spinner class="text-muted-foreground" />
</main>
