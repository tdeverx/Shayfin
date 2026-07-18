<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import Volume2Icon from '@lucide/svelte/icons/volume-2';
	import VolumeXIcon from '@lucide/svelte/icons/volume-x';
	import { Button } from '$lib/components/ui/button';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import type { AppUser, MediaNavigationItem } from '$lib/app/models';
	import AdminSidebar from './admin-sidebar.svelte';
	import MediaPill from './media-pill.svelte';
	import ProfileMenu from './profile-menu.svelte';

	let {
		children,
		user,
		navigation,
		connected = true,
		serverVersion,
		themeAudioEnabled = $bindable(false),
		onSearch,
		onLogout
	}: {
		children: Snippet;
		user: AppUser;
		navigation: MediaNavigationItem[];
		connected?: boolean;
		serverVersion?: string;
		themeAudioEnabled?: boolean;
		onSearch: () => void;
		onLogout: () => void | Promise<void>;
	} = $props();

	let sidebarOpen = $state(false);

	onMount(() => {
		const wide = matchMedia('(min-width: 1536px)');
		const sync = () => (sidebarOpen = wide.matches);
		sync();
		wide.addEventListener('change', sync);
		return () => wide.removeEventListener('change', sync);
	});
</script>

{#snippet Chrome()}
	<MediaPill items={navigation} {onSearch} />
	<div class="fixed top-3 right-3 z-30 flex items-center gap-1">
		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						class="hidden rounded-full bg-background/80 backdrop-blur md:inline-flex"
						aria-label={themeAudioEnabled ? 'Disable theme music' : 'Enable theme music'}
						onclick={() => (themeAudioEnabled = !themeAudioEnabled)}
					>
						{#if themeAudioEnabled}<Volume2Icon />{:else}<VolumeXIcon />{/if}
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent>{themeAudioEnabled ? 'Theme music on' : 'Theme music off'}</TooltipContent>
		</Tooltip>
		<ProfileMenu {user} {onLogout} />
	</div>
{/snippet}

<a
	href="#main-content"
	class="fixed top-2 left-2 z-50 -translate-y-20 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:translate-y-0"
>
	Skip to content
</a>

{#if user.isAdministrator}
	<Sidebar.Provider bind:open={sidebarOpen}>
		<AdminSidebar {connected} {serverVersion} />
		<Sidebar.Inset id="main-content" class="min-w-0 bg-transparent">
			{@render Chrome()}
			<div class="min-h-screen min-w-0 px-4 pt-20 pb-10 sm:px-6 lg:px-8">
				{@render children()}
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>
{:else}
	{@render Chrome()}
	<main
		id="main-content"
		class="mx-auto min-h-screen w-full max-w-[110rem] px-4 pt-20 pb-10 sm:px-6 lg:px-8"
	>
		{@render children()}
	</main>
{/if}
