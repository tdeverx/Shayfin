<script lang="ts">
	import AdminHeading from '../admin-heading.svelte';
	import ServarrInstances from '../servarr-instances.svelte';
</script>

<AdminHeading
	title="Radarr"
	description="Named read-only queue sources for movie download progress."
/>
<ServarrInstances service="radarr" />
