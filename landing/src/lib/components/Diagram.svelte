<script lang="ts">
	import dashboard from '../../../../docs/assets/dashboard.svg?raw';
	import passwords from '../../../../docs/assets/passwords.svg?raw';
	import runModes from '../../../../docs/assets/run-modes.svg?raw';

	type Name = 'dashboard' | 'run-modes' | 'passwords';

	let { name, alt, caption }: { name: Name; alt: string; caption?: string } = $props();

	const sources: Record<Name, string> = {
		dashboard,
		'run-modes': runModes,
		passwords
	};

	// Inline SVG is styled by its own document-wide rules, so keep the frame
	// labelled and let the drawing itself stay decorative.
	const drawing = $derived(
		sources[name]
			.replace(/^<\?xml[^>]*\?>\s*/, '')
			.replace('<svg ', '<svg aria-hidden="true" focusable="false" ')
	);
</script>

<figure class="diagram">
	<!-- The frame scrolls horizontally, so it needs a keyboard focus stop. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="canvas" tabindex="0" role="img" aria-label={alt}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- local build asset, not user content -->
		{@html drawing}
	</div>
	{#if caption}
		<figcaption>{caption}</figcaption>
	{/if}
</figure>

<style>
	.diagram {
		margin: 20px 0 24px;
	}

	.canvas {
		overflow-x: auto;
		overscroll-behavior-x: contain;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--card);
	}

	.canvas:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.canvas :global(svg) {
		display: block;
		width: 100%;
		min-width: 1200px;
		height: auto;
	}

	figcaption {
		margin-top: 8px;
		color: var(--txt-3);
		font-size: 12px;
	}
</style>
