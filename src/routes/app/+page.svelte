<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus } from 'lucide-svelte';
	import StatusBar from '#lib/components/StatusBar.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
</script>

<svelte:head>
	<title>Dashboard - last30days-news</title>
</svelte:head>

<div class="shell">
	<TopBar />

	<div class="body">
		<aside class="pane sidebar" aria-label="Categories">
			<div class="pane-head">
				<h2>Categories</h2>
				<button class="iconbtn" type="button" aria-label="Add category" disabled>
					<Plus size={14} aria-hidden="true" />
				</button>
			</div>

			<nav class="side-nav" aria-label="Feed filters">
				<a class="side-item on" href={resolve('/app')} aria-current="page">All items</a>
			</nav>

			<div class="side-foot">
				<button class="side-item" type="button" disabled>Manage categories</button>
			</div>
		</aside>

		<main class="pane feed" aria-label="Feed">
			<div class="pane-head">
				<h2>Latest</h2>
				<span class="pane-meta">24 hours</span>
			</div>
			<div class="pane-empty">No items in the last 24 hours. Refresh to fetch.</div>
		</main>

		<section class="pane detail" aria-label="Item detail">
			<div class="pane-head">
				<h2>Detail</h2>
			</div>
			<div class="pane-empty">Select an item to read it.</div>
		</section>
	</div>

	<StatusBar />
</div>

<style>
	.shell {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		height: 100vh;
		overflow: hidden;
		background: var(--bg);
	}

	.body {
		display: grid;
		grid-template-columns: 252px minmax(0, 1fr) 424px;
		gap: 2px;
		min-height: 0;
		padding: 0 0 2px;
		background: var(--bg);
	}

	.sidebar {
		background: var(--side);
	}

	.pane-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex: none;
		height: 38px;
		padding: 0 10px 0 12px;
		box-shadow: inset 0 -1px 0 var(--line);
	}

	.pane-head h2 {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--txt-3);
	}

	.pane-meta {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--txt-3);
	}

	.side-nav {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px;
	}

	.side-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 30px;
		padding: 0 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--txt-2);
		font: inherit;
		font-size: 13px;
		text-align: left;
		cursor: pointer;
	}

	.side-item:hover {
		background: var(--hover);
		color: var(--txt);
	}

	.side-item.on {
		background: var(--active);
		color: var(--txt);
	}

	.side-item:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.side-foot {
		margin-top: auto;
		padding: 6px;
		box-shadow: inset 0 1px 0 var(--line);
	}

	.pane-empty {
		display: grid;
		place-items: center;
		flex: 1;
		padding: 24px;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.5;
		text-align: center;
	}

	@media (max-width: 1280px) {
		.body {
			grid-template-columns: 252px minmax(0, 1fr);
		}

		.detail {
			display: none;
		}
	}

	@media (max-width: 940px) {
		.body {
			grid-template-columns: minmax(0, 1fr);
		}

		.sidebar {
			display: none;
		}
	}
</style>
