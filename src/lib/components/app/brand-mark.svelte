<script lang="ts">
	let { compact = false }: { compact?: boolean } = $props();
</script>

<span class="flex items-center gap-2" aria-label="Shayfin">
	<svg
		viewBox="0 0 32 32"
		role="img"
		aria-hidden="true"
		class="size-8 shrink-0 text-current"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linejoin="round"
	>
		<path d="M16 2.5 27.7 9v14L16 29.5 4.3 23V9L16 2.5Z" />
		<path d="m16 2.5 5.9 10.1-5.9 3.5-5.9-3.5L16 2.5Z" />
		<path d="m4.3 9 5.8 3.6v6.8L4.3 23M27.7 9l-5.8 3.6v6.8l5.8 3.6" />
		<path d="m10.1 19.4 5.9-3.3 5.9 3.3L16 29.5l-5.9-10.1Z" />
	</svg>
	{#if !compact}
		<span class="text-base font-semibold tracking-tight">Shayfin</span>
	{/if}
</span>
