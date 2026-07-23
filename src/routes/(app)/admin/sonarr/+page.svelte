<script lang="ts">
	import AdminHeading from '../admin-heading.svelte';
	import ServarrInstances from '../servarr-instances.svelte';
</script>

<AdminHeading
	title="Sonarr"
	description="Named read-only queue sources for episodic download progress."
/>
<ServarrInstances service="sonarr" />
