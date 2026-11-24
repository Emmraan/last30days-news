<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Logo from '#lib/components/Logo.svelte';
	import { REPO_URL } from '#lib/site';

	let { children } = $props();

	const GROUPS = [
		{
			label: 'Get started',
			links: [
				{ href: '/docs', label: 'Overview' },
				{ href: '/docs/install', label: 'Install' },
				{ href: '/docs/local', label: 'Run locally' }
			]
		},
		{
			label: 'Deploy',
			links: [
				{ href: '/docs/vercel', label: 'Vercel' },
				{ href: '/docs/vps', label: 'VPS and Docker' }
			]
		},
		{
			label: 'Reference',
			links: [
				{ href: '/docs/configuration', label: 'Configuration' },
				{ href: '/docs/passwords', label: 'Passwords and recovery' },
				{ href: '/docs/troubleshooting', label: 'Troubleshooting' }
			]
		},
		{
			label: 'Project',
			links: [{ href: '/docs/development', label: 'Development' }]
		}
	];

	const active = (href: string) =>
		href === '/docs' ? page.url.pathname === '/docs' : page.url.pathname.startsWith(href);
</script>

{#snippet links()}
	<nav class="docs-links" aria-label="Documentation">
		{#each GROUPS as group (group.label)}
			<div class="docs-group">
				<p class="docs-label mono">{group.label}</p>
				{#each group.links as link (link.href)}
					<a
						href={resolve(link.href)}
						class="docs-link"
						aria-current={active(link.href) ? 'page' : undefined}
					>
						{link.label}
					</a>
				{/each}
			</div>
		{/each}
	</nav>
{/snippet}

<div class="docs-shell">
	<header class="docs-top">
		<div class="wrap docs-top-row">
			<a class="brand" href={resolve('/')} aria-label="last30days-news home">
				<Logo />
				<span class="wordmark">last30days-news</span>
			</a>
			<span class="docs-tag mono">Docs</span>
			<div class="top-right">
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
				<a class="top-link" href={resolve('/')}>Site</a>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external repo, not an app route -->
				<a class="top-link" href={REPO_URL}>GitHub</a>
			</div>
		</div>
	</header>

	<div class="wrap docs-body">
		<aside class="docs-side">
			<details class="docs-menu">
				<summary class="docs-menu-btn">Documentation</summary>
				{@render links()}
			</details>
			<div class="docs-side-links">{@render links()}</div>
		</aside>

		<main class="docs-main">
			<article class="docs-prose">
				{@render children()}
			</article>
		</main>
	</div>
</div>

<style>
	.docs-shell {
		min-height: 100vh;
		background: var(--bg);
	}

	.docs-top {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--side);
		box-shadow: inset 0 -1px 0 var(--line);
	}

	.docs-top-row {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 60px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
		color: var(--txt);
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

	.docs-tag {
		padding: 3px 7px;
		border: 1px solid var(--line-2);
		border-radius: 6px;
		color: var(--txt-3);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.top-right {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-left: auto;
	}

	.top-link {
		color: var(--txt-2);
		font-size: 13px;
	}

	.top-link:hover {
		color: var(--txt);
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

	.i-sun {
		display: none;
	}

	:global(:root.dark) .i-sun {
		display: block;
	}

	:global(:root.dark) .i-moon {
		display: none;
	}

	.docs-body {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: 56px;
		padding-top: 48px;
		padding-bottom: 96px;
	}

	.docs-side {
		position: sticky;
		top: 92px;
		align-self: start;
	}

	.docs-menu {
		display: none;
	}

	.docs-links {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.docs-group {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.docs-label {
		margin: 0 0 5px 10px;
		color: var(--txt-3);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.docs-link {
		padding: 6px 10px;
		border-radius: 7px;
		color: var(--txt-2);
		font-size: 13.5px;
		line-height: 1.35;
	}

	.docs-link:hover {
		background: var(--hover);
		color: var(--txt);
	}

	.docs-link[aria-current='page'] {
		background: var(--card);
		box-shadow: inset 0 0 0 1px var(--line);
		color: var(--txt);
		font-weight: 500;
	}

	.docs-main {
		min-width: 0;
	}

	@media (max-width: 860px) {
		.docs-body {
			grid-template-columns: minmax(0, 1fr);
			gap: 24px;
			padding-top: 24px;
			padding-bottom: 64px;
		}

		.docs-side {
			position: static;
		}

		.docs-side-links {
			display: none;
		}

		.docs-menu {
			display: block;
			border: 1px solid var(--line);
			border-radius: 10px;
			background: var(--card);
		}

		.docs-menu-btn {
			padding: 11px 14px;
			color: var(--txt-2);
			font-size: 13px;
			cursor: pointer;
			list-style: none;
		}

		.docs-menu-btn::-webkit-details-marker {
			display: none;
		}

		.docs-menu[open] .docs-menu-btn {
			border-bottom: 1px solid var(--line);
		}

		.docs-menu .docs-links {
			padding: 10px;
		}
	}

	@media (max-width: 520px) {
		.docs-tag,
		.top-link {
			display: none;
		}
	}
</style>
