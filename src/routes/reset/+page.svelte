<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let confirm = $state('');
	let next = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		busy = true;
		try {
			const res = await fetch('/api/auth/reset', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ confirm, next })
			});
			if (res.ok) {
				await goto(resolve('/login'), { invalidateAll: true });
				return;
			}
			const body = await res.json().catch(() => null);
			error =
				res.status === 429
					? 'Too many attempts. Try again later.'
					: (body?.error?.message ?? 'Reset failed.');
		} catch {
			error = 'Cannot reach the server.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Reset - last30days-news</title>
</svelte:head>

<main class="grid h-full place-items-center px-6">
	{#if data.canReset}
		<form class="w-[360px]" onsubmit={submit}>
		<h1 class="text-xl">Reset the app</h1>
		<p class="mt-1 text-txt-2">
			This deletes the password, the saved API keys and every signed-in session. Items, sources and
			categories stay.
		</p>

		<label class="mt-6 block text-txt-2" for="confirm">
			Type <span class="font-mono text-txt">reset</span> to continue
		</label>
		<input
			id="confirm"
			name="confirm"
			type="text"
			autocomplete="off"
			required
			bind:value={confirm}
			class="mt-1 w-full rounded-[6px] border border-line-2 bg-raise px-2 py-1.5 outline-none"
		/>

		<label class="mt-4 block text-txt-2" for="next">New password</label>
		<input
			id="next"
			name="next"
			type="password"
			autocomplete="new-password"
			minlength="8"
			required
			bind:value={next}
			class="mt-1 w-full rounded-[6px] border border-line-2 bg-raise px-2 py-1.5 outline-none"
		/>
		<p class="mt-1 text-txt-3">At least 8 characters.</p>

		{#if error}
			<p class="mt-3 text-txt-2" role="alert">{error}</p>
		{/if}

		<button
			type="submit"
			disabled={busy || confirm !== 'reset'}
			class="mt-5 w-full rounded-[6px] bg-accent px-3 py-1.5 font-medium text-accent-on disabled:opacity-60"
		>
			{busy ? 'Resetting...' : 'Reset'}
		</button>

		<p class="mt-4 text-txt-3"><a class="text-accent" href={resolve('/login')}>Back to sign in</a></p>
		</form>
	{:else}
		<div class="w-[360px]">
			<h1 class="text-xl">Reset the app</h1>
			<p class="mt-2 text-txt-2">Password reset is not available here.</p>
			<p class="mt-4 text-txt-3">
				<a class="text-accent" href={resolve('/login')}>Back to sign in</a>
			</p>
		</div>
	{/if}
</main>
