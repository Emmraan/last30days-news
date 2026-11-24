<script lang="ts">
	import SectionHead from './SectionHead.svelte';

	const SPECS: { label: string; text: string; command?: string }[] = [
		{
			label: 'Time windows',
			text: '24 hours, 7 days, or the full 30-day window, switched in one click.'
		},
		{
			label: 'Categories',
			text: 'Sources, keywords, or an AI score. Rename and reorder them from the sidebar.'
		},
		{
			label: 'Cited summaries',
			text: "Every summary is built from the item's text and cites the source behind its claims."
		},
		{
			label: 'Provider-independent AI',
			text: 'OpenAI, Anthropic, Gemini, OpenRouter, Groq, DeepSeek, Ollama, LM Studio, or any compatible endpoint.'
		},
		{
			label: 'Local storage',
			text: 'Feeds, items, and settings live in SQLite: a local file by default, or your own remote database when hosted.'
		},
		{
			label: 'No-key mode',
			text: 'Fetching, filtering, search, and reading work with no AI provider configured.'
		},
		{
			label: 'Keyboard-first UI',
			text: 'Move through the timeline and the detail pane without reaching for the mouse.'
		},
		{
			label: 'One-command install',
			command: 'npx last30days-news',
			text: 'starts the app and serves it on your machine.'
		}
	];
</script>

<section id="what-you-get" class="get" aria-labelledby="get-title">
	<div class="wrap">
		<SectionHead
			eyebrow="What you get"
			title="A reader first, with AI on request."
			titleId="get-title"
			sub="The parts you use every day, and the parts that stay out of the way."
		/>

		<dl class="specs">
			{#each SPECS as spec (spec.label)}
				<div class="spec">
					<dt>{spec.label}</dt>
					<dd>
						{#if spec.command}
							<code class="mono">{spec.command}</code>
							{spec.text}
						{:else}
							{spec.text}
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	</div>
</section>

<style>
	.get {
		padding: var(--section) 0;
	}

	.specs {
		margin: 0;
		border-top: 1px solid var(--line);
	}

	.spec {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: 40px;
		padding: 22px 0;
		border-bottom: 1px solid var(--line);
	}

	dt {
		color: var(--txt);
		font-size: 14.5px;
		font-weight: 500;
		line-height: 1.5;
	}

	dd {
		max-width: 68ch;
		margin: 0;
		color: var(--txt-2);
		font-size: 14.5px;
		line-height: 1.65;
	}

	code {
		padding: 1px 5px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: var(--raise);
		color: var(--txt);
		font-size: 12.5px;
	}

	@media (max-width: 760px) {
		.spec {
			grid-template-columns: minmax(0, 1fr);
			gap: 6px;
			padding: 18px 0;
		}

		dt,
		dd {
			font-size: 14px;
		}
	}
</style>
