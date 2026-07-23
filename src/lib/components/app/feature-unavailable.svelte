<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Empty from '$lib/components/ui/empty';
	import { Button } from '$lib/components/ui/button';
	let {
		title = 'This feature is unavailable',
		description = 'An administrator has not enabled the plugin that provides this feature.'
	}: { title?: string; description?: string } = $props();
</script>

<Empty.Root class="min-h-[24rem] border border-border"
	><Empty.Header
		><Empty.Title>{title}</Empty.Title><Empty.Description>{description}</Empty.Description
		></Empty.Header
	><Empty.Content
		><Button href={resolve('/home')} variant="outline">Back home</Button></Empty.Content
	></Empty.Root
>
