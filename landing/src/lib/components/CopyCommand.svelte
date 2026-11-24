<script lang="ts">
	let { command, label = 'Copy' }: { command: string; label?: string } = $props();
</script>

<div class="cmd">
	<pre><code>{command}</code></pre>
	<button class="copy-command" type="button" data-copy={command} data-label={label}>
		{label}
	</button>
</div>

<style>
	.cmd {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin: 14px 0;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--card);
	}

	pre {
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		margin: 0;
		padding: 0;
		background: none;
		border: 0;
	}

	code {
		background: none;
		border: 0;
		padding: 0;
		white-space: pre;
	}

	.copy-command {
		flex: none;
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--line-2);
		border-radius: 7px;
		background: var(--raise);
		color: var(--txt-2);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.copy-command:hover {
		border-color: var(--txt-3);
		color: var(--txt);
	}

	:global(.copy-command.done) {
		color: var(--ok);
	}

	@media (max-width: 560px) {
		.cmd {
			flex-direction: column;
		}
	}
</style>
