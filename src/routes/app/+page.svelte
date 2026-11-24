<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus } from 'lucide-svelte';
	import CategoryPanel from '#lib/components/CategoryPanel.svelte';
	import DetailPane from '#lib/components/DetailPane.svelte';
	import FeedPane from '#lib/components/FeedPane.svelte';
	import HelpOverlay from '#lib/components/HelpOverlay.svelte';
	import StatusBar from '#lib/components/StatusBar.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import SettingsPanel from '#lib/components/SettingsPanel.svelte';
	import { displayText } from '#lib/format';
	import type { CategoryView } from '#lib/server/categories/store';
	import type { FeedPage, Item, ItemDetail, Summary } from '#lib/types';
	import { resolveKey, stepIndex } from '#lib/util/keys';
	import { PRESET_LABEL, presetRange, type Preset } from '#lib/util/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const LIMIT = 50;
	const MIN_SEARCH_CHARS = 2;
	const SEARCH_DEBOUNCE_MS = 250;

	let preset = $state<Preset>('24h');
	let category = $state<string | null>(null);
	// The panel owns category mutations, so the sidebar reads a local copy that
	// it can replace after a create, rename, reorder or delete.
	// svelte-ignore state_referenced_locally
	let categories = $state<CategoryView[]>([...data.categories]);
	let panelOpen = $state(false);
	let settingsOpen = $state(false);
	// svelte-ignore state_referenced_locally
	let mustChangePassword = $state(data.mustChangePassword);
	let query = $state('');
	// Only two or more characters are a search; one character means "no filter".
	const activeQuery = $derived([...query.trim()].length >= MIN_SEARCH_CHARS ? query.trim() : '');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	// The client owns the feed after hydration; page data is only the first page.
	// svelte-ignore state_referenced_locally
	let items = $state<Item[]>([...data.feed.items]);
	// svelte-ignore state_referenced_locally
	let nextCursor = $state<string | null>(data.feed.nextCursor);
	let feedState = $state<'ready' | 'loading' | 'error'>('ready');
	let feedError = $state('');
	let loadingMore = $state(false);
	let helpOpen = $state(false);
	// True between `g` and the key that completes the chord; a stray `g` must not
	// arm the chord forever, hence the timer.
	let awaitingG = $state(false);
	let chordTimer: ReturnType<typeof setTimeout> | undefined;
	let offline = $state(false);

	let selectedId = $state<string | null>(null);
	let detail = $state<ItemDetail | null>(null);
	let detailState = $state<'idle' | 'loading' | 'error' | 'ready'>('idle');
	let detailError = $state('');
	let generating = $state(false);
	let generateError = $state('');

	// The server clock avoids an SSR mismatch; the interval updates it after mount.
	// svelte-ignore state_referenced_locally
	let now = $state(data.now);
	let refreshing = $state(false);

	let feedRequest = 0;
	let detailRequest = 0;
	let summaryRequest = 0;
	let failedMode: 'reset' | 'more' | 'silent' = 'reset';

	const categoryName = $derived(
		category ? (categories.find((entry) => entry.id === category)?.name ?? category) : ''
	);
	const detailCategoryName = $derived(
		detail
			? (categories.find((entry) => entry.id === detail?.item.category)?.name ??
					detail.item.category)
			: ''
	);
	const emptyText = $derived(
		`No items${activeQuery ? ` for "${activeQuery}"` : ''}${categoryName ? ` in ${displayText(categoryName)}` : ''} in the last ${PRESET_LABEL[preset]}. Refresh to fetch.`
	);

	onMount(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 60_000);

		const setOffline = () => {
			offline = !navigator.onLine;
		};
		setOffline();
		window.addEventListener('online', setOffline);
		window.addEventListener('offline', setOffline);

		window.addEventListener('keydown', onKeydown);

		return () => {
			clearInterval(timer);
			if (searchTimer) clearTimeout(searchTimer);
			if (chordTimer) clearTimeout(chordTimer);
			window.removeEventListener('online', setOffline);
			window.removeEventListener('offline', setOffline);
			window.removeEventListener('keydown', onKeydown);
		};
	});

	function isTyping(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement &&
			Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
		);
	}

	function isActivable(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement &&
			Boolean(target.closest('button, a[href], summary, [role="button"]'))
		);
	}

	function focusSearch(select = false) {
		const input = document.querySelector<HTMLInputElement>('.topbar input[type="search"]');
		input?.focus();
		if (select) input?.select();
	}

	/** `j`/`k` move the selection; the list keeps the row in view, never the page. */
	function step(delta: 1 | -1) {
		const next = stepIndex(
			items.length,
			items.findIndex((entry) => entry.id === selectedId),
			delta
		);
		if (next === null) return;
		void openItem(items[next].id);
	}

	function onKeydown(event: KeyboardEvent) {
		const action = resolveKey(
			{ key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey },
			{ typing: isTyping(event.target), awaitingG, activable: isActivable(event.target) }
		);

		if (chordTimer) clearTimeout(chordTimer);
		awaitingG = false;

		switch (action) {
			case null:
				return;
			case 'g':
				awaitingG = true;
				chordTimer = setTimeout(() => (awaitingG = false), 1000);
				break;
			case 'search':
				event.preventDefault();
				focusSearch();
				break;
			case 'quick-search':
				event.preventDefault();
				focusSearch(true);
				break;
			case 'next':
				event.preventDefault();
				step(1);
				break;
			case 'prev':
				event.preventDefault();
				step(-1);
				break;
			case 'open':
				if (selectedId) {
					event.preventDefault();
					void openItem(selectedId);
				}
				break;
			case 'escape':
				if (helpOpen) helpOpen = false;
				else if (settingsOpen) settingsOpen = false;
				else if (panelOpen) panelOpen = false;
				else if (isTyping(event.target)) (event.target as HTMLElement).blur();
				else clearDetail();
				break;
			case 'refresh':
				event.preventDefault();
				void refresh();
				break;
			case 'preset-24h':
				event.preventDefault();
				choosePreset('24h');
				break;
			case 'preset-7d':
				event.preventDefault();
				choosePreset('7d');
				break;
			case 'preset-30d':
				event.preventDefault();
				choosePreset('30d');
				break;
			case 'settings':
				event.preventDefault();
				settingsOpen = true;
				break;
			case 'help':
				event.preventDefault();
				helpOpen = true;
				break;
		}
	}

	$effect(() => {
		// Reading `selectedId` here is what re-runs this after `j`/`k`.
		if (!selectedId) return;
		document
			.querySelector('.feed-pane [aria-current="true"]')
			?.scrollIntoView({ block: 'nearest' });
	});

	async function loadFeed(mode: 'reset' | 'more' | 'silent') {
		if (mode === 'more' && (!nextCursor || loadingMore)) return;

		const request = ++feedRequest;
		const range = presetRange(preset, Date.now());
		const params = new URLSearchParams({
			from: String(range.from),
			to: String(range.to),
			limit: String(LIMIT)
		});
		if (category) params.set('category', category);
		if (activeQuery) params.set('q', activeQuery);
		if (mode === 'more' && nextCursor) params.set('cursor', nextCursor);

		if (mode === 'reset') {
			feedState = 'loading';
			items = [];
			nextCursor = null;
			loadingMore = false;
		} else if (mode === 'more') {
			loadingMore = true;
		}
		feedError = '';

		try {
			const res = await fetch(`/api/feed?${params.toString()}`);
			if (request !== feedRequest) return;
			if (!res.ok) throw new Error('feed request failed');
			const page = (await res.json()) as FeedPage;
			if (request !== feedRequest) return;

			if (mode === 'more') {
				const seen = new Set(items.map((entry) => entry.id));
				items = [...items, ...page.items.filter((entry) => !seen.has(entry.id))];
			} else {
				items = page.items;
			}
			nextCursor = page.nextCursor;
			feedState = 'ready';
		} catch {
			if (request !== feedRequest) return;
			failedMode = mode;
			if (mode === 'reset') {
				feedState = 'error';
				items = [];
				nextCursor = null;
				feedError = 'Could not load items.';
			} else if (mode === 'more') {
				feedError = 'Could not load more items.';
			} else {
				feedError = 'Could not refresh items.';
			}
		} finally {
			if (request === feedRequest) loadingMore = false;
		}
	}

	function clearDetail() {
		detailRequest++;
		summaryRequest++;
		selectedId = null;
		detail = null;
		detailState = 'idle';
		detailError = '';
		generating = false;
		generateError = '';
	}

	function chooseQuery(value: string) {
		query = value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchTimer = undefined;
			clearDetail();
			void loadFeed('reset');
		}, SEARCH_DEBOUNCE_MS);
	}

	function choosePreset(value: Preset) {
		if (value === preset) return;
		if (searchTimer) clearTimeout(searchTimer);
		preset = value;
		clearDetail();
		void loadFeed('reset');
	}

	function chooseCategory(value: string | null) {
		if (value === category) return;
		if (searchTimer) clearTimeout(searchTimer);
		category = value;
		clearDetail();
		void loadFeed('reset');
	}

	function applyCategories(next: CategoryView[]) {
		categories = next;
		// A deleted category cannot stay the active filter; fall back to All items
		// instead of showing an empty feed the user cannot explain.
		if (category && !next.some((entry) => entry.id === category)) {
			chooseCategory(null);
		}
	}

	/** Counts are server-side per category, so a refresh has to re-read them. */
	async function loadCategories() {
		const res = await fetch('/api/categories');
		if (!res.ok) return;
		const body = (await res.json()) as { categories: CategoryView[] };
		applyCategories(body.categories);
	}

	async function openItem(id: string) {
		if (selectedId === id && detailState === 'ready') return;

		const request = ++detailRequest;
		summaryRequest++;
		selectedId = id;
		detail = null;
		detailState = 'loading';
		detailError = '';
		generating = false;
		generateError = '';

		try {
			const res = await fetch(`/api/items/${encodeURIComponent(id)}`);
			if (request !== detailRequest) return;
			if (!res.ok) {
				detailState = 'error';
				detailError =
					res.status === 404 ? 'This item no longer exists.' : 'Could not load this item.';
				return;
			}
			const body = (await res.json()) as ItemDetail;
			if (request !== detailRequest) return;
			// The detail route has no category context, so the scored row is the
			// only place the active category's score and reason exist.
			const row = items.find((entry) => entry.id === id);
			detail = {
				...body,
				item: { ...body.item, score: row?.score ?? null, reason: row?.reason ?? null }
			};
			detailState = 'ready';
		} catch {
			if (request !== detailRequest) return;
			detailState = 'error';
			detailError = 'Could not load this item.';
		}
	}

	function retryDetail() {
		if (selectedId) void openItem(selectedId);
	}

	function mapSummaryError(code: string | undefined): string {
		switch (code) {
			case 'ai_not_configured':
				return 'No AI provider is set up.';
			case 'ai_locked':
			case 'unauthenticated':
				return 'Sign in again to unlock AI keys.';
			case 'ai_invalid_output':
			case 'ai_failed':
				return 'The AI provider did not return a summary. Try again.';
			case 'not_found':
				return 'This item no longer exists.';
			default:
				return 'Could not generate a summary. Try again.';
		}
	}

	async function generateSummary() {
		if (!detail || generating) return;

		const id = detail.item.id;
		const request = ++summaryRequest;
		generating = true;
		generateError = '';

		try {
			const res = await fetch(`/api/items/${encodeURIComponent(id)}/summary`, {
				method: 'POST'
			});
			const body = (await res.json().catch(() => null)) as {
				summary?: Summary;
				error?: { code?: string };
			} | null;
			if (request !== summaryRequest || detail?.item.id !== id) return;

			if (!res.ok || !body?.summary) {
				generateError = mapSummaryError(body?.error?.code);
				return;
			}
			detail = { ...detail, summary: body.summary };
		} catch {
			if (request === summaryRequest && detail?.item.id === id) {
				generateError = 'Could not generate a summary. Try again.';
			}
		} finally {
			if (request === summaryRequest) generating = false;
		}
	}

	function loadMore() {
		void loadFeed('more');
	}

	function retryFeed() {
		void loadFeed(failedMode === 'more' && nextCursor ? 'more' : 'reset');
	}

	type RefreshEvent = { type: 'source' } | { type: 'done'; sources: number };

	async function refresh() {
		if (refreshing) return;

		refreshing = true;
		feedError = '';

		try {
			for (let round = 0; round < 100; round++) {
				const res = await fetch('/api/refresh', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ batch: true })
				});
				if (!res.ok) throw new Error('refresh failed');
				const body = (await res.json()) as { events: RefreshEvent[] };
				const done = body.events.find((event) => event.type === 'done');
				if (!done || done.type !== 'done' || done.sources === 0) break;
			}
			await loadFeed('silent');
			await loadCategories();
		} catch {
			feedError = 'Refresh failed.';
		} finally {
			refreshing = false;
		}
	}
