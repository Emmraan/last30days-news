<script lang="ts">
	// Same mark as the app; the two packages ship separately.
	const GLYPH = [
		'<circle cx="12" cy="12" r="8.7" stroke="currentColor" stroke-width="1.5" fill="none" opacity=".3"/>',
		'<circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5" fill="none" opacity=".5"/>',
		'<path d="M12 12 12 3.3A8.7 8.7 0 0 1 20.7 12Z" fill="currentColor" opacity=".92"/>',
		'<circle cx="12" cy="12" r="1.9" fill="currentColor"/>'
	].join('');
</script>

<span class="logo" aria-hidden="true">
	<svg viewBox="0 0 24 24" focusable="false">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- fixed glyph, never user input -->
		{@html GLYPH}
	</svg>
</span>

<style>
	.logo {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 9px;
		background: var(--accent);
		color: var(--accent-on);
	}

	.logo svg {
		display: block;
		width: 19px;
		height: 19px;
	}
</style>
