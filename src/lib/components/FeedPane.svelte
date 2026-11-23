<script lang="ts">
	import { displayText } from '#lib/format';
	import type { Item } from '#lib/types';
	import { PRESET_LABEL, type Preset } from '#lib/util/time';
	import Empty from './Empty.svelte';
	import ItemRow from './ItemRow.svelte';
	import Skeleton from './Skeleton.svelte';

	let {
		items,
		state,
		error,
		nextCursor,
		selectedId,
		now,
		preset,
		categoryName,
		loadingMore,
		emptyText,
		onselect,
		onmore,
		onretry
	}: {
		items: Item[];
		state: 'ready' | 'loading' | 'error';
		error: string;
		nextCursor: string | null;
		selectedId: string | null;
		now: number;
		preset: Preset;
		categoryName: string;
		loadingMore: boolean;
		emptyText: string;
		onselect: (id: string) => void;
		onmore: () => void;
		onretry: () => void;
	} = $props();

	const range = $derived(PRESET_LABEL[preset]);
	const meta = $derived(
		categoryName ? `${displayText(categoryName)} · ${range}` : range
	);
</script>

<main class="pane feed-pane" aria-label="Feed">
	<div class="pane-head">
		<h2>Latest</h2>
		<span class="pane-meta" title={meta}>{meta}</span>
	</div>

	<div class="scroll" aria-busy={state === 'loading' || loadingMore}>
		{#if state === 'loading'}
			<Skeleton rows={7} />
		{:else}
			{#if error}
				<div class="feed-error" role="alert">
					<span>{error}</span>
					<button class="btn" type="button" onclick={onretry}>Try again</button>
				</div>
			{/if}

			{#if items.length === 0}
				{#if !error}
					<Empty text={emptyText} />
				{/if}
			{:else}
				<div class="list">
					{#each items as entry (entry.id)}
						<ItemRow
							item={entry}
							{now}
							selected={entry.id === selectedId}
							{onselect}
						/>
					{/each}
				</div>
				{#if nextCursor}
					<div class="more">
						<button class="btn" type="button" disabled={loadingMore} onclick={onmore}>
							{loadingMore ? 'Loading...' : 'Load more'}
						</button>
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</main>

<style>
	.pane-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex: none;
		height: 44px;
		padding: 0 14px;
		box-shadow: none;
	}

	.pane-head h2 {
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--txt-3);
	}

	.pane-meta {
		overflow: hidden;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 11px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.scroll {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
		padding: 0 8px 8px;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.feed-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex: none;
		margin: 0 0 6px;
		padding: 7px 9px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--card);
		color: var(--txt-2);
		font-size: 12px;
		line-height: 1.45;
	}

	.feed-error .btn {
		flex: none;
		height: 26px;
		font-size: 12px;
	}

	.more {
		display: flex;
		justify-content: center;
		flex: none;
		padding: 10px 0 8px;
	}
</style>
