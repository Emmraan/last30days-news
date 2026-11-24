<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { CircleHelp, LogOut, RefreshCw, Search, Settings, SunMoon } from 'lucide-svelte';
	import { THEME_COOKIE, THEME_STORAGE_KEY } from '#lib/theme';
	import { PRESETS, type Preset } from '#lib/util/time';
	import Logo from './Logo.svelte';

	let {
		preset,
		onpreset,
		onrefresh,
		refreshing,
		query,
		onquery,
		onsettings,
		onhelp
	}: {
		preset: Preset;
		onpreset: (preset: Preset) => void;
		onrefresh: () => void;
		refreshing: boolean;
		query: string;
		onquery: (value: string) => void;
		onsettings: () => void;
		onhelp: () => void;
	} = $props();

	// The hint follows the platform without making SSR guess; Windows is the
	// default and the value settles after hydration.
	let mac = $state(false);
	let signingOut = $state(false);
	onMount(() => {
		mac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
	});

	async function signOut() {
		if (signingOut) return;
		signingOut = true;
		try {
			const response = await fetch('/api/auth/logout', { method: 'POST' });
			if (!response.ok) throw new Error('logout failed');
			location.assign(resolve('/login'));
		} catch {
			// Keep the reader in the app when the session could not be ended.
			signingOut = false;
		}
	}

	function toggleTheme() {
		const root = document.documentElement;
		const current = root.classList.contains('light')
			? 'light'
			: root.classList.contains('dark')
				? 'dark'
				: window.matchMedia('(prefers-color-scheme: light)').matches
					? 'light'
					: 'dark';
		const next = current === 'dark' ? 'light' : 'dark';

		root.classList.remove('dark', 'light');
		root.classList.add(next);
		try {
			localStorage.setItem(THEME_STORAGE_KEY, next);
		} catch {
			// Private modes can refuse storage; the cookie below still carries it.
		}
		const secure = location.protocol === 'https:' ? '; secure' : '';
		document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax${secure}`;
	}
</script>

<header class="topbar">
	<a class="brand" href={resolve('/app')}>
		<Logo />
		<span class="wordmark">last30days-news</span>
	</a>

	<div class="search" role="search">
		<Search size={15} aria-hidden="true" />
		<input
			type="search"
			placeholder="Search items"
			aria-label="Search items"
			aria-keyshortcuts="Control+K Meta+K"
			value={query}
			oninput={(event) => onquery(event.currentTarget.value)}
		/>
		<kbd class="keyhint" aria-hidden="true">{mac ? '⌘ K' : 'Ctrl K'}</kbd>
	</div>

	<div class="seg" role="group" aria-label="Time range">
		{#each PRESETS as option (option)}
			<button type="button" aria-pressed={preset === option} onclick={() => onpreset(option)}>
				{option}
			</button>
		{/each}
	</div>

	<div class="actions">
		<button
			class="iconbtn"
			type="button"
			aria-label="Refresh feed"
			title="Refresh feed"
			disabled={refreshing}
			aria-busy={refreshing}
			onclick={onrefresh}
		>
			<span class="spin" class:on={refreshing}><RefreshCw size={17} aria-hidden="true" /></span>
		</button>
		<button
			class="iconbtn"
			type="button"
			aria-label="Keyboard shortcuts"
			title="Keyboard shortcuts (?)"
			onclick={onhelp}
		>
			<CircleHelp size={17} aria-hidden="true" />
		</button>
		<button
			class="iconbtn"
			type="button"
			aria-label="Open settings"
			title="Open settings"
			onclick={onsettings}
		>
			<Settings size={17} aria-hidden="true" />
		</button>
		<button
			class="iconbtn"
			type="button"
			aria-label="Toggle light or dark theme"
			title="Toggle light or dark theme"
			onclick={toggleTheme}
		>
			<SunMoon size={17} aria-hidden="true" />
		</button>
		<span class="divider" aria-hidden="true"></span>
		<button
			class="iconbtn signout"
			type="button"
			aria-label="Log out"
			title="Log out"
			disabled={signingOut}
			onclick={signOut}
		>
			<LogOut size={17} aria-hidden="true" />
		</button>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		align-items: center;
		gap: 14px;
		height: var(--h-top);
		min-width: 0;
		padding: 0 18px;
		background: var(--bg);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: 14.5px;
		font-weight: 600;
		letter-spacing: -0.015em;
		white-space: nowrap;
	}

	.search {
		flex: 0 1 480px;
		min-width: 0;
		margin-left: 6px;
		display: flex;
		align-items: center;
		gap: 9px;
		height: 40px;
		padding: 0 9px 0 13px;
		border: 1px solid var(--line-2);
		border-radius: 10px;
		background: var(--card);
		color: var(--txt-3);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
		transition:
			border-color 130ms var(--ease),
			box-shadow 130ms var(--ease),
			background-color 130ms var(--ease);
	}

	.search:hover {
		border-color: color-mix(in srgb, var(--txt-3) 55%, var(--line-2));
	}

	.search:focus-within {
		border-color: var(--accent);
		background: var(--card);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	.search input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: none;
		color: var(--txt);
		font: inherit;
		font-size: 13.5px;
		outline: none;
	}

	.search input::placeholder {
		color: var(--txt-3);
	}

	.keyhint {
		display: inline-flex;
		align-items: center;
		flex: none;
		height: 21px;
		padding: 0 5px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: var(--raise);
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1;
		white-space: nowrap;
		transition: opacity 130ms var(--ease);
	}

	.search:focus-within .keyhint {
		opacity: 0.45;
	}

	/* The shared segmented control is square; on the toolbar it reads wider. */
	.seg {
		height: 40px;
		padding: 3px;
		border: 0;
		border-radius: 10px;
		background: var(--raise);
	}

	.seg > button {
		height: 32px;
		padding: 0 15px;
		border-radius: 7px;
		font-size: 13px;
	}

	.seg > button[aria-pressed='true'] {
		background: var(--card);
		color: var(--txt);
		box-shadow: 0 0 0 1px var(--line);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 5px;
		flex: none;
		margin-left: auto;
	}

	.iconbtn {
		width: 36px;
		height: 36px;
		border-radius: 10px;
	}

	.divider {
		width: 1px;
		height: 20px;
		margin: 0 3px;
		background: var(--line);
	}

	.signout:hover {
		color: var(--warn);
	}

	.spin {
		display: inline-grid;
		place-items: center;
	}

	.spin.on {
		animation: spin 900ms linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 1080px) {
		.wordmark {
			display: none;
		}

		.search {
			flex: 1 1 auto;
			margin-left: 0;
		}
	}

	@media (max-width: 760px) {
		.topbar {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'brand actions'
				'search search'
				'seg seg';
			gap: 10px 12px;
			height: auto;
			padding: 10px 12px;
		}

		.brand {
			grid-area: brand;
		}

		.search {
			grid-area: search;
			flex: none;
			width: 100%;
			margin: 0;
		}

		.seg {
			display: flex;
			grid-area: seg;
			width: 100%;
		}

		.seg > button {
			flex: 1;
			min-width: 0;
			padding: 0 6px;
		}

		.actions {
			grid-area: actions;
			gap: 2px;
			margin-left: 0;
		}

		.iconbtn {
			width: 34px;
			height: 34px;
		}

		.search input {
			/* iOS zooms the page when a focused field is under 16px. */
			font-size: 16px;
		}

		.divider {
			display: none;
		}
	}

	@media (max-width: 720px) {
		.keyhint {
			display: none;
		}
	}
</style>
