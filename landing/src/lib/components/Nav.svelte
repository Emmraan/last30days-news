<script lang="ts">
	import { REPO_URL } from '#lib/site';
	import Logo from './Logo.svelte';

	const LINKS = [
		{ id: 'how', label: 'How it works' },
		{ id: 'what-you-get', label: 'What you get' },
		{ id: 'sources', label: 'Sources' },
		{ id: 'faq', label: 'FAQ' }
	];
</script>

<header class="nav">
	<div class="wrap row">
		<button class="brand" type="button" data-scroll="top" aria-label="Back to top">
			<Logo />
			<span class="wordmark">last30days-news</span>
		</button>

		<nav class="links" aria-label="Sections">
			{#each LINKS as link (link.id)}
				<button class="nav-link" type="button" data-scroll={link.id}>{link.label}</button>
			{/each}
		</nav>

		<div class="right">
			<button
				id="theme-toggle"
				class="iconbtn"
				type="button"
				aria-label="Toggle light or dark theme"
				title="Toggle light or dark theme"
			>
				<svg
					class="i-moon"
					viewBox="0 0 24 24"
					width="15"
					height="15"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M21 12.8A8.6 8.6 0 1 1 11.2 3a6.7 6.7 0 0 0 9.8 9.8Z" />
				</svg>
				<svg
					class="i-sun"
					viewBox="0 0 24 24"
					width="15"
					height="15"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2" />
				</svg>
			</button>

			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external repo, not an app route -->
			<a class="pill accent gh" href={REPO_URL} aria-label="View on GitHub">
				<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
					<path
						d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
					/>
				</svg>
				<span class="gh-text">View on GitHub</span>
			</a>

			<details class="menu">
				<summary class="menu-btn">
					<span class="sr-only">Sections</span>
					<svg
						class="bars"
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="M4 7h16M4 12h16M4 17h16" />
					</svg>
					<svg
						class="cross"
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="m6 6 12 12M18 6 6 18" />
					</svg>
				</summary>

				<nav class="menu-panel" aria-label="Sections">
					<p class="menu-label" aria-hidden="true">Sections</p>
					{#each LINKS as link (link.id)}
						<button class="menu-link" type="button" data-scroll={link.id}>{link.label}</button>
					{/each}
				</nav>
			</details>
		</div>
	</div>
</header>

<style>
	.nav {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--side);
		box-shadow: inset 0 -1px 0 var(--line);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 26px;
		height: 60px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
		flex: none;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--txt);
		font: inherit;
		cursor: pointer;
	}

	.brand:hover {
		opacity: 0.82;
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.links {
		display: flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}

	.nav-link {
		height: 30px;
		padding: 0 10px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--txt-2);
		font: inherit;
		font-size: 13px;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 110ms var(--ease, ease),
			color 110ms var(--ease, ease);
	}

	.nav-link:hover {
		background: var(--hover);
		color: var(--txt);
	}

	.right {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: none;
		margin-left: auto;
	}

	.right .pill {
		height: 34px;
		padding: 0 14px;
		font-size: 13px;
	}

	.gh {
		gap: 7px;
	}

	.gh svg {
		flex: none;
		opacity: 0.92;
	}

	.iconbtn {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--txt-2);
		cursor: pointer;
	}

	.iconbtn:hover {
		background: var(--hover);
		color: var(--txt);
	}

	.i-moon {
		animation: icon-in 0.2s var(--ease);
	}

	.i-sun {
		display: none;
	}

	:global(:root.dark) .i-sun {
		display: block;
		animation: icon-in 0.2s var(--ease);
	}

	:global(:root.dark) .i-moon {
		display: none;
	}

	@keyframes icon-in {
		from {
			opacity: 0;
			transform: rotate(-18deg) scale(0.92);
		}

		to {
			opacity: 1;
			transform: none;
		}
	}

	.menu {
		position: relative;
		display: none;
	}

	.menu-btn {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		color: var(--txt-2);
		cursor: pointer;
		list-style: none;
	}

	.menu-btn::-webkit-details-marker {
		display: none;
	}

	.menu-btn:hover,
	.menu[open] .menu-btn {
		background: var(--hover);
		color: var(--txt);
	}

	.cross {
		display: none;
	}

	.menu[open] .bars {
		display: none;
	}

	.menu[open] .cross {
		display: block;
	}

	.menu-panel {
		position: absolute;
		top: calc(100% + 12px);
		right: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 230px;
		max-width: calc(100vw - 36px);
		padding: 6px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--card);
		box-shadow: 0 18px 44px rgb(0 0 0 / 0.22);
	}

	.menu[open] .menu-panel {
		animation: menu-in 0.16s var(--ease) both;
	}

	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.985);
		}

		to {
			opacity: 1;
			transform: none;
		}
	}

	.menu-label {
		padding: 6px 10px 4px;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.menu-link {
		height: 36px;
		padding: 0 10px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--txt-2);
		font: inherit;
		font-size: 13.5px;
		text-align: left;
		cursor: pointer;
	}

	.menu-link:hover {
		background: var(--hover);
		color: var(--txt);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 900px) {
		.links {
			display: none;
		}

		.menu {
			display: block;
		}
	}

	@media (max-width: 520px) {
		.row {
			gap: 14px;
		}

		.right {
			gap: 8px;
		}

		.right .gh {
			position: relative;
			display: block;
			width: 34px;
			padding: 0;
		}

		/* Absolute centering keeps the mark dead centre regardless of the hidden label. */
		.right .gh svg {
			position: absolute;
			inset: 0;
			margin: auto;
			width: 16px;
			height: 16px;
		}

		.gh-text {
			display: none;
		}
	}
</style>
