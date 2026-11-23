<script lang="ts">
	type Row = { initials: string; title: string; source: string; when: string; on?: boolean };
	type Category = { name: string; count: number; on?: boolean };

	// Real shapes from the app: category counts, feed rows, summary with citations.
	const CATEGORIES: Category[] = [
		{ name: 'All items', count: 128, on: true },
		{ name: 'AI & research', count: 42 },
		{ name: 'Engineering', count: 31 },
		{ name: 'Security', count: 18 },
		{ name: 'Product', count: 14 },
		{ name: 'Science', count: 9 }
	];

	const ROWS: Row[] = [
		{
			initials: 'HF',
			title: 'RoboTrack: point tracking for real-world robotic manipulation',
			source: 'Hugging Face Blog',
			when: '34m ago',
			on: true
		},
		{
			initials: 'HN',
			title: 'Kagi Mail is here (Public Beta)',
			source: 'Hacker News',
			when: '38m ago'
		},
		{
			initials: 'TA',
			title: "Amazon snaps up Decart's AI optimization tech for $7.5B",
			source: 'TechCrunch AI',
			when: '41m ago'
		},
		{
			initials: 'HN',
			title: 'Nginx 1.30.8 (fix CVE-2026-132779; TLS 1.3 early data)',
			source: 'Hacker News',
			when: '1h ago'
		},
		{
			initials: 'AT',
			title: 'Marvel crams every superhero into the Doomsday final trailer',
			source: 'Ars Technica',
			when: '2h ago'
		},
		{
			initials: 'V',
			title: "The best Black Friday deals we've already found",
			source: 'The Verge',
			when: '2h ago'
		},
		{
			initials: 'SW',
			title: 'A new way to run small models on the edge',
			source: 'Simon Willison',
			when: '3h ago'
		}
	];
</script>

