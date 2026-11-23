<script lang="ts">
	import { LOGO_GLYPH } from '#lib/logo';
</script>

<span class="logo" aria-hidden="true">
	<svg viewBox="0 0 24 24" focusable="false">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- fixed glyph, never user input -->
		{@html LOGO_GLYPH}
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
		background: linear-gradient(
			150deg,
			var(--accent),
			color-mix(in srgb, var(--accent) 45%, #7b61ff)
		);
		color: var(--accent-on);
	}

	.logo svg {
		display: block;
		width: 19px;
		height: 19px;
	}
</style>
