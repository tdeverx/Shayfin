<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import { toast } from 'svelte-sonner';
	import BrandMark from '$lib/components/app/brand-mark.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Spinner } from '$lib/components/ui/spinner';
	import { session } from '$lib/app/session.svelte';

	let username = $state('');
	let password = $state('');
	let submitting = $state(false);

	onMount(async () => {
		await session.initialize();
		if (!session.bootstrap?.configured) await goto(resolve('/setup'), { replaceState: true });
		else if (session.user) await goto(resolve('/home'), { replaceState: true });
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		try {
			await session.login(username.trim(), password);
			await goto(resolve('/home'));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Jellyfin login failed.');
		} finally {
			submitting = false;
		}
	}
</script>

<main class="grid min-h-screen place-items-center bg-muted/30 p-4">
	<Card class="w-full max-w-md">
		<CardHeader class="flex flex-col gap-4">
			<BrandMark />
			<div class="flex flex-col gap-1">
				<CardTitle>Sign in to Jellyfin</CardTitle>
				<CardDescription
					>Use the same account you already use on {session.bootstrap?.jellyfin?.server.name ??
						'your server'}.</CardDescription
				>
			</div>
		</CardHeader>
		<CardContent>
			{#if session.error}
				<Alert variant="destructive" class="mb-4">
					<AlertTitle>Shayfin is unavailable</AlertTitle>
					<AlertDescription>{session.error}</AlertDescription>
				</Alert>
			{/if}
			<form onsubmit={submit}>
				<Field.Group>
					<Field.Field>
						<Field.Label for="username">Username</Field.Label>
						<Input id="username" autocomplete="username" bind:value={username} required />
					</Field.Field>
					<Field.Field>
						<Field.Label for="password">Password</Field.Label>
						<Input
							id="password"
							type="password"
							autocomplete="current-password"
							bind:value={password}
						/>
					</Field.Field>
					<Field.Field>
						<Button type="submit" class="w-full" disabled={submitting || !username.trim()}>
							{#if submitting}<Spinner data-icon="inline-start" />{:else}<LogInIcon
									data-icon="inline-start"
								/>{/if}
							Sign in
						</Button>
					</Field.Field>
				</Field.Group>
			</form>
		</CardContent>
	</Card>
</main>
