<script lang="ts">
	import { toast } from 'svelte-sonner';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Switch } from '$lib/components/ui/switch';
	import type { UnifiedSearchItem } from '$lib/app/models';

	let {
		open = $bindable(false),
		item,
		headers,
		onRequested
	}: {
		open?: boolean;
		item: UnifiedSearchItem | null;
		headers: HeadersInit;
		onRequested?: () => void;
	} = $props();

	let requesting = $state(false);
	let is4k = $state(false);
	let allSeasons = $state(true);
	let seasons = $state('');
	let error = $state<string | null>(null);

	async function submit() {
		if (!item?.tmdbId) return;
		requesting = true;
		error = null;
		try {
			const parsedSeasons = seasons
				.split(',')
				.map((value) => Number(value.trim()))
				.filter((value) => Number.isInteger(value) && value >= 0);
			const response = await fetch('/api/external/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({
					mediaType: item.kind === 'movie' ? 'movie' : 'tv',
					mediaId: item.tmdbId,
					...(item.kind !== 'movie' ? { seasons: allSeasons ? 'all' : parsedSeasons } : {}),
					is4k
				})
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message ?? 'The request could not be created.');
			}
			toast.success(`${item.title} was requested.`);
			open = false;
			onRequested?.();
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'The request could not be created.';
		} finally {
			requesting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Request {item?.title ?? 'media'}</Dialog.Title>
			<Dialog.Description>
				Seerr will choose the configured quality profile, root folder, and download server.
			</Dialog.Description>
		</Dialog.Header>

		{#if item}
			<div class="space-y-5">
				{#if item.kind !== 'movie'}
					<Field.Set>
						<Field.Legend>Television seasons</Field.Legend>
						<Field.Group>
							<Field.Field orientation="horizontal">
								<Field.Content>
									<Field.Label for="request-all-seasons">All available seasons</Field.Label>
									<Field.Description>Request the complete series in Seerr.</Field.Description>
								</Field.Content>
								<Switch id="request-all-seasons" bind:checked={allSeasons} />
							</Field.Field>
							{#if !allSeasons}
								<Field.Field>
									<Field.Label for="request-seasons">Season numbers</Field.Label>
									<Input id="request-seasons" bind:value={seasons} placeholder="1, 2, 3" />
									<Field.Description>Separate season numbers with commas.</Field.Description>
								</Field.Field>
							{/if}
						</Field.Group>
					</Field.Set>
				{/if}

				<Field.Field orientation="horizontal">
					<Field.Content>
						<Field.Label for="request-4k">Prefer 4K</Field.Label>
						<Field.Description>Use Seerr's configured 4K route when available.</Field.Description>
					</Field.Content>
					<Switch id="request-4k" bind:checked={is4k} />
				</Field.Field>
				{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button
				disabled={requesting || (!allSeasons && item?.kind !== 'movie' && !seasons.trim())}
				onclick={submit}
			>
				<SparklesIcon data-icon="inline-start" />
				{requesting ? 'Requesting…' : 'Send request'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
