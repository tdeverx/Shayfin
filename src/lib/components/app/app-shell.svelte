<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Button } from '$lib/components/ui/button';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { headerContext } from '$lib/app/header-context.svelte';
	import type { AppUser, MediaNavigationItem } from '$lib/app/models';
	import MediaPill from './media-pill.svelte';
	import ProfileMenu from './profile-menu.svelte';
	import SettingsSidebar from './settings-sidebar.svelte';

	let {
		children,
		user,
		navigation,
		connected = true,
		serverVersion,
		onSearch,
		onLogout
	}: {
		children: Snippet;
		user: AppUser;
		navigation: MediaNavigationItem[];
		connected?: boolean;
		serverVersion?: string;
		onSearch: () => void;
		onLogout: () => void | Promise<void>;
	} = $props();

	let sidebarOpen = $state(false);
	let settingsContext = $derived(
		page.url.pathname === '/settings' ||
			page.url.pathname.startsWith('/settings/') ||
			page.url.pathname === '/admin' ||
			page.url.pathname.startsWith('/admin/')
	);
	let detailContext = $derived(page.url.pathname.startsWith('/item/'));
	let libraryContext = $derived(page.url.pathname === '/movies' || page.url.pathname === '/series');
	let libraryLabel = $derived(page.url.pathname === '/series' ? 'shows' : 'movies');

	function goBack() {
		if (history.length > 1) history.back();
		else void goto(resolve('/home'));
	}

	$effect(() => {
		if (!libraryContext) headerContext.resetFilters();
	});

	onMount(() => {
		const stored = document.cookie
			.split('; ')
			.find((entry) => entry.startsWith('sidebar_state='))
			?.split('=')[1];
		sidebarOpen =
			stored === undefined ? matchMedia('(min-width: 1024px)').matches : stored === 'true';
	});
</script>

{#snippet Chrome()}
	<div class="fixed top-3 left-3 z-30 flex items-center gap-2">
		<ProfileMenu {user} {onLogout} />
		{#if detailContext}
			<Tooltip>
				<TooltipTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="secondary"
							size="icon-lg"
							class="rounded-full bg-background/80 backdrop-blur"
							aria-label="Back to previous page"
							onclick={goBack}
						>
							<ArrowLeftIcon />
						</Button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent>Back</TooltipContent>
			</Tooltip>
		{/if}
	</div>
	{#if settingsContext}
		<Sidebar.Trigger
			class="fixed top-3 left-16 z-30 size-10 rounded-full bg-background/80 backdrop-blur"
			aria-label="Toggle settings sidebar"
		/>
	{/if}
	<MediaPill items={navigation} />
	<div class="fixed top-3 right-3 z-30 flex items-center gap-2">
		{#if libraryContext}
			<Tooltip>
				<TooltipTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant={headerContext.hasActiveFilters ? 'default' : 'secondary'}
							size="icon-lg"
							class="rounded-full backdrop-blur"
							aria-label={`Filter ${libraryLabel}`}
							onclick={() => headerContext.openFilters()}
						>
							<SlidersHorizontalIcon />
						</Button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent>Filter {libraryLabel}</TooltipContent>
			</Tooltip>
		{/if}
		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="secondary"
						size="icon-lg"
						class="rounded-full bg-background/80 backdrop-blur"
						aria-label="Search"
						onclick={onSearch}
					>
						<SearchIcon />
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent>Search · ⌘K</TooltipContent>
		</Tooltip>
	</div>
{/snippet}

<a
	href="#main-content"
	class="fixed top-2 left-2 z-50 -translate-y-20 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:translate-y-0"
>
	Skip to content
</a>

{#if settingsContext}
	<Sidebar.Provider bind:open={sidebarOpen}>
		<SettingsSidebar {user} {connected} {serverVersion} />
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
