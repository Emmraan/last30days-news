<script lang="ts">
	import { resolve } from '$app/paths';
	import { RefreshCw, Search, Settings, SunMoon } from 'lucide-svelte';
	import { THEME_COOKIE } from '#lib/theme';
	import { PRESETS, type Preset } from '#lib/util/time';
	import Logo from './Logo.svelte';

	let {
		preset,
		onpreset,
		onrefresh,
		refreshing,
		query,
		onquery,
		onsettings
	}: {
		preset: Preset;
		onpreset: (preset: Preset) => void;
		onrefresh: () => void;
		refreshing: boolean;
		query: string;
		onquery: (value: string) => void;
		onsettings: () => void;
	} = $props();

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
		<Search size={14} aria-hidden="true" />
		<input
			type="search"
			placeholder="Search items"
			aria-label="Search items"
			value={query}
			oninput={(event) => onquery(event.currentTarget.value)}
		/>
	</div>

	<div class="seg" role="group" aria-label="Time range">
		{#each PRESETS as option (option)}
			<button
				type="button"
				aria-pressed={preset === option}
				onclick={() => onpreset(option)}
			>{option}</button>
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
			<RefreshCw size={15} aria-hidden="true" />
		</button>
		<button
			class="iconbtn"
			type="button"
			aria-label="Open settings"
			title="Open settings"
			onclick={onsettings}
		>
			<Settings size={15} aria-hidden="true" />
		</button>
		<button
			class="iconbtn"
			type="button"
			aria-label="Toggle light or dark theme"
			title="Toggle light or dark theme"
			onclick={toggleTheme}
		>
			<SunMoon size={15} aria-hidden="true" />
		</button>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		align-items: center;
		gap: 10px;
		height: var(--h-top);
		min-width: 0;
		padding: 0 12px;
		background: var(--bg);
		box-shadow: 0 1px 0 var(--line);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}

	.search {
		flex: 0 1 400px;
		min-width: 0;
		margin-left: 4px;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: none;
		margin-left: auto;
	}

	@media (max-width: 940px) {
		.wordmark {
			display: none;
		}

		.search {
			flex: 1 1 auto;
			margin-left: 0;
		}
	}

	@media (max-width: 720px) {
		.seg {
			display: none;
		}
	}
</style>
