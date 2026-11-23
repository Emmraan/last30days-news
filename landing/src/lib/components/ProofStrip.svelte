<script lang="ts">
	const FACTS = ['Local-first', 'Works without an AI key', 'Bring your own model', 'Cited summaries'];
</script>

<section class="proof" aria-label="What the reader gives you">
	<div class="wrap">
		<ul class="row">
			{#each FACTS as fact, i (fact)}
				<li class="fact">
					<span class="num mono">{String(i + 1).padStart(2, '0')}</span>
					<span class="label">{fact}</span>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.proof {
		margin-top: 64px;
	}

	.row {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		list-style: none;
	}

	.fact {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 17px 18px 17px 22px;
	}

	.fact:first-child {
		padding-left: 0;
	}

	.fact + .fact {
		border-left: 1px solid var(--line);
	}

	.num {
		flex: none;
		color: var(--accent);
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1.5;
	}

	.label {
		color: var(--txt-2);
		font-size: 13px;
		line-height: 1.45;
	}

	@media (max-width: 760px) {
		.proof {
			margin-top: 42px;
		}

		.row {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.fact {
			padding: 14px 12px;
		}

		.fact:first-child {
			padding-left: 12px;
		}

		.fact:nth-child(odd) {
			padding-left: 0;
			border-left: 0;
		}

		.fact:nth-child(n + 3) {
			border-top: 1px solid var(--line);
		}
	}
</style>