<figure class="frame">
	<figcaption class="sr-only">
		A preview of the reader: categories on the left, the feed in the middle, and the selected item
		with its summary on the right.
	</figcaption>

	<div class="app" aria-hidden="true">
		<aside class="side">
			<div class="pane-head">
				<h3>Categories</h3>
				<span class="plus">
					<svg
						viewBox="0 0 24 24"
						width="14"
						height="14"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
					>
						<path d="M12 5v14M5 12h14" />
					</svg>
				</span>
			</div>

			<div class="side-nav">
				{#each CATEGORIES as category (category.name)}
					<span class="side-item" class:on={category.on}>
						<span class="side-label">{category.name}</span>
						<span class="side-count mono">{category.count}</span>
					</span>
				{/each}
			</div>

			<div class="side-foot">
				<span class="plus small">
					<svg
						viewBox="0 0 24 24"
						width="13"
						height="13"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
					>
						<path d="M12 5v14M5 12h14" />
					</svg>
				</span>
				Manage categories
			</div>
		</aside>

		<section class="feed">
			<div class="pane-head">
				<h3>Latest</h3>
				<span class="hint mono">24 hours</span>
			</div>

			<div class="list">
				{#each ROWS as row (row.title)}
					<div class="item" class:on={row.on}>
						<span class="fav">{row.initials}</span>
						<span class="body">
							<span class="head">
								<span class="title">{row.title}</span>
								<span class="when mono">{row.when}</span>
							</span>
							<span class="meta">{row.source}</span>
						</span>
					</div>
				{/each}
			</div>
		</section>

		<section class="detail">
			<div class="pane-head">
				<h3>Detail</h3>
			</div>

			<article>
				<h3 class="item-title">RoboTrack: point tracking for real-world robotic manipulation</h3>

				<p class="byline">
					<time class="mono">34m ago</time>
					<span class="tag">AI &amp; research</span>
				</p>

				<div class="actions">
					<span class="btn">Open original</span>
					<span class="via">via Hugging Face Blog</span>
				</div>

				<div class="summary">
					<h4>Summary</h4>
					<p>
						RoboTrack follows points through video without per-frame labels, so a robot arm can
						track objects it has never seen. Weights and code are public.
					</p>

					<h4>Key points</h4>
					<ul class="points">
						<li>No supervised point annotations needed.</li>
						<li>Weights and a stacking demo are included.</li>
					</ul>

					<div class="cites">
						<span>[1] Hugging Face Blog</span>
						<span>[2] arXiv</span>
					</div>

					<p class="provenance mono">Generated 2 min ago</p>
				</div>
			</article>
		</section>
	</div>
</figure>

<style>
	.frame {
		margin: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		background: var(--bg);
		overflow: hidden;
	}

	.app {
		display: grid;
		grid-template-columns: 208px minmax(0, 1fr) 372px;
		gap: 2px;
		height: 480px;
		background: var(--bg);
	}

	.side,
	.feed,
	.detail {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.side {
		background: var(--side);
	}

	.feed,
	.detail {
		background: var(--pane);
	}

	.pane-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex: none;
		height: 44px;
		padding: 0 12px 0 14px;
	}

	.pane-head h3 {
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.plus {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 6px;
		color: var(--txt-3);
	}

	.plus.small {
		width: auto;
		height: auto;
	}

	.side-nav {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-height: 0;
		overflow: hidden;
		padding: 0 8px 8px;
	}

	.side-item {
		display: flex;
		align-items: center;
		gap: 9px;
		flex: none;
		height: 34px;
		padding: 0 10px;
		border-radius: 9px;
		color: var(--txt-2);
		font-size: 13px;
	}

	.side-item.on {
		background: var(--card);
		color: var(--txt);
		box-shadow: inset 0 0 0 1px var(--line);
	}

	.side-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.side-count {
		margin-left: auto;
		color: var(--txt-3);
		font-size: 11px;
	}

	.side-item.on .side-count {
		color: var(--txt-2);
	}

	.side-foot {
		display: flex;
		align-items: center;
		gap: 7px;
		flex: none;
		height: 42px;
		padding: 0 18px;
		box-shadow: inset 0 1px 0 var(--line);
		color: var(--txt-2);
		font-size: 12.5px;
	}

	.hint {
		color: var(--txt-3);
		font-size: 11px;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 8px 8px;
		overflow: hidden;
	}

	.item {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 9px;
		padding: 10px 11px;
		border-radius: 10px;
	}

	.item.on {
		background: var(--card);
		box-shadow: inset 0 0 0 1px var(--line);
	}

	.item.on::before {
		content: '';
		position: absolute;
		top: 9px;
		bottom: 9px;
		left: 0;
		width: 3px;
		border-radius: 0 2px 2px 0;
		background: var(--accent);
	}

	.fav {
		display: grid;
		place-items: center;
		flex: none;
		width: 18px;
		height: 18px;
		margin-top: 1px;
		border: 1px solid var(--line-2);
		border-radius: 5px;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 8.5px;
		line-height: 1;
	}

	.body {
		display: block;
		flex: 1;
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 12px;
	}

	.title {
		flex: 1;
		min-width: 0;
		font-size: 13.5px;
		font-weight: 500;
		line-height: 1.45;
	}

	.when {
		flex: none;
		color: var(--txt-3);
		font-size: 11px;
	}

	.meta {
		display: block;
		margin-top: 3px;
		color: var(--txt-3);
		font-size: 11.5px;
		line-height: 1.4;
	}

	.detail .pane-head {
		padding: 0 16px;
	}

	.detail article {
		min-height: 0;
		overflow: hidden;
		padding: 4px 18px 22px;
	}

	.item-title {
		font-size: 19px;
		font-weight: 600;
		line-height: 1.3;
		letter-spacing: -0.012em;
	}

	.byline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		color: var(--txt-3);
	}

	.byline time {
		font-size: 11px;
	}

	.tag {
		padding: 1px 7px;
		border-radius: var(--pill);
		background: var(--hover);
		color: var(--txt-2);
		font-size: 10.5px;
		line-height: 1.45;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		margin-top: 13px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		height: 30px;
		padding: 0 11px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--raise);
		color: var(--txt);
		font-size: 13px;
	}

	.via {
		color: var(--txt-3);
		font-size: 12px;
	}

	.summary {
		margin-top: 18px;
		padding-top: 16px;
		box-shadow: inset 0 1px 0 var(--line);
	}

	.summary h4 {
		margin: 14px 0 0;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.summary h4:first-child {
		margin-top: 0;
	}

	.summary p {
		margin: 7px 0 0;
		color: var(--txt-2);
		font-size: 13.5px;
		line-height: 1.6;
	}

	.points {
		margin: 7px 0 0;
		padding-left: 16px;
		color: var(--txt-2);
		font-size: 13px;
		line-height: 1.55;
	}

	.points li {
		margin: 3px 0;
	}

	.cites {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin-top: 12px;
		color: var(--accent);
		font-size: 12px;
		line-height: 1.5;
	}

	.provenance {
		margin-top: 12px;
		color: var(--txt-3);
		font-size: 10px;
		line-height: 1.5;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 1080px) {
		.app {
			grid-template-columns: minmax(0, 1fr) 372px;
		}

		.side {
			display: none;
		}
	}

	@media (max-width: 960px) {
		.app {
			grid-template-columns: minmax(0, 1fr);
			height: auto;
		}

		.detail {
			display: none;
		}
	}
</style>
