<script lang="ts">
	import type { Preset } from '#lib/util/time';

	let {
		count,
		preset,
		refreshing,
		offline = false,
		error = false,
		onretry
	}: {
		count: number;
		preset: Preset;
		refreshing: boolean;
		offline?: boolean;
		error?: boolean;
		onretry?: () => void;
	} = $props();

	const label = $derived(`${count} ${count === 1 ? 'item' : 'items'}`);
	const state = $derived(
		offline ? 'Disconnected' : refreshing ? 'Refreshing' : error ? 'Last refresh failed' : 'Ready'
	);
	const tone = $derived(offline || error ? 'warn' : 'ok');
</script>

<footer class="statusbar">
	<span class="state" data-tone={tone}>
		<span class="dot" aria-hidden="true"></span>{state}
		{#if onretry && (offline || error) && !refreshing}
			<button class="retry" type="button" onclick={onretry}>Retry</button>
		{/if}
	</span>
	<span class="meta">
		<span class="mono">{label}</span><span aria-hidden="true">·</span><span class="mono">
			{preset}
		</span>
	</span>
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
		min-width: 0;
		color: var(--txt-2);
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: var(--pill);
		background: var(--ok);
	}

	.state[data-tone='warn'] .dot {
		background: var(--warn);
	}

	.retry {
		height: 18px;
		padding: 0 6px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: var(--raise);
		color: var(--txt-2);
		font: inherit;
		font-size: 11px;
		cursor: pointer;
	}

	.retry:hover {
		color: var(--txt);
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
