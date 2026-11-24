<script lang="ts">
	// Real UI crops, built from markup — the app screenshots are not final yet.
</script>

<section id="how" class="how" aria-labelledby="how-title">
	<div class="wrap">
		<header class="head">
			<p class="eyebrow">How it works</p>
			<h2 id="how-title">From a feed URL to a cited summary.</h2>
			<p class="sub">
				Set it up once. Fetching and sorting run on a schedule; summaries run only when you ask,
				using the model you configure.
			</p>
		</header>

		<ol class="steps">
			<li class="step">
				<div class="rail">
					<span class="num mono">01</span>
					<span class="label mono">Sources</span>
				</div>

				<div class="body">
					<h3>Add the feeds you already read.</h3>
					<p class="copy">
						Paste an RSS or Atom URL into a category, or start from a source that ships with the
						app. Each feed is fetched on a schedule.
					</p>

					<div class="crop" aria-hidden="true">
						<div class="ui">
							<div class="ui-head">
								<span class="ui-label">Sources</span>
								<span class="ui-meta mono">3 feeds</span>
							</div>

							<div class="add">
								<span class="add-field mono">https://example.com/feed.xml</span>
								<span class="add-btn">Add</span>
							</div>

							<div class="src-list">
								<div class="src-row">
									<span class="fav">HF</span>
									<span class="src-body">
										<span class="src-name">Hugging Face Blog</span>
										<span class="src-url mono">huggingface.co/blog/feed.xml</span>
									</span>
									<span class="src-time mono">12m</span>
								</div>
								<div class="src-row">
									<span class="fav">HN</span>
									<span class="src-body">
										<span class="src-name">Hacker News</span>
										<span class="src-url mono">news.ycombinator.com/rss</span>
									</span>
									<span class="src-time mono">4m</span>
								</div>
								<div class="src-row">
									<span class="fav">AT</span>
									<span class="src-body">
										<span class="src-name">Ars Technica</span>
										<span class="src-url mono">arstechnica.com/feed</span>
									</span>
									<span class="src-time mono">8m</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</li>

			<li class="step">
				<div class="rail">
					<span class="num mono">02</span>
					<span class="label mono">Timeline</span>
				</div>

				<div class="body">
					<h3>One timeline, already sorted.</h3>
					<p class="copy">
						Items are cleaned, deduplicated, and placed in the categories you set. Switch between
						24 hours, 7 days, and the full 30-day window.
					</p>

					<div class="crop" aria-hidden="true">
						<div class="ui">
							<div class="ui-head">
								<span class="ui-label">Latest</span>
								<span class="seg mono">
									<span>24h</span>
									<span>7d</span>
									<span class="on">30d</span>
								</span>
							</div>

							<div class="feed-list">
								<div class="feed-row">
									<span class="fav">HF</span>
									<span class="feed-body">
										<span class="feed-title">
											RoboTrack: point tracking for real-world robotic manipulation
										</span>
										<span class="feed-meta">Hugging Face Blog · AI &amp; research</span>
									</span>
									<span class="feed-time mono">34m</span>
								</div>
								<div class="feed-row">
									<span class="fav">HN</span>
									<span class="feed-body">
										<span class="feed-title">Kagi Mail is here (Public Beta)</span>
										<span class="feed-meta">Hacker News · Product</span>
									</span>
									<span class="feed-time mono">38m</span>
								</div>
								<div class="feed-row">
									<span class="fav">HN</span>
									<span class="feed-body">
										<span class="feed-title">Nginx 1.30.8 (fix CVE-2026-132779)</span>
										<span class="feed-meta">Hacker News · Security</span>
									</span>
									<span class="feed-time mono">1h</span>
								</div>
								<div class="feed-row">
									<span class="fav">SW</span>
									<span class="feed-body">
										<span class="feed-title">A new way to run small models on the edge</span>
										<span class="feed-meta">Simon Willison · AI &amp; research</span>
									</span>
									<span class="feed-time mono">3h</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</li>

			<li class="step">
				<div class="rail">
					<span class="num mono">03</span>
					<span class="label mono">Summary</span>
				</div>

				<div class="body">
					<h3>Ask for a summary when you need one.</h3>
					<p class="copy">
						The summary is built from the item's own text, with citations back to the source.
						Without an AI key, the reader still works.
					</p>

					<div class="crop" aria-hidden="true">
						<div class="ui">
							<div class="ui-head">
								<span class="ui-label">Summary</span>
								<span class="ui-meta mono">2 citations</span>
							</div>

							<div class="sum">
								<span class="sum-title">
									RoboTrack: point tracking for real-world robotic manipulation
								</span>
								<p class="sum-text">
									The method tracks points through video without per-frame labels, so a robot
									arm can track objects it has never seen.<span class="cite">[1]</span> Weights
									and code are public.<span class="cite">[2]</span>
								</p>
								<div class="cites">
									<span>[1] Hugging Face Blog</span>
									<span>[2] arXiv</span>
								</div>
								<p class="prov mono">Generated 2 min ago</p>
							</div>
						</div>
					</div>
				</div>
			</li>
		</ol>
	</div>
</section>

