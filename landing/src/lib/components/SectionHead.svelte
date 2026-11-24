<script lang="ts">
	let {
		eyebrow,
		title,
		titleId,
		sub = ''
	}: { eyebrow: string; title: string; titleId: string; sub?: string } = $props();
</script>

<header class="head" class:solo={!sub}>
	<p class="eyebrow">{eyebrow}</p>
	<h2 id={titleId}>{title}</h2>
	{#if sub}
		<p class="sub">{sub}</p>
	{/if}
</header>

<style>
	.head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		column-gap: 64px;
		align-items: end;
		padding-bottom: 40px;
	}

	.head.solo {
		grid-template-columns: minmax(0, 1fr);
	}

	.eyebrow {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 18px;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	.eyebrow::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 1.5px;
		background: var(--accent);
	}

	h2 {
		max-width: 20ch;
		font-size: clamp(32px, 4vw, 44px);
		font-weight: 600;
		line-height: 1.08;
		letter-spacing: -0.028em;
	}

	.head.solo h2 {
		max-width: 24ch;
	}

	.sub {
		max-width: 38ch;
		margin-bottom: 4px;
		color: var(--txt-2);
		font-size: 14.5px;
		line-height: 1.65;
	}

	@media (max-width: 900px) {
		.head,
		.head.solo {
			grid-template-columns: minmax(0, 1fr);
			row-gap: 16px;
		}

		.eyebrow {
			margin-bottom: 0;
		}

		h2,
		.head.solo h2 {
			max-width: 24ch;
		}

		.sub {
			max-width: 60ch;
			margin-bottom: 0;
		}
	}

	@media (max-width: 760px) {
		h2,
		.head.solo h2 {
			font-size: 30px;
		}
	}
</style>
