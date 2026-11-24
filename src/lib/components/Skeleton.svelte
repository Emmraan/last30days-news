<script lang="ts">
	let {
		variant = 'rows',
		rows = 6
	}: {
		variant?: 'rows' | 'detail';
		rows?: number;
	} = $props();

	const indices = $derived(Array.from({ length: rows }, (_, index) => index));
</script>

{#if variant === 'rows'}
	<div class="rows" aria-hidden="true">
		{#each indices as index (index)}
			<div class="row">
				<span class="head">
					<span class="bar badge"></span>
					<span class="lines">
						<span class="bar title"></span>
						<span class="bar title short"></span>
					</span>
					<span class="bar when"></span>
				</span>
				<span class="bar meta"></span>
			</div>
		{/each}
	</div>
{:else}
	<div class="detail" aria-hidden="true">
		<span class="bar d-title"></span>
		<span class="bar d-title short"></span>
		<span class="bar d-meta"></span>
		<div class="copy">
			<span class="bar line"></span>
			<span class="bar line"></span>
			<span class="bar line short"></span>
			<span class="bar line"></span>
			<span class="bar line short"></span>
		</div>
	</div>
{/if}

<style>
	.bar {
		display: block;
		border-radius: 4px;
		background: var(--card);
		animation: skeleton-pulse 1.4s ease-in-out infinite alternate;
	}

	@keyframes skeleton-pulse {
		from {
			opacity: 0.55;
		}
		to {
			opacity: 0.95;
		}
	}

	.row {
		box-sizing: border-box;
		height: 82px;
		padding: 12px 13px;
	}

	.head {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr) 38px;
		align-items: start;
		gap: 10px;
		min-height: 42px;
	}

	.badge {
		width: 20px;
		height: 20px;
		margin-top: 2px;
		border-radius: 6px;
	}

	.lines {
		display: flex;
		flex-direction: column;
		gap: 7px;
		padding-top: 3px;
	}

	.title {
		width: 85%;
		height: 10px;
	}

	.title.short {
		width: 55%;
	}

	.when {
		width: 38px;
		height: 8px;
		margin-top: 4px;
	}

	.meta {
		width: 90px;
		height: 8px;
		margin-top: 8px;
		margin-left: 30px;
	}

	.detail {
		padding: 8px 2px;
	}

	.d-title {
		width: 92%;
		height: 20px;
		margin-bottom: 9px;
	}

	.d-title.short {
		width: 64%;
		margin-bottom: 16px;
	}

	.d-meta {
		width: 55%;
		height: 9px;
		margin-bottom: 26px;
	}

	.copy {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.line {
		width: 100%;
		height: 10px;
	}

	.line.short {
		width: 72%;
	}
</style>