</script>

<svelte:head>
	<title>Dashboard - last30days-news</title>
</svelte:head>

<div class="shell">
	<div class="top">
		<TopBar
			{preset}
			onpreset={choosePreset}
			onrefresh={refresh}
			{refreshing}
			{query}
			onquery={chooseQuery}
			onsettings={() => (settingsOpen = true)}
			onhelp={() => (helpOpen = true)}
		/>
		{#if mustChangePassword}
			<p class="firstrun" role="status">
				The first-run password is still in place.
				<button class="link" type="button" onclick={() => (settingsOpen = true)}>
					Change it now
				</button>.
			</p>
		{/if}
		{#if offline}
			<p class="offline" role="status">Disconnected — showing cached items</p>
		{/if}
	</div>
	<div class="fetchbar" class:on={refreshing} aria-hidden="true"><span></span></div>

	<div class="body">
		<aside class="pane sidebar" aria-label="Categories">
			<div class="pane-head">
				<h2>Categories</h2>
				<button
					class="iconbtn"
					type="button"
					aria-label="Add category"
					title="Add category"
					onclick={() => (panelOpen = true)}
				>
					<Plus size={16} aria-hidden="true" />
				</button>
			</div>

			<div class="side-nav" role="group" aria-label="Feed filters">
				<button
					class="side-item"
					class:on={category === null}
					type="button"
					aria-pressed={category === null}
					onclick={() => chooseCategory(null)}
				>
					<span class="side-label">All items</span>
				</button>
				{#each categories as entry (entry.id)}
					<button
						class="side-item"
						class:on={category === entry.id}
						type="button"
						aria-pressed={category === entry.id}
						title={displayText(entry.name) || entry.id}
						onclick={() => chooseCategory(entry.id)}
					>
						<span class="side-label">{displayText(entry.name) || entry.id}</span>
						<span class="side-count mono">{entry.itemCount}</span>
					</button>
				{/each}
			</div>

			<div class="side-foot">
				<button class="side-item" type="button" onclick={() => (panelOpen = true)}>
					<Plus size={16} aria-hidden="true" />
					<span class="side-label">Manage categories</span>
				</button>
			</div>
		</aside>

		<FeedPane
			{items}
			state={feedState}
			error={feedError}
			{nextCursor}
			{selectedId}
			{now}
			{preset}
			{categoryName}
			{loadingMore}
			{emptyText}
			onselect={openItem}
			onmore={loadMore}
			onretry={retryFeed}
		/>

		<DetailPane
			state={detailState}
			{detail}
			error={detailError}
			categoryName={detailCategoryName}
			{now}
			{generating}
			{generateError}
			onretry={retryDetail}
			ongenerate={generateSummary}
		/>
	</div>

	<StatusBar
		count={items.length}
		{preset}
		{refreshing}
		{offline}
		error={feedState === 'error'}
		onretry={retryFeed}
	/>
</div>

{#if panelOpen}
	<CategoryPanel {categories} onchange={applyCategories} onclose={() => (panelOpen = false)} />
{/if}

{#if settingsOpen}
	<SettingsPanel
		{mustChangePassword}
		onpasswordchanged={() => (mustChangePassword = false)}
		onclose={() => (settingsOpen = false)}
	/>
{/if}

{#if helpOpen}
	<HelpOverlay onclose={() => (helpOpen = false)} />
{/if}

<style>
	.shell {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		height: 100vh;
		overflow: hidden;
		background: var(--bg);
	}

	.body {
		display: grid;
		grid-template-columns: 260px minmax(0, 1fr) 460px;
		gap: 12px;
		min-height: 0;
		padding: 0 16px 12px;
		background: var(--bg);
	}

	.sidebar {
		background: var(--side);
	}

	.pane-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex: none;
		height: 52px;
		padding: 0 10px 0 18px;
		box-shadow: none;
	}

	.pane-head h2 {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--txt-3);
	}

	.side-nav {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 3px;
		min-height: 0;
		overflow-y: auto;
		padding: 0 10px 10px;
	}

	.side-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 40px;
		padding: 0 12px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: var(--txt-2);
		font: inherit;
		font-size: 13.5px;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 110ms var(--ease),
			color 110ms var(--ease),
			box-shadow 110ms var(--ease),
			transform 80ms var(--ease);
	}

	.side-item:hover {
		background: var(--hover);
		color: var(--txt);
	}

	.side-item:active {
		transform: scale(0.998);
	}

	.side-item.on {
		background: var(--card);
		color: var(--txt);
		box-shadow: 0 0 0 1px var(--line);
	}

	.side-item:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.side-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.side-count {
		margin-left: auto;
		color: var(--txt-3);
		font-size: 11.5px;
	}

	.side-item.on .side-count {
		color: var(--txt-2);
	}

	.side-foot {
		flex: none;
		padding: 10px;
		box-shadow: inset 0 1px 0 var(--line);
	}

	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.firstrun {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 0;
		padding: 8px 16px;
		background: color-mix(in srgb, var(--warn) 12%, var(--bg));
		box-shadow: inset 0 -1px 0 var(--line);
		color: var(--txt-2);
		font-size: 12.5px;
	}

	.offline {
		margin: 0;
		padding: 8px 16px;
		background: color-mix(in srgb, var(--warn) 20%, var(--bg));
		box-shadow: inset 0 -1px 0 var(--line);
		color: var(--txt-2);
		font-size: 12.5px;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.fetchbar {
		position: fixed;
		z-index: 4;
		top: var(--h-top);
		right: 0;
		left: 0;
		height: 2px;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
		transition: opacity 100ms var(--ease);
	}

	.fetchbar.on {
		opacity: 1;
	}

	.fetchbar span {
		display: block;
		width: 28%;
		height: 100%;
		background: var(--accent);
		animation: fetch 1.2s linear infinite;
	}

	@keyframes fetch {
		from {
			transform: translateX(-100%);
		}

		to {
			transform: translateX(360%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fetchbar span {
			width: 100%;
			animation: none;
		}
	}

	@media (max-width: 1360px) {
		.body {
			grid-template-columns: 220px minmax(0, 1fr) 400px;
		}
	}

	@media (max-width: 1020px) {
		.body {
			grid-template-columns: minmax(0, 1fr) 400px;
		}

		.sidebar {
			display: none;
		}
	}

	@media (max-width: 760px) {
		.body {
			grid-template-columns: minmax(0, 1fr);
		}

		:global(.detail-pane) {
			display: none;
		}
	}
</style>
