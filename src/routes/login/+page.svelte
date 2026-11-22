<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

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
			error = res.status === 429 ? 'Too many attempts. Try again later.' : (body?.error?.message ?? 'Sign in failed.');
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

<main class="grid h-full place-items-center px-6">
	<form class="w-[320px]" onsubmit={submit}>
		<h1 class="text-xl">last30days-news</h1>
		<p class="mt-1 text-txt-3">Enter your password.</p>

		<label class="mt-6 block text-txt-2" for="password">Password</label>
		<input
			id="password"
			name="password"
			type="password"
			autocomplete="current-password"
			required
			bind:value={password}
			class="mt-1 w-full rounded-[6px] border border-line-2 bg-raise px-2 py-1.5 outline-none"
		/>

		{#if error}
			<p class="mt-3 text-txt-2" role="alert">{error}</p>
		{/if}

		<button
			type="submit"
			disabled={busy}
			class="mt-5 w-full rounded-[6px] bg-accent px-3 py-1.5 font-medium text-accent-on disabled:opacity-60"
		>
			{busy ? 'Signing in...' : 'Sign in'}
		</button>

		<p class="mt-4 text-txt-3">
			Forgot it? <a class="text-accent" href={resolve('/reset')}>Reset the app</a>.
		</p>
	</form>
</main>
