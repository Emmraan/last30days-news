<script lang="ts">
	let { onsuccess }: { onsuccess?: () => void } = $props();

	let current = $state('');
	let next = $state('');
	let confirm = $state('');
	let error = $state('');
	let busy = $state(false);

	const canSubmit = $derived(
		current.length > 0 && next.length >= 8 && next === confirm && !busy
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;
		error = '';
		busy = true;
		try {
			const res = await fetch('/api/auth/password', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ current, next })
			});
			const body = (await res.json().catch(() => null)) as {
				error?: { code?: string };
			} | null;
			if (!res.ok) {
				error =
					res.status === 429
						? 'Too many attempts. Try again later.'
						: body?.error?.code === 'invalid_password'
							? 'The current password is not correct.'
							: body?.error?.code === 'password_unchanged'
								? 'Choose a different password.'
								: 'Could not change the password.';
				return;
			}
			current = '';
			next = '';
			confirm = '';
			onsuccess?.();
		} catch {
			error = 'Could not change the password.';
		} finally {
			busy = false;
		}
	}
</script>

<form
	onsubmit={submit}
	aria-label="Change password"
	class="pw"
>
	<label class="field">
		<span>Current password</span>
		<input
			class="text"
			type="password"
			autocomplete="current-password"
			required
			bind:value={current}
		/>
	</label>

	<label class="field">
		<span>New password</span>
		<input
			class="text"
			type="password"
			autocomplete="new-password"
			minlength="8"
			required
			bind:value={next}
		/>
	</label>

	<label class="field">
		<span>Repeat new password</span>
		<input
			class="text"
			type="password"
			autocomplete="new-password"
			minlength="8"
			required
			bind:value={confirm}
		/>
	</label>

	{#if confirm && next !== confirm}
		<p class="err" role="alert">The two new passwords do not match.</p>
	{:else if error}
		<p class="err" role="alert">{error}</p>
	{:else}
		<p class="meta">At least 8 characters. Saved API keys stay usable.</p>
	{/if}

	<div class="actions">
		<button class="btn" type="submit" disabled={!canSubmit}>
			{busy ? 'Changing…' : 'Change password'}
		</button>
	</div>
</form>

<style>
	.pw {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
	}

	.field > span {
		color: var(--txt-2);
		font-size: 12px;
	}

	.text {
		width: 100%;
		min-width: 0;
		height: 28px;
		padding: 0 8px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--card);
		color: var(--txt);
		font: inherit;
		font-size: 13px;
	}

	.text:focus {
		outline: none;
		border-color: var(--accent);
	}

	.err,
	.meta {
		margin: 0;
		font-size: 12px;
	}

	.err {
		color: var(--warn);
	}

	.meta {
		color: var(--txt-3);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}
</style>
