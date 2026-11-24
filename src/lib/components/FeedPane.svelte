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
	const meta = $derived(categoryName ? `${displayText(categoryName)} · ${range}` : range);
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
						<ItemRow item={entry} {now} selected={entry.id === selectedId} {onselect} />
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
		height: 52px;
		padding: 0 18px;
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

	.pane-meta {
		overflow: hidden;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 11.5px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.scroll {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
		padding: 0 10px 10px;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 3px;
		animation: feed-in 160ms var(--ease) both;
	}

	.feed-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex: none;
		margin: 0 0 8px;
		padding: 9px 11px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--card);
		color: var(--txt-2);
		font-size: 12.5px;
		line-height: 1.5;
	}

	.feed-error .btn {
		flex: none;
		height: 30px;
		font-size: 12.5px;
	}

	.more {
		display: flex;
		justify-content: center;
		flex: none;
		padding: 14px 0 10px;
	}

	@keyframes feed-in {
		from {
			opacity: 0;
			transform: translateY(3px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
