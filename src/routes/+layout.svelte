<script lang="ts">
	import { FAVICON_DATA_URI } from '#lib/logo';
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={FAVICON_DATA_URI} />
</svelte:head>

{@render children()}
