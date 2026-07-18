<script lang="ts">
	import { resolve } from '$app/paths';
	import UserIcon from '@lucide/svelte/icons/user';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { AppUser } from '$lib/app/models';

	let {
		user,
		onLogout
	}: {
		user: AppUser;
		onLogout: () => void | Promise<void>;
	} = $props();

	let initials = $derived(
		user.name
			.split(/\s+/)
			.map((part) => part[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger aria-label={`Open ${user.name}'s profile menu`}>
		{#snippet child({ props })}
			<button
				{...props}
				class="relative rounded-full ring-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Avatar.Root class="size-10">
					{#if user.imageUrl}<Avatar.Image src={user.imageUrl} alt="" />{/if}
					<Avatar.Fallback>{initials}</Avatar.Fallback>
					<Avatar.Badge class="bg-success" />
				</Avatar.Root>
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="start" class="w-52">
		<DropdownMenu.Label>
			<span class="block truncate">{user.name}</span>
			<small class="text-muted-foreground"
				>{user.isAdministrator ? 'Administrator' : 'Jellyfin user'}</small
			>
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a href={resolve('/profile')} {...props}>
						<UserIcon />
						Profile
					</a>
				{/snippet}
			</DropdownMenu.Item>
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a href={resolve('/settings')} {...props}>
						<SettingsIcon />
						Settings
					</a>
				{/snippet}
			</DropdownMenu.Item>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item onclick={() => void onLogout()}>
				<LogOutIcon />
				Sign out
			</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
