<script lang="ts">
	import type { Preset } from '#lib/util/time';

	let {
		count,
		preset,
		refreshing
	}: { count: number; preset: Preset; refreshing: boolean } = $props();

	const label = $derived(`${count} ${count === 1 ? 'item' : 'items'}`);
</script>

<footer class="statusbar">
	<span class="state"><span class="dot" aria-hidden="true"></span>{refreshing
			? 'Refreshing'
			: 'Ready'}</span>
	<span class="meta"
		><span class="mono">{label}</span><span aria-hidden="true">·</span><span class="mono"
			>{preset}</span
		></span
	>
</footer>

<style>
	.statusbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: var(--h-sb);
		padding: 0 12px;
		background: var(--bg);
		box-shadow: 0 -1px 0 var(--line);
		color: var(--txt-3);
		font-size: 12px;
		line-height: 1;
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--txt-2);
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: var(--pill);
		background: var(--ok);
	}

	.meta {
		display: inline-flex;
		align-items: center;
		gap: 7px;
	}

	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
