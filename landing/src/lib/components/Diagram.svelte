<script lang="ts">
	import dashboard from '../../../../docs/assets/dashboard.svg?url';
	import passwords from '../../../../docs/assets/passwords.svg?url';
	import runModes from '../../../../docs/assets/run-modes.svg?url';

	type Name = 'dashboard' | 'run-modes' | 'passwords';

	let { name, alt, caption }: { name: Name; alt: string; caption?: string } = $props();

	const sources: Record<Name, string> = {
		dashboard,
		'run-modes': runModes,
		passwords
	};
</script>

<figure>
	<img src={sources[name]} {alt} loading="lazy" />
	{#if caption}
		<figcaption>{caption}</figcaption>
	{/if}
</figure>
