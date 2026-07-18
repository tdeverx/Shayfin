<script lang="ts">
	import type { Component } from 'svelte';
	import { mergeProps } from 'bits-ui';
	import { Button, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	interface Props {
		label: string;
		icon: Component;
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
		pressed?: boolean;
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
	}

	let {
		label,
		icon: Icon,
		onclick,
		disabled = false,
		pressed,
		variant = 'secondary',
		size = 'icon',
		class: className
	}: Props = $props();
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			{@const buttonProps = mergeProps(props, {
				'aria-label': label,
				'aria-pressed': pressed,
				onclick
			})}
			<Button {...buttonProps} {variant} {size} {disabled} class={className}>
				<Icon />
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content sideOffset={6}>{label}</Tooltip.Content>
</Tooltip.Root>
