<script lang="ts">
	import { onMount } from 'svelte';
	import { X } from 'lucide-svelte';
	import { THEME_COOKIE, type Theme } from '#lib/theme';
	import Dropdown from './Dropdown.svelte';
	import PasswordForm from './PasswordForm.svelte';

	let {
		mustChangePassword = false,
		onpasswordchanged,
		onclose
	}: {
		mustChangePassword?: boolean;
		onpasswordchanged?: () => void;
		onclose: () => void;
	} = $props();

	type Row = {
		id: string;
		enabled: boolean;
		model: string;
		baseUrl: string;
		keyConfigured: boolean;
	};

	let rows = $state<Row[]>([]);
	let ids = $state<string[]>([]);
	let theme = $state<Theme | null>(null);
	let error = $state('');
	let busy = $state(false);
	let passwordDone = $state(false);

	// Per-provider key text and per-provider status lines, keyed by id so a
	// reload of one row does not reset another row's form.
	let keyText = $state<Record<string, string>>({});
	let status = $state<Record<string, string>>({});
	let testing = $state<string | null>(null);

	async function load() {
		try {
			const res = await fetch('/api/settings');
			if (!res.ok) {
				error = 'Could not load settings.';
				return;
			}
			const body = (await res.json()) as { theme: Theme | null; ids: string[]; providers: Row[] };
			rows = body.providers;
			ids = body.ids;
			theme = body.theme;
		} catch {
			error = 'Could not load settings.';
		}
	}

	onMount(() => {
		const root = document.documentElement;
		theme = root.classList.contains('light') ? 'light' : 'dark';
		// §S9 blocks every API except the password change until a real password
		// is stored, so the provider list would only render as an error.
		if (!mustChangePassword) void load();
	});

	function payload() {
		return rows
			.filter((row) => row.model.trim())
			.map((row) => ({
				id: row.id,
				model: row.model.trim(),
				baseUrl: row.baseUrl.trim() || null,
				enabled: row.enabled
			}));
	}

	async function patch(body: unknown) {
		const res = await fetch('/api/settings', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = (await res.json().catch(() => null)) as {
			providers?: Row[];
			error?: { code?: string; message?: string };
		} | null;
		if (!res.ok) {
			error =
				data?.error?.code === 'ai_locked'
					? 'Sign in again to unlock AI keys.'
					: (data?.error?.message ?? 'Could not save the settings.');
			return null;
		}
		if (data?.providers) rows = data.providers;
		return data;
	}

	async function saveProvider(id: string) {
		const row = rows.find((entry) => entry.id === id);
		if (!row) return;
		if (!row.model.trim()) {
			error = 'Enter a model name first.';
			return;
		}
		busy = true;
		error = '';
		status = { ...status, [id]: '' };
		try {
			const key = (keyText[id] ?? '').trim();
			const data = await patch({
				providers: payload(),
				...(key ? { keys: [{ id, key }] } : {})
			});
			if (data) {
				keyText = { ...keyText, [id]: '' };
				status = { ...status, [id]: 'Saved.' };
			}
		} finally {
			busy = false;
		}
	}

	async function clearKey(id: string) {
		busy = true;
		error = '';
		try {
			const data = await patch({ keys: [{ id, key: null }] });
			if (data) status = { ...status, [id]: 'Key removed.' };
		} finally {
			busy = false;
		}
	}

	async function testProvider(id: string) {
		const row = rows.find((entry) => entry.id === id);
		if (!row) return;
		testing = id;
		status = { ...status, [id]: 'Testing…' };
		try {
			const key = (keyText[id] ?? '').trim();
			const res = await fetch('/api/settings/ai/test', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					provider: id,
					model: row.model.trim(),
					baseUrl: row.baseUrl.trim() || undefined,
					...(key ? { apiKey: key } : {})
				})
			});
			status = {
				...status,
				[id]: res.ok ? 'The provider answered.' : 'The provider did not answer.'
			};
		} catch {
			status = { ...status, [id]: 'The provider did not answer.' };
		} finally {
			testing = null;
		}
	}

	async function chooseTheme(next: Theme) {
		if (next === theme) return;
		const previous = theme;
		theme = next;
		applyTheme(next);
		const data = await patch({ theme: next });
		if (!data) theme = previous;
	}

	function applyTheme(next: Theme) {
		if (typeof document === 'undefined') return;
		document.documentElement.classList.remove('dark', 'light');
		document.documentElement.classList.add(next);
		const secure = location.protocol === 'https:' ? '; secure' : '';
		document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax${secure}`;
	}

	function toggleEnabled(id: string) {
		rows = rows.map((row) => (row.id === id ? { ...row, enabled: !row.enabled } : row));
	}

	function addProvider(id: string) {
		if (!id || rows.some((row) => row.id === id)) return;
		rows = [...rows, { id, enabled: true, model: '', baseUrl: '', keyConfigured: false }];
	}

	const available = $derived(ids.filter((id) => !rows.some((row) => row.id === id)));
	const providerOptions = $derived(available.map((id) => ({ value: id, label: id })));
</script>

<div class="scrim" role="presentation" onclick={onclose} onkeydown={() => undefined}></div>
<section class="panel" aria-label="Settings">
	<header class="head">
		<h2>Settings</h2>
		<button class="iconbtn" type="button" aria-label="Close" onclick={onclose}>
			<X size={14} aria-hidden="true" />
		</button>
	</header>

	<div class="scroll">
		{#if error}
			<p class="err" role="alert">{error}</p>
		{/if}

		{#if mustChangePassword}
			<p class="warn" role="status">
				The first-run password is still in place. Set your own before using the app.
			</p>
		{/if}

		<section class="block">
			<h3>Theme</h3>
			<div class="seg" role="group" aria-label="Theme">
				<button
					type="button"
					aria-pressed={theme === 'dark'}
					disabled={mustChangePassword}
					onclick={() => void chooseTheme('dark')}
				>
					Dark
				</button>
				<button
					type="button"
					aria-pressed={theme === 'light'}
					disabled={mustChangePassword}
					onclick={() => void chooseTheme('light')}
				>
					Light
				</button>
			</div>
		</section>

		<section class="block">
			<h3>Password</h3>
			{#if passwordDone}
				<p class="ok">Password changed. Saved API keys were re-encrypted.</p>
			{/if}
			<PasswordForm
				onsuccess={() => {
					passwordDone = true;
					// The API unblocks once a real password is stored, so the
					// provider list can load now.
					if (mustChangePassword) void load();
					onpasswordchanged?.();
				}}
			/>
			<p class="meta">
				Resetting the app deletes the password, every saved API key and all sessions. Items, sources
				and categories stay.
			</p>
		</section>

		<section class="block">
			<h3>AI providers</h3>

			{#if !rows.length}
				<p class="meta">No provider is configured yet. Add one below.</p>
			{/if}

			<ul class="list">
				{#each rows as row (row.id)}
					<li class="row">
						<div class="row-main">
							<span class="label">{row.id}</span>
							<label class="check">
								<input
									type="checkbox"
									checked={row.enabled}
									onchange={() => toggleEnabled(row.id)}
								/>
								<span>Enabled</span>
							</label>
						</div>

						<label class="field">
							<span>Model</span>
							<input class="text" type="text" bind:value={row.model} maxlength={200} />
						</label>

						<label class="field">
							<span>Base URL</span>
							<input
								class="text"
								type="text"
								bind:value={row.baseUrl}
								maxlength={2048}
								placeholder="Default"
							/>
						</label>

						<label class="field">
							<span>
								API key
								{#if row.keyConfigured}
									<span class="tag">Saved</span>
								{/if}
							</span>
							<input
								class="text"
								type="password"
								autocomplete="off"
								bind:value={keyText[row.id]}
								placeholder={row.keyConfigured ? 'Saved key in place' : 'Not set'}
							/>
						</label>

						<div class="row-actions">
							<button
								class="btn small"
								type="button"
								disabled={busy}
								onclick={() => void saveProvider(row.id)}
							>
								Save
							</button>
							<button
								class="btn small"
								type="button"
								disabled={busy || testing === row.id}
								onclick={() => void testProvider(row.id)}
							>
								Test
							</button>
							{#if row.keyConfigured}
								<button
									class="btn small danger"
									type="button"
									disabled={busy}
									onclick={() => void clearKey(row.id)}
								>
									Clear key
								</button>
							{/if}
						</div>

						{#if status[row.id]}
							<p class="meta">{status[row.id]}</p>
						{/if}
					</li>
				{/each}
			</ul>

			{#if available.length}
				<div class="field add">
					<span>Add provider</span>
					<Dropdown
						label="Add provider"
						value=""
						placeholder="Choose…"
						options={providerOptions}
						onchange={addProvider}
					/>
				</div>
			{/if}
		</section>
	</div>
</section>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: rgb(0 0 0 / 0.28);
		animation: scrim-in 140ms var(--ease) both;
	}

	.panel {
		position: fixed;
		z-index: 21;
		top: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		width: min(500px, 100vw);
		border-left: 1px solid var(--line);
		background: var(--pane);
		box-shadow: -12px 0 36px rgb(0 0 0 / 0.22);
		animation: panel-in 180ms var(--ease) both;
	}

	.head {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		height: 52px;
		padding: 0 10px 0 18px;
		box-shadow: inset 0 -1px 0 var(--line);
	}

	.head h2 {
		font-family: var(--font-sans);
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--txt-3);
	}

	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 14px 18px 28px;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 22px;
	}

	.block:first-child {
		margin-top: 0;
	}

	.block h3 {
		font-family: var(--font-sans);
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--txt-3);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 0;
		box-shadow: inset 0 -1px 0 var(--line);
	}

	.row-main {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 28px;
	}

	.label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--txt);
		font-size: 13.5px;
	}

	.tag {
		margin-left: 6px;
		color: var(--txt-3);
		font-size: 11.5px;
	}

	.check {
		display: flex;
		flex: none;
		align-items: center;
		gap: 6px;
		color: var(--txt-2);
		font-size: 12.5px;
	}

	.row-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.btn.small {
		height: 30px;
		padding: 0 10px;
		font-size: 12.5px;
	}

	.btn.danger {
		border-color: color-mix(in srgb, var(--warn) 45%, var(--line));
		color: var(--warn);
	}

	.text {
		width: 100%;
		min-width: 0;
		height: 34px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--card);
		color: var(--txt);
		font: inherit;
		font-size: 13.5px;
		transition:
			border-color 110ms var(--ease),
			box-shadow 110ms var(--ease);
	}

	.text:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
	}

	.field > span {
		color: var(--txt-2);
		font-size: 12.5px;
	}

	.add {
		margin-top: 14px;
	}

	.err,
	.warn,
	.ok,
	.meta {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.5;
	}

	.err,
	.warn {
		color: var(--warn);
	}

	.ok {
		color: var(--ok);
	}

	.meta {
		color: var(--txt-3);
	}

	@keyframes scrim-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes panel-in {
		from {
			transform: translateX(12px);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}
</style>
