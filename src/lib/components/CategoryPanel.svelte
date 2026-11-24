<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowDown, ArrowUp, X } from 'lucide-svelte';
	import { moveCategory, parseKeywords, takeScoreEvents } from '#lib/category-panel';
	import { displayText } from '#lib/format';
	import type { CategoryView } from '#lib/server/categories/store';
	import Dropdown from './Dropdown.svelte';

	let {
		categories,
		onchange,
		onclose
	}: {
		categories: CategoryView[];
		onchange: (rows: CategoryView[]) => void;
		onclose: () => void;
	} = $props();

	type SourceRow = { id: string; name: string; url: string; category: string; enabled: boolean };

	let sources = $state<SourceRow[]>([]);
	let error = $state('');
	let busy = $state(false);

	let name = $state('');
	let matchMode = $state<'keywords' | 'ai' | 'both'>('keywords');
	let keywordText = $state('');
	let prompt = $state('');
	let threshold = $state(0.6);
	let pickedSources = $state<string[]>([]);

	let feedUrl = $state('');
	let feedState = $state<'idle' | 'checking' | 'ok' | 'error'>('idle');
	let feedMessage = $state('');
	let feedRequest = 0;

	const MATCH_OPTIONS = [
		{ value: 'keywords', label: 'Keywords' },
		{ value: 'ai', label: 'AI score' },
		{ value: 'both', label: 'Keywords or AI' }
	];

	function chooseMatch(next: string) {
		if (next === 'keywords' || next === 'ai' || next === 'both') matchMode = next;
	}

	let editingId = $state<string | null>(null);
	let editName = $state('');
	let deletingId = $state<string | null>(null);

	let scoringId = $state<string | null>(null);
	let scoringText = $state('');
	let scoringError = $state('');

	// A search-scored category needs a prompt; the same rule the route enforces.
	const needsPrompt = $derived(matchMode !== 'keywords');
	const canCreate = $derived(
		name.trim().length > 0 && (!needsPrompt || prompt.trim().length > 0) && !busy
	);

	function publish(next: CategoryView[]) {
		onchange(next);
	}

	async function loadSources() {
		try {
			const res = await fetch('/api/sources');
			if (res.ok) sources = ((await res.json()) as { sources: SourceRow[] }).sources;
		} catch {
			error = 'Could not load sources.';
		}
	}

	async function load() {
		try {
			const res = await fetch('/api/categories');
			if (res.ok) publish(((await res.json()) as { categories: CategoryView[] }).categories);
		} catch {
			error = 'Could not load categories.';
		}
	}

	onMount(() => {
		void loadSources();
	});

	async function move(id: string, direction: 'up' | 'down') {
		const patch = moveCategory(categories, id, direction);
		if (!patch) return;
		// Every position is rewritten so tied legacy rows separate; only rows whose
		// value actually changed produce a request.
		const writes = patch.filter((row) => {
			const current = categories.find((entry) => entry.id === row.id);
			return current && current.sortOrder !== row.sortOrder;
		});
		busy = true;
		error = '';
		try {
			for (const row of writes) {
				const res = await fetch(`/api/categories/${encodeURIComponent(row.id)}`, {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ sortOrder: row.sortOrder })
				});
				if (!res.ok) throw new Error('move');
			}
			await load();
		} catch {
			error = 'Could not reorder categories.';
		} finally {
			busy = false;
		}
	}

	async function rename(id: string) {
		const value = editName.trim();
		if (!value) return;
		busy = true;
		error = '';
		try {
			const res = await fetch(`/api/categories/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: value })
			});
			const body = (await res.json().catch(() => null)) as {
				category?: CategoryView;
				error?: { code?: string };
			} | null;
			if (!res.ok) {
				error =
					body?.error?.code === 'name_taken'
						? 'That name is already in use.'
						: 'Could not rename the category.';
				return;
			}
			editingId = null;
			await load();
		} catch {
			error = 'Could not rename the category.';
		} finally {
			busy = false;
		}
	}

	async function remove(id: string) {
		busy = true;
		error = '';
		try {
			const res = await fetch(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
			if (!res.ok) {
				error = 'Could not delete the category.';
				return;
			}
			deletingId = null;
			await load();
		} catch {
			error = 'Could not delete the category.';
		} finally {
			busy = false;
		}
	}

	async function checkFeed() {
		const url = feedUrl.trim();
		const request = ++feedRequest;
		if (!url) {
			feedState = 'idle';
			feedMessage = '';
			return true;
		}
		feedState = 'checking';
		feedMessage = '';
		try {
			const res = await fetch('/api/categories/feed-check', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url })
			});
			const body = (await res.json()) as {
				ok: boolean;
				feedTitle?: string;
				itemCount?: number;
				message?: string;
			};
			if (request !== feedRequest) return false;
			if (!body.ok) {
				feedState = 'error';
				feedMessage = body.message ?? 'That URL is not a usable feed.';
				return false;
			}
			feedState = 'ok';
			// A feed title is remote text; bidi overrides would disguise it.
			feedMessage = `${displayText(body.feedTitle ?? '') || 'Feed'} · ${body.itemCount ?? 0} items`;
			return true;
		} catch {
			if (request !== feedRequest) return false;
			feedState = 'error';
			feedMessage = 'Could not reach that URL.';
			return false;
		}
	}

	function resetForm() {
		name = '';
		matchMode = 'keywords';
		keywordText = '';
		prompt = '';
		threshold = 0.6;
		pickedSources = [];
		feedUrl = '';
		feedState = 'idle';
		feedMessage = '';
	}

	async function create() {
		if (!canCreate) return;
		busy = true;
		error = '';

		// The URL is probed before anything is written, so a bad paste leaves no
		// half-made category behind.
		if (feedUrl.trim() && !(await checkFeed())) {
			busy = false;
			error = 'Fix the feed URL first.';
			return;
		}

		try {
			const res = await fetch('/api/categories', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					matchMode,
					keywords: parseKeywords(keywordText),
					prompt: prompt.trim() || null,
					aiThreshold: threshold,
					sourceIds: pickedSources
				})
			});
			const body = (await res.json().catch(() => null)) as {
				category?: CategoryView;
				error?: { code?: string };
			} | null;
			if (!res.ok || !body?.category) {
				error =
					body?.error?.code === 'name_taken'
						? 'That name is already in use.'
						: 'Could not create the category.';
				return;
			}

			if (feedUrl.trim()) {
				const sourceRes = await fetch('/api/sources', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ url: feedUrl.trim(), categoryId: body.category.id })
				});
				if (!sourceRes.ok) {
					error = 'The category was created, but its feed was not added.';
					await load();
					return;
				}
			}

			resetForm();
			await load();
		} catch {
			error = 'Could not create the category.';
		} finally {
			busy = false;
		}
	}

	async function rescore(id: string) {
		if (scoringId) return;
		scoringId = id;
		scoringError = '';
		scoringText = 'Scoring 0 of 0';
		try {
			const res = await fetch(`/api/categories/${encodeURIComponent(id)}/rescore`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ reset: true })
			});
			if (!res.ok || !res.body) throw new Error('rescore');

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const parsed = takeScoreEvents(buffer);
				buffer = parsed.rest;
				for (const event of parsed.events) {
					if (event.type === 'progress') scoringText = `Scoring ${event.scored} of ${event.total}`;
					else if (event.type === 'degraded') scoringError = 'The AI provider is not available.';
					else {
						scoringText = '';
						if (event.degraded && !scoringError) scoringError = 'Some items could not be scored.';
						await load();
					}
				}
			}
		} catch {
			scoringError = 'Scoring failed.';
		} finally {
			scoringId = null;
		}
	}

	function toggleSource(id: string) {
		pickedSources = pickedSources.includes(id)
			? pickedSources.filter((entry) => entry !== id)
			: [...pickedSources, id];
	}
</script>

<div class="scrim" role="presentation" onclick={onclose} onkeydown={() => undefined}></div>
<section class="panel" aria-label="Manage categories">
	<header class="head">
		<h2>Categories</h2>
		<button class="iconbtn" type="button" aria-label="Close" onclick={onclose}>
			<X size={14} aria-hidden="true" />
		</button>
	</header>

	<div class="scroll">
		{#if error}
			<p class="err" role="alert">{error}</p>
		{/if}

		<ul class="list">
			{#each categories as entry, index (entry.id)}
				<li class="row">
					<div class="row-main">
						{#if editingId === entry.id}
							<form
								class="rename"
								onsubmit={(event) => {
									event.preventDefault();
									void rename(entry.id);
								}}
							>
								<input
									class="text"
									type="text"
									bind:value={editName}
									maxlength={40}
									aria-label="Category name"
								/>
								<button class="btn" type="submit" disabled={busy}>Save</button>
								<button class="btn" type="button" onclick={() => (editingId = null)}>
									Cancel
								</button>
							</form>
						{:else}
							<span class="label">{displayText(entry.name) || entry.id}</span>
							{#if entry.builtin}
								<span class="tag">Builtin</span>
							{:else}
								<span class="count">{entry.itemCount} items</span>
							{/if}
						{/if}
					</div>

					{#if !entry.builtin && editingId !== entry.id}
						<div class="row-actions">
							<button
								class="iconbtn"
								type="button"
								aria-label="Move {entry.name} up"
								disabled={busy || index === 0}
								onclick={() => move(entry.id, 'up')}
							>
								<ArrowUp size={14} aria-hidden="true" />
							</button>
							<button
								class="iconbtn"
								type="button"
								aria-label="Move {entry.name} down"
								disabled={busy || index === categories.length - 1}
								onclick={() => move(entry.id, 'down')}
							>
								<ArrowDown size={14} aria-hidden="true" />
							</button>
							{#if entry.matchMode !== 'keywords' && entry.hasPrompt}
								<button
									class="btn small"
									type="button"
									disabled={scoringId !== null}
									onclick={() => rescore(entry.id)}
								>
									Re-score
								</button>
							{/if}

							{#if deletingId === entry.id}
								<button
									class="btn small danger"
									type="button"
									disabled={busy}
									onclick={() => remove(entry.id)}
								>
									Delete
								</button>
								<button class="btn small" type="button" onclick={() => (deletingId = null)}>
									Keep
								</button>
							{:else}
								<button
									class="btn small"
									type="button"
									aria-label="Rename {entry.name}"
									onclick={() => {
										editingId = entry.id;
										editName = entry.name;
									}}
								>
									Rename
								</button>
								<button
									class="iconbtn"
									type="button"
									aria-label="Delete {entry.name}"
									onclick={() => (deletingId = entry.id)}
								>
									<X size={14} aria-hidden="true" />
								</button>
							{/if}
						</div>
					{/if}

					{#if scoringId === entry.id}
						<p class="meta">{scoringText || 'Scoring…'}</p>
					{/if}
				</li>
			{/each}
		</ul>

		{#if scoringError}
			<p class="err" role="alert">{scoringError}</p>
		{/if}

		<form
			class="create"
			onsubmit={(event) => {
				event.preventDefault();
				void create();
			}}
		>
			<h3>New category</h3>

			<label class="field">
				<span>Name</span>
				<input class="text" type="text" bind:value={name} maxlength={40} required />
			</label>

			<label class="field">
				<span>Feed URL</span>
				<input
					class="text"
					type="url"
					bind:value={feedUrl}
					placeholder="https://example.com/feed.xml"
					onblur={() => void checkFeed()}
				/>
			</label>
			{#if feedState === 'error'}
				<p class="err inline" role="alert">{feedMessage}</p>
			{:else if feedState === 'ok'}
				<p class="ok inline">{feedMessage}</p>
			{:else if feedState === 'checking'}
				<p class="meta inline">Checking…</p>
			{/if}

			<div class="field">
				<span>Match</span>
				<Dropdown label="Match" value={matchMode} options={MATCH_OPTIONS} onchange={chooseMatch} />
			</div>

			<label class="field">
				<span>Keywords</span>
				<textarea
					class="text"
					rows="2"
					bind:value={keywordText}
					placeholder="gpt-5, silicon, neuron"></textarea>
			</label>

			{#if needsPrompt}
				<label class="field">
					<span>Prompt</span>
					<textarea
						class="text"
						rows="3"
						bind:value={prompt}
						placeholder="Items about chip design and fabrication."></textarea>
				</label>

				<label class="field">
					<span>Threshold {threshold.toFixed(2)}</span>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						bind:value={threshold}
						aria-label="AI threshold"
					/>
				</label>
			{/if}

			{#if sources.length}
				<fieldset class="field sources">
					<legend>Sources</legend>
					{#each sources as entry (entry.id)}
						<label class="check">
							<input
								type="checkbox"
								checked={pickedSources.includes(entry.id)}
								onchange={() => toggleSource(entry.id)}
							/>
							<span>{displayText(entry.name) || entry.url}</span>
						</label>
					{/each}
				</fieldset>
			{/if}

			<div class="create-actions">
				<button class="btn primary" type="submit" disabled={!canCreate}>Create category</button>
			</div>
		</form>
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
		gap: 6px;
		padding: 10px 0;
		box-shadow: inset 0 -1px 0 var(--line);
	}

	.row-main {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 32px;
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

	.tag,
	.count {
		flex: none;
		color: var(--txt-3);
		font-size: 11.5px;
	}

	.row-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.rename {
		display: flex;
		flex: 1;
		gap: 4px;
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

	.btn.primary {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
		background: var(--accent-soft);
		color: var(--accent);
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

	textarea.text {
		height: auto;
		padding: 9px 10px;
		resize: vertical;
	}

	.text:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	.create {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 22px;
	}

	.create h3 {
		font-family: var(--font-sans);
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--txt-3);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.field > span,
	.field > legend {
		color: var(--txt-2);
		font-size: 12.5px;
	}

	.sources {
		gap: 4px;
		max-height: 200px;
		overflow-y: auto;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13.5px;
		color: var(--txt);
	}

	.create-actions {
		display: flex;
		justify-content: flex-end;
	}

	.err,
	.ok,
	.meta {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.5;
	}

	.err {
		color: var(--warn);
	}

	.ok {
		color: var(--ok);
	}

	.meta {
		color: var(--txt-3);
	}

	.inline {
		margin-top: -4px;
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

	@media (max-width: 760px) {
		.scroll {
			padding: 12px 14px 24px;
		}

		.text {
			/* iOS zooms the page when a focused field is under 16px. */
			font-size: 16px;
		}
	}
</style>
