<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import LinkIcon from '@lucide/svelte/icons/link';
	import PuzzleIcon from '@lucide/svelte/icons/puzzle';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import NetworkIcon from '@lucide/svelte/icons/network';
	import MonitorPlayIcon from '@lucide/svelte/icons/monitor-play';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Separator } from '$lib/components/ui/separator';
	import BrandMark from './brand-mark.svelte';

	let {
		connected = false,
		serverVersion
	}: {
		connected?: boolean;
		serverVersion?: string;
	} = $props();

	const groups = [
		{
			label: 'Manage',
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
</script>

<Sidebar.Root collapsible="icon">
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg" tooltipContent="Shayfin admin">
					{#snippet child({ props })}
						<a href={resolve('/home')} {...props}>
							<BrandMark compact />
							<span class="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
								<strong>Shayfin</strong>
								<small class="text-muted-foreground">Admin</small>
							</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		{#each groups as group (group.label)}
			<Sidebar.Group>
				<Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each group.items as item (item.href)}
							{@const href = resolvePath(item.href)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									isActive={page.url.pathname === href}
									tooltipContent={item.label}
								>
									{#snippet child({ props })}
										<a {href} {...props}>
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
	</Sidebar.Content>

	<Sidebar.Footer>
		<Separator />
		<div
			class="flex items-center gap-2 px-3 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
		>
			<span
				class:bg-success={connected}
				class:bg-destructive={!connected}
				class="size-2 shrink-0 rounded-full"
			></span>
			<span class="min-w-0 group-data-[collapsible=icon]:hidden">
				<strong class="block truncate text-xs">
					{connected ? 'Jellyfin connected' : 'Jellyfin unavailable'}
				</strong>
				<small class="block truncate text-muted-foreground">
					{serverVersion ? `Server ${serverVersion}` : 'Version unavailable'}
				</small>
			</span>
		</div>
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
