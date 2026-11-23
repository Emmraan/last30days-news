<script lang="ts">
	import { displayText, formatWhen, sourceInitials } from '#lib/format';
	import type { Item } from '#lib/types';

	let {
		item,
		now,
		selected = false,
		onselect
	}: {
		item: Item;
		now: number;
		selected?: boolean;
		onselect: (id: string) => void;
	} = $props();

	const title = $derived(displayText(item.title) || 'Untitled');
	const source = $derived(item.sourceName ? displayText(item.sourceName) : 'Unknown source');
	const when = $derived(formatWhen(item.publishedAt, now, item.publishedEstimated));
</script>

<button
	class="item row"
	class:on={selected}
	type="button"
	aria-current={selected ? 'true' : undefined}
	onclick={() => onselect(item.id)}
>
	<span class="head">
		<span class="fav" aria-hidden="true">{sourceInitials(item.sourceName)}</span>
		<span class="title">{title}</span>
		<time class="when" datetime={new Date(item.publishedAt).toISOString()}>{when}</time>
	</span>
	<span class="meta">
		<span class="source">{source}</span>
		{#if item.sourceCount > 1}
			<span class="tag">{item.sourceCount} sources</span>
		{/if}
	</span>
	{#if item.reason}
		<span class="why reason">{displayText(item.reason)}</span>
	{/if}
</button>

<style>
	.row {
		box-sizing: border-box;
	}

	.head {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: start;
		gap: 9px;
	}

	.head .fav {
		margin-top: 1px;
	}

	.title {
		display: -webkit-box;
		min-width: 0;
		overflow: hidden;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		color: var(--txt);
		font-size: 13.5px;
		font-weight: 500;
		line-height: 1.4;
	}

	.when {
		margin-top: 1px;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		line-height: 1.4;
		white-space: nowrap;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		margin-top: 3px;
		padding-left: 27px;
		color: var(--txt-3);
		font-size: 11.5px;
		line-height: 1.4;
	}

	.source {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta .tag {
		flex: none;
		height: 16px;
		padding: 0 5px;
		font-size: 9px;
	}

	.reason {
		display: block;
		margin-top: 7px;
		padding: 6px 8px;
		font-size: 12px;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}
</style>
