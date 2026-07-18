<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import LinkIcon from '@lucide/svelte/icons/link';
	import MonitorPlayIcon from '@lucide/svelte/icons/monitor-play';
	import NetworkIcon from '@lucide/svelte/icons/network';
	import PuzzleIcon from '@lucide/svelte/icons/puzzle';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import type { AppUser } from '$lib/app/models';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Separator } from '$lib/components/ui/separator';

	let {
		user,
		connected = false,
		serverVersion
	}: {
		user: AppUser;
		connected?: boolean;
		serverVersion?: string;
	} = $props();

	const userItems = [{ label: 'Settings', href: '/settings', icon: SlidersHorizontalIcon }];
	const adminGroups = [
		{
			label: 'Administration',
			items: [
				{ label: 'Overview', href: '/admin', icon: GaugeIcon },
				{ label: 'Connections', href: '/admin/connections', icon: LinkIcon },
				{ label: 'Integrations', href: '/admin/integrations', icon: PuzzleIcon },
				{ label: 'Downloads', href: '/admin/downloads', icon: DownloadIcon }
			]
		},
		{
			label: 'Server',
			items: [
				{ label: 'Networking', href: '/admin/networking', icon: NetworkIcon },
				{ label: 'Playback', href: '/admin/playback', icon: MonitorPlayIcon },
				{ label: 'System', href: '/admin/system', icon: SettingsIcon }
			]
		}
	];
	const resolvePath = resolve as (path: string) => ResolvedPathname;

	function active(href: string): boolean {
		const path = resolvePath(href);
		return href === '/admin'
			? page.url.pathname === path
			: page.url.pathname === path || page.url.pathname.startsWith(`${path}/`);
	}
</script>

<Sidebar.Root collapsible="offcanvas" class="top-16 h-[calc(100svh-4rem)]">
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href={resolve('/home')} {...props}>
							<ArrowLeftIcon />
							<span class="flex min-w-0 flex-col">
								<strong>Settings</strong>
								<small class="text-muted-foreground">Back to Shayfin</small>
							</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Your account</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each userItems as item (item.href)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={active(item.href)}>
								{#snippet child({ props })}
									<a href={resolvePath(item.href)} {...props}>
										<item.icon />
										<span>{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		{#if user.isAdministrator}
			{#each adminGroups as group (group.label)}
				<Sidebar.Group>
					<Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							{#each group.items as item (item.href)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton isActive={active(item.href)}>
										{#snippet child({ props })}
											<a href={resolvePath(item.href)} {...props}>
												<item.icon />
												<span>{item.label}</span>
											</a>
										{/snippet}
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/each}
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			{/each}
		{/if}
	</Sidebar.Content>

	<Sidebar.Footer>
		<Separator />
		<div class="flex items-center gap-2 px-3 py-2">
			<span
				class:bg-success={connected}
				class:bg-destructive={!connected}
				class="size-2 rounded-full"
			></span>
			<span class="min-w-0">
				<strong class="block truncate text-xs">
					{connected ? 'Jellyfin connected' : 'Jellyfin unavailable'}
				</strong>
				<small class="block truncate text-muted-foreground">
					{serverVersion ? `Server ${serverVersion}` : user.name}
				</small>
			</span>
		</div>
	</Sidebar.Footer>
</Sidebar.Root>
