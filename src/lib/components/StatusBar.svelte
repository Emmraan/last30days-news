<script lang="ts">
	import { AlertTriangle, Check, RefreshCw, WifiOff } from 'lucide-svelte';
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
	<span class="state" data-tone={tone} role="status">
		<span class="status-icon" aria-hidden="true">
			{#if offline}
				<WifiOff size={13} />
			{:else if refreshing}
				<span class="spin"><RefreshCw size={13} /></span>
			{:else if error}
				<AlertTriangle size={13} />
			{:else}
				<Check size={13} />
			{/if}
		</span>{state}
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
		height: 38px;
		padding: 0 18px;
		background: var(--bg);
		color: var(--txt-3);
		font-size: 12px;
		line-height: 1;
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-width: 0;
		color: var(--txt-2);
	}

	.status-icon {
		display: inline-grid;
		place-items: center;
		flex: none;
		color: var(--txt-3);
	}

	.state[data-tone='warn'] .status-icon {
		color: var(--warn);
	}

	.spin {
		animation: spin 900ms linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.retry {
		height: 24px;
		padding: 0 8px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--raise);
		color: var(--txt-2);
		font: inherit;
		font-size: 11.5px;
		cursor: pointer;
		transition:
			background-color 110ms var(--ease),
			border-color 110ms var(--ease),
			color 110ms var(--ease);
	}

	.retry:hover {
		border-color: var(--line-2);
		background: var(--raise-2);
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
