<script lang="ts">
	/** §S14 map. A bordered panel, not a modal: it never traps focus. */
	const GROUPS: { title: string; rows: [string, string][] }[] = [
		{
			title: 'Move',
			rows: [
				['j / k', 'Next / previous item'],
				['Enter', 'Open the selected item'],
				['Esc', 'Close the detail or this panel']
			]
		},
		{
			title: 'Find',
			rows: [
				['Ctrl / ⌘ K', 'Quick search from anywhere'],
				['/', 'Focus search'],
				['1 2 3', '24 hours / 7 days / 30 days']
			]
		},
		{
			title: 'Do',
			rows: [
				['r', 'Refresh the feed'],
				['g then s', 'Open settings'],
				['?', 'Show this panel']
			]
		}
	];

	let { onclose }: { onclose: () => void } = $props();
</script>

<div class="help" role="dialog" aria-modal="false" aria-label="Keyboard shortcuts">
	<div class="wrap">
		<div class="head">
			<h2>Keyboard</h2>
			<button class="btn" type="button" onclick={onclose}>Close</button>
		</div>
		<div class="cols">
			{#each GROUPS as group (group.title)}
				<section>
					<h3>{group.title}</h3>
					<dl>
						{#each group.rows as [keys, label] (keys)}
							<div>
								<dt class="mono">{keys}</dt>
								<dd>{label}</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/each}
		</div>
	</div>
</div>

<style>
	.help {
		position: fixed;
		z-index: 22;
		inset: auto auto 40px 50%;
		transform: translateX(-50%);
		padding: 0;
	}

	.wrap {
		width: min(560px, calc(100vw - 32px));
		border: 1px solid var(--line);
		border-radius: var(--r);
		background: var(--pane);
		box-shadow: 0 18px 48px rgb(0 0 0 / 28%);
		animation: help-in 160ms var(--ease) both;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 48px;
		padding: 0 10px 0 16px;
		box-shadow: inset 0 -1px 0 var(--line);
	}

	.head h2 {
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--txt-3);
	}

	.head .btn {
		height: 30px;
		font-size: 12.5px;
	}

	.cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px 24px;
		padding: 16px;
	}

	h3 {
		margin: 0 0 8px;
		color: var(--txt-3);
		font-size: 11.5px;
		font-weight: 600;
	}

	dl {
		display: flex;
		flex-direction: column;
		gap: 7px;
		margin: 0;
	}

	dl div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	dt {
		color: var(--txt);
		font-family: var(--font-mono);
		font-size: 11.5px;
	}

	dd {
		margin: 0;
		color: var(--txt-2);
		font-size: 12.5px;
		line-height: 1.45;
	}

	@keyframes help-in {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.mono {
		font-variant-numeric: tabular-nums;
	}
</style>
