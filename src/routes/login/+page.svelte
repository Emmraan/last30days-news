<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Logo from '#lib/components/Logo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	// Only same-origin paths, so `?next=` cannot become an open redirect.
	const next = (() => {
		const raw = page.url.searchParams.get('next') ?? '/app';
		return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/app';
	})();

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		busy = true;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password })
			});
			if (res.ok) {
				const body = await res.json();
				const target = new URL(body.mustChangePassword ? '/app?change=1' : next, page.url.origin);
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- `?next=` is a runtime path; resolve() only accepts literals
				await goto(target, { invalidateAll: true });
				return;
			}
			const body = await res.json().catch(() => null);
			error =
				res.status === 429
					? 'Too many attempts. Try again later.'
					: (body?.error?.message ?? 'Sign in failed.');
		} catch {
			error = 'Cannot reach the server.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in - last30days-news</title>
</svelte:head>

<main class="screen">
	<form class="card" onsubmit={submit}>
		<div class="brand">
			<Logo />
			<span class="wordmark">last30days-news</span>
		</div>

		<h1>Sign in</h1>
		<p class="lede">This reader is protected by one password. Enter it to open the feed.</p>

		{#if data.setupRequired}
			<p class="first-run">
				Setup is incomplete. The operator must set <code>L30_INITIAL_PASSWORD</code> and restart.
			</p>
		{:else if data.firstRun && data.canReset}
			<p class="first-run">
				First run: sign in with <code>last30</code>, then set your own password in Settings.
			</p>
		{/if}

		<label for="password">Password</label>
		<input
			id="password"
			name="password"
			type="password"
			autocomplete="current-password"
			required
			bind:value={password}
		/>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<button type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>

		{#if data.canReset}
			<p class="foot">
				Forgot it? <a href={resolve('/reset')}>Reset the app</a>. This clears the password, saved API
				keys and sessions; items and sources stay.
			</p>
		{:else}
			<p class="foot">Password reset is not available here.</p>
		{/if}
	</form>
</main>

<style>
	.screen {
		display: grid;
		place-items: center;
		height: 100vh;
		padding: 24px;
		background: var(--bg);
	}

	.card {
		width: min(372px, 100%);
		padding: 26px 26px 22px;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		background: var(--pane);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 20px;
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	h1 {
		font-size: 21px;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.lede {
		margin: 6px 0 20px;
		color: var(--txt-2);
		font-size: 13px;
		line-height: 1.5;
	}

	.first-run {
		margin: -8px 0 18px;
		padding: 9px 11px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--raise);
		color: var(--txt-2);
		font-size: 12px;
		line-height: 1.5;
	}

	.first-run code {
		color: var(--txt);
		font-family: var(--font-mono);
		font-size: 11.5px;
	}

	label {
		display: block;
		margin-bottom: 6px;
		color: var(--txt-2);
		font-size: 12px;
		font-weight: 500;
	}

	input {
		width: 100%;
		height: 38px;
		padding: 0 12px;
		border: 1px solid var(--line-2);
		border-radius: 10px;
		background: var(--raise);
		color: var(--txt);
		font: inherit;
		font-size: 13.5px;
		outline: none;
		transition:
			border-color 110ms var(--ease),
			background-color 110ms var(--ease);
	}

	input:focus {
		border-color: var(--accent);
		background: var(--card);
	}

	.error {
		margin: 10px 0 0;
		color: var(--txt);
		font-size: 12.5px;
		line-height: 1.45;
	}

	button {
		width: 100%;
		height: 38px;
		margin-top: 16px;
		border: 0;
		border-radius: 10px;
		background: var(--accent);
		color: var(--accent-on);
		font: inherit;
		font-size: 13.5px;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 110ms var(--ease);
	}

	button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent) 88%, var(--txt));
	}

	button:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.foot {
		margin: 18px 0 0;
		color: var(--txt-3);
		font-size: 12px;
		line-height: 1.5;
	}

	.foot a {
		color: var(--txt-2);
		text-decoration: underline;
		text-decoration-color: var(--line-2);
		text-underline-offset: 2px;
	}

	.foot a:hover {
		color: var(--accent);
	}
</style>