<style>
	.how {
		padding: var(--section) 0;
	}

	.head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		column-gap: 64px;
		align-items: end;
		padding-bottom: 40px;
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

	.sub {
		max-width: 38ch;
		margin-bottom: 4px;
		color: var(--txt-2);
		font-size: 14.5px;
		line-height: 1.65;
	}

	.steps {
		border-top: 1px solid var(--line);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.step {
		display: grid;
		grid-template-columns: 132px minmax(0, 1fr);
		gap: 52px;
		padding: 48px 0;
	}

	.step + .step {
		border-top: 1px solid var(--line);
	}

	.rail {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding-top: 4px;
	}

	.num {
		color: var(--accent);
		font-size: 12px;
		font-weight: 600;
	}

	.label {
		color: var(--txt-3);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.body {
		min-width: 0;
	}

	.body h3 {
		font-size: 24px;
		font-weight: 600;
		line-height: 1.25;
		letter-spacing: -0.018em;
	}

	.copy {
		max-width: 58ch;
		margin-top: 10px;
		color: var(--txt-2);
		font-size: 14.5px;
		line-height: 1.65;
	}

	.crop {
		height: 236px;
		max-width: 760px;
		margin-top: 24px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--pane);
		overflow: hidden;
	}

	.ui {
		height: 100%;
		background: var(--pane);
	}

	.ui-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 38px;
		padding: 0 12px 0 14px;
	}

	.ui-label {
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.ui-meta {
		color: var(--txt-3);
		font-size: 10.5px;
	}

	.fav {
		display: grid;
		place-items: center;
		flex: none;
		width: 20px;
		height: 20px;
		border: 1px solid var(--line-2);
		border-radius: 5px;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 8.5px;
		line-height: 1;
	}

	/* Sources */

	.add {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 34px;
		margin: 0 10px 8px;
		padding: 0 4px 0 10px;
		border: 1px solid var(--line-2);
		border-radius: 8px;
		background: var(--raise);
	}

	.add-field {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		color: var(--txt-3);
		font-size: 11.5px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.add-btn {
		display: inline-flex;
		align-items: center;
		flex: none;
		height: 24px;
		padding: 0 10px;
		border-radius: 6px;
		background: var(--accent);
		color: var(--accent-on);
		font-size: 11.5px;
		font-weight: 500;
	}

	.src-list,
	.feed-list {
		padding: 0 8px 8px;
	}

	.src-row {
		display: flex;
		align-items: center;
		gap: 9px;
		height: 42px;
		padding: 0 6px;
	}

	.src-row + .src-row,
	.feed-row + .feed-row {
		box-shadow: inset 0 1px 0 var(--line);
	}

	.src-body {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.src-name {
		font-size: 13px;
		font-weight: 500;
		line-height: 1.35;
	}

	.src-url {
		overflow: hidden;
		color: var(--txt-3);
		font-size: 10.5px;
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.src-time {
		flex: none;
		color: var(--txt-3);
		font-size: 10.5px;
	}

	/* Timeline */

	.seg {
		display: flex;
		align-items: center;
		gap: 1px;
		padding: 2px;
		border-radius: 6px;
		background: var(--hover);
	}

	.seg span {
		display: inline-flex;
		align-items: center;
		height: 20px;
		padding: 0 6px;
		border-radius: 4px;
		color: var(--txt-3);
		font-size: 10px;
	}

	.seg .on {
		background: var(--card);
		box-shadow: inset 0 0 0 1px var(--line);
		color: var(--txt);
	}

	.feed-row {
		display: flex;
		align-items: flex-start;
		gap: 9px;
		height: 44px;
		padding: 7px 6px 0;
	}

	.feed-row .fav {
		margin-top: 1px;
	}

	.feed-body {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.feed-title {
		overflow: hidden;
		font-size: 13px;
		font-weight: 500;
		line-height: 1.4;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.feed-meta {
		overflow: hidden;
		color: var(--txt-3);
		font-size: 10.5px;
		line-height: 1.4;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.feed-time {
		flex: none;
		margin-top: 1px;
		color: var(--txt-3);
		font-size: 10.5px;
	}

	/* Summary */

	.sum {
		padding: 6px 14px 0;
	}

	.sum-title {
		display: block;
		overflow: hidden;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.4;
		letter-spacing: -0.01em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sum-text {
		max-width: 62ch;
		margin-top: 7px;
		color: var(--txt-2);
		font-size: 13.5px;
		line-height: 1.6;
	}

	.cite {
		color: var(--accent);
		font-size: 10.5px;
		vertical-align: super;
	}

	.cites {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin-top: 10px;
		padding-top: 10px;
		box-shadow: inset 0 1px 0 var(--line);
		color: var(--accent);
		font-size: 11.5px;
		line-height: 1.5;
	}

	.prov {
		margin-top: 8px;
		color: var(--txt-3);
		font-size: 10px;
		line-height: 1.5;
	}

	@media (max-width: 900px) {
		.head {
			grid-template-columns: minmax(0, 1fr);
			row-gap: 16px;
		}

		.eyebrow {
			margin-bottom: 0;
		}

		h2 {
			max-width: 20ch;
		}

		.sub {
			max-width: 60ch;
			margin-bottom: 0;
		}

		.step {
			grid-template-columns: minmax(0, 1fr);
			gap: 14px;
			padding: 36px 0;
		}

		.rail {
			padding-top: 0;
		}

		.body h3 {
			font-size: 21px;
		}

		.crop {
			height: auto;
			margin-top: 20px;
		}
	}

	@media (max-width: 760px) {
		h2 {
			font-size: 30px;
		}

		.step {
			padding: 32px 0;
		}

		.body h3 {
			font-size: 19px;
		}

		.copy {
			font-size: 14px;
		}

		.src-row,
		.feed-row {
			height: auto;
			padding-top: 9px;
			padding-bottom: 9px;
		}

		.feed-row {
			padding-top: 8px;
			padding-bottom: 8px;
		}
	}
</style>
