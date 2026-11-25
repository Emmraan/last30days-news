<script lang="ts">
	import { resolve } from '$app/paths';
	import { REPO_URL } from '#lib/site';
	import Logo from './Logo.svelte';
</script>

<footer class="foot">
	<div class="wrap">
		<div class="top">
			<div class="brand-col">
				<button class="brand" type="button" data-scroll="top">
					<Logo />
					<span class="wordmark">last30days-news</span>
				</button>
				<p class="desc">
					One reading list for the last 30 days. Local-first, with cited summaries when you ask.
				</p>
			</div>

			<nav class="col" aria-labelledby="foot-product">
				<h3 id="foot-product" class="mono">Product</h3>
				<button type="button" data-scroll="how">How it works</button>
				<button type="button" data-scroll="what-you-get">What you get</button>
				<button type="button" data-scroll="sources">Sources</button>
				<button type="button" data-scroll="faq">FAQ</button>
			</nav>

			<nav class="col" aria-labelledby="foot-developers">
				<h3 id="foot-developers" class="mono">Developers</h3>
				<a href={resolve('/docs')}>Documentation</a>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external repo, not an app route -->
				<a href={REPO_URL}>Source code</a>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external repo, not an app route -->
				<a href={`${REPO_URL}/releases`}>Releases</a>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external repo, not an app route -->
				<a href={`${REPO_URL}/issues`}>Issues</a>
			</nav>

			<nav class="col" aria-labelledby="foot-legal">
				<h3 id="foot-legal" class="mono">Legal</h3>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external licence page, not an app route -->
				<a href="https://opensource.org/license/mit">MIT licence</a>
				<span class="plain">No tracking</span>
			</nav>

			<div class="col install">
				<h3 class="mono">Install</h3>
				<span class="cmd mono">npx last30days-news</span>
			</div>
		</div>

		<div class="bottom">
			<span>MIT licence</span>
			<span class="note">No account. No tracking.</span>
		</div>
	</div>
</footer>

<style>
	.foot {
		background: var(--side);
		box-shadow: inset 0 1px 0 var(--line);
	}

	.top {
		display: grid;
		grid-template-columns: minmax(220px, 1.25fr) auto auto auto auto;
		column-gap: 40px;
		padding: 52px 0 44px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}

	.brand:hover .wordmark {
		color: var(--txt);
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
		transition: color 0.14s ease;
	}

	.desc {
		max-width: 30ch;
		margin-top: 14px;
		color: var(--txt-3);
		font-size: 13px;
		line-height: 1.6;
	}

	.col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 7px;
	}

	.col h3 {
		margin: 0 0 4px;
		color: var(--txt-3);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.col a,
	.col button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--txt-2);
		font: inherit;
		font-size: 13px;
		line-height: 1.4;
		text-align: left;
		cursor: pointer;
	}

	.col a:hover,
	.col button:hover {
		color: var(--txt);
	}

	.plain {
		color: var(--txt-3);
		font-size: 13px;
		line-height: 1.4;
	}

	.cmd {
		display: inline-block;
		padding: 6px 9px;
		border: 1px solid var(--line-2);
		border-radius: 7px;
		background: var(--raise);
		color: var(--txt-2);
		font-size: 11px;
		line-height: 1.4;
		white-space: nowrap;
	}

	.bottom {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 18px;
		padding: 15px 0 20px;
		box-shadow: inset 0 1px 0 var(--line);
		color: var(--txt-3);
		font-size: 11.5px;
	}

	.note {
		margin-left: auto;
	}

	@media (max-width: 900px) {
		.top {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			row-gap: 32px;
		}

		.brand-col {
			grid-column: 1 / -1;
		}

		.install {
			grid-column: 1 / -1;
		}

		.desc {
			max-width: 46ch;
		}
	}

	@media (max-width: 560px) {
		.top {
			column-gap: 20px;
			padding: 40px 0 34px;
		}

		.col a,
		.col button,
		.plain {
			font-size: 12.5px;
		}

		.note {
			margin-left: 0;
		}
	}
</style>
