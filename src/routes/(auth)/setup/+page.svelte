<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Jellyfin } from '@jellyfin/sdk';
	import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ServerIcon from '@lucide/svelte/icons/server';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
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

	let publicUrl = $state('http://localhost:8096');
	let internalUrl = $state('');
	let username = $state('');
	let password = $state('');
	let submitting = $state(false);
	let loadError = $state<string | null>(null);

	onMount(async () => {
		try {
			const response = await fetch('/api/bootstrap');
			if (!response.ok) throw new Error('Unable to read Shayfin setup state.');
			const bootstrap = (await response.json()) as { configured: boolean };
			if (bootstrap.configured) await goto(resolve('/login'), { replaceState: true });
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Unable to start setup.';
		}
	});

	function normalizeUrl(value: string): string {
		const url = new URL(value.trim());
		if (url.protocol !== 'http:' && url.protocol !== 'https:')
			throw new Error('Jellyfin URLs must use HTTP or HTTPS.');
		return url.toString().replace(/\/$/, '');
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		try {
			const jellyfinPublicUrl = normalizeUrl(publicUrl);
			const jellyfinInternalUrl = internalUrl.trim() ? normalizeUrl(internalUrl) : null;
			const jellyfin = new Jellyfin({
				clientInfo: { name: 'Shayfin Setup', version: '0.0.1' },
				deviceInfo: { name: navigator.platform || 'Browser', id: crypto.randomUUID() }
			});
			const api = jellyfin.createApi(jellyfinPublicUrl);
			const authentication = await getUserApi(api).authenticateUserByName({
				authenticateUserByName: { Username: username.trim(), Pw: password }
			});
			const user = authentication.data.User;
			const jellyfinToken = authentication.data.AccessToken;
			if (!user || !jellyfinToken)
				throw new Error('Jellyfin did not return an administrator session.');
			if (user.Policy?.IsAdministrator !== true)
				throw new Error('A Jellyfin administrator account is required to finish setup.');

			const response = await fetch('/api/setup/complete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jellyfinPublicUrl, jellyfinInternalUrl, jellyfinToken })
			});
			const payload = (await response.json()) as { error?: { message?: string } };
			if (!response.ok) {
				throw new Error(payload.error?.message ?? 'Shayfin setup could not be completed.');
			}
			toast.success('Shayfin is connected to Jellyfin.');
			window.location.assign(resolve('/login'));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Setup failed.');
		} finally {
			submitting = false;
		}
	}
</script>

<main class="grid min-h-screen bg-muted/30 lg:grid-cols-[minmax(0,1fr)_minmax(30rem,0.8fr)]">
	<section class="hidden flex-col justify-between p-12 lg:flex">
		<BrandMark />
		<div class="flex max-w-xl flex-col gap-5">
			<h1 class="text-4xl font-semibold tracking-tight">
				A focused home for your Jellyfin library.
			</h1>
			<p class="text-lg leading-relaxed text-muted-foreground">
				Connect one server, keep playback direct, and add optional requests, achievements, avatars,
				and download progress when you are ready.
			</p>
			<ul class="flex flex-col gap-3 text-sm">
				<li class="flex items-center gap-3">
					<CheckIcon class="text-success" />Jellyfin remains the identity and playback authority.
				</li>
				<li class="flex items-center gap-3">
					<CheckIcon class="text-success" />External API keys stay encrypted inside this container.
				</li>
				<li class="flex items-center gap-3">
					<CheckIcon class="text-success" />No reverse proxy or separate account system required.
				</li>
			</ul>
		</div>
		<p class="text-xs text-muted-foreground">Shayfin v0.0.1</p>
	</section>

	<section class="flex items-center justify-center p-4 sm:p-8">
		<Card class="w-full max-w-xl">
			<CardHeader class="flex flex-col gap-3">
				<div
					class="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
				>
					<ServerIcon />
				</div>
				<div class="flex flex-col gap-1">
					<CardTitle>Connect Jellyfin</CardTitle>
					<CardDescription
						>Connect your server and verify a Jellyfin administrator to finish setup.</CardDescription
					>
				</div>
			</CardHeader>
			<CardContent>
				{#if loadError}
					<Alert variant="destructive" class="mb-4">
						<AlertTitle>Setup is unavailable</AlertTitle>
						<AlertDescription>{loadError}</AlertDescription>
					</Alert>
				{/if}
				<form onsubmit={submit}>
					<Field.Group>
						<Field.Field>
							<Field.Label for="public-url">Public Jellyfin URL</Field.Label>
							<Input id="public-url" type="url" inputmode="url" bind:value={publicUrl} required />
							<Field.Description
								>This address must be reachable by every browser using Shayfin.</Field.Description
							>
						</Field.Field>
						<Field.Field>
							<Field.Label for="internal-url"
								>Internal Jellyfin URL <span class="text-muted-foreground">(optional)</span
								></Field.Label
							>
							<Input
								id="internal-url"
								type="url"
								inputmode="url"
								bind:value={internalUrl}
								placeholder="http://jellyfin:8096"
							/>
							<Field.Description
								>Use a Docker-network address when it differs from the browser address.</Field.Description
							>
						</Field.Field>
						<Field.Separator>Jellyfin administrator</Field.Separator>
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
						<Alert>
							<ShieldCheckIcon />
							<AlertTitle>Your password is sent directly to Jellyfin.</AlertTitle>
							<AlertDescription
								>Shayfin validates the temporary token and stores only the server identity.</AlertDescription
							>
						</Alert>
						<Field.Field>
							<Button type="submit" class="w-full" disabled={submitting || !username || !publicUrl}>
								{#if submitting}<Spinner data-icon="inline-start" />{:else}<ServerIcon
										data-icon="inline-start"
									/>{/if}
								Connect server
							</Button>
						</Field.Field>
					</Field.Group>
				</form>
			</CardContent>
		</Card>
	</section>
</main>
