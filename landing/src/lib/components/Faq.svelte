<script lang="ts">
	import SectionHead from './SectionHead.svelte';

	const FAQS = [
		{
			q: 'Is my data uploaded anywhere?',
			a: 'No. Feeds, items, categories, and settings live in a SQLite database: a local file by default, or your own remote database when deployed that way. When you generate a summary, only that item’s text goes to the AI provider you configured. There is no account and no hosted copy.'
		},
		{
			q: 'Do I need an AI key?',
			a: 'No. Fetching, filtering, search, and reading work without one. A key is only needed for summaries, and local providers such as Ollama or LM Studio can run without a key.'
		},
		{
			q: 'Which AI providers work?',
			a: 'OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek, Ollama, LM Studio, and any OpenAI-compatible base URL. Keys stay on the server and are encrypted at rest.'
		},
		{
			q: 'How fresh is the feed?',
			a: 'Each source has its own fetch interval. The feeds that ship with the app run between 30 and 120 minutes, and you can refresh on demand.'
		},
		{
			q: 'Can I add my own sources?',
			a: 'Yes. Paste an RSS or Atom URL into a category and it becomes a normal source. A full source manager with per-source editing is planned for a later release.'
		},
		{
			q: 'Does it work offline?',
			a: 'Items already in the database stay readable without a connection. Fetching new items and generating summaries need a network.'
		},
		{
			q: 'How do I update it?',
			a: 'Run the install command again. The app migrates the existing database on start, so your items and categories stay in place.'
		}
	];
</script>

<section id="faq" class="faq" aria-labelledby="faq-title">
	<div class="wrap">
		<SectionHead
			eyebrow="FAQ"
			title="Answers before you install."
			titleId="faq-title"
			sub="The short version of what the app does with your data and your keys."
		/>

		<div class="list">
			{#each FAQS as item, i (item.q)}
				<details name="faq" open={i === 0}>
					<summary>
						<span class="q">{item.q}</span>
						<span class="chev mono" aria-hidden="true">+</span>
					</summary>
					<p class="a">{item.a}</p>
				</details>
			{/each}
		</div>
	</div>
</section>

<style>
	.faq {
		padding: 0 0 var(--section);
	}

	.list {
		border-top: 1px solid var(--line);
	}

	details {
		border-bottom: 1px solid var(--line);
		interpolate-size: allow-keywords;
	}

	/* The native disclosure, animated in place: no JS and no wrapper markup. */
	details::details-content {
		block-size: 0;
		overflow: hidden;
		transition:
			block-size 0.22s cubic-bezier(0.2, 0.7, 0.2, 1),
			content-visibility 0.22s allow-discrete;
	}

	details[open]::details-content {
		block-size: auto;
	}

	details[open] .a {
		animation: answer-in 0.22s cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}

	@keyframes answer-in {
		from {
			opacity: 0;
			transform: translateY(-3px);
		}

		to {
			opacity: 1;
			transform: none;
		}
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 20px 0;
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.q {
		color: var(--txt);
		font-size: 15px;
		font-weight: 500;
		line-height: 1.45;
	}

	.chev {
		flex: none;
		color: var(--txt-3);
		font-size: 16px;
		font-weight: 400;
		line-height: 1;
		transform-origin: center;
		transition:
			transform 0.22s var(--ease),
			color 0.16s var(--ease);
	}

	details[open] .chev {
		color: var(--txt-2);
		transform: rotate(45deg);
	}

	summary:hover .chev {
		color: var(--txt);
	}

	.a {
		max-width: 70ch;
		padding: 0 32px 22px 0;
		color: var(--txt-2);
		font-size: 14.5px;
		line-height: 1.7;
	}

	@media (max-width: 760px) {
		summary {
			padding: 17px 0;
		}

		.q {
			font-size: 14.5px;
		}

		.a {
			padding-bottom: 18px;
			font-size: 14px;
		}
	}
</style>
