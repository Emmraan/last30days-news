<script lang="ts">
	import SectionHead from './SectionHead.svelte';

	const GROUPS = [
		{
			label: 'Technology',
			items: [
				{ name: 'Hacker News', domain: 'news.ycombinator.com' },
				{ name: 'Ars Technica', domain: 'arstechnica.com' },
				{ name: 'The Verge', domain: 'theverge.com' }
			]
		},
		{
			label: 'AI',
			items: [
				{ name: 'MIT Technology Review', domain: 'technologyreview.com' },
				{ name: 'TechCrunch AI', domain: 'techcrunch.com' },
				{ name: 'Hugging Face Blog', domain: 'huggingface.co' }
			]
		}
	];
</script>

<section id="sources" class="sources" aria-labelledby="sources-title">
	<div class="wrap">
		<SectionHead
			eyebrow="Sources"
			title="Start with a list you can trust."
			titleId="sources-title"
			sub="The curated set ships with the app. Any RSS or Atom feed can be added to a category."
		/>

		<div class="groups">
			{#each GROUPS as group (group.label)}
				<div class="group">
					<span class="g-label mono">{group.label}</span>
					<div class="badges">
						{#each group.items as item (item.domain)}
							<span class="badge">
								<span class="b-name">{item.name}</span>
								<span class="b-domain mono">{item.domain}</span>
							</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.sources {
		padding: 0 0 var(--section);
	}

	.groups {
		border-top: 1px solid var(--line);
	}

	.group {
		display: grid;
		grid-template-columns: 132px minmax(0, 1fr);
		gap: 52px;
		padding: 26px 0;
	}

	.group + .group {
		border-top: 1px solid var(--line);
	}

	.g-label {
		padding-top: 13px;
		color: var(--txt-3);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.badge {
		display: inline-flex;
		flex-direction: column;
		justify-content: center;
		min-width: 148px;
		height: 44px;
		padding: 0 13px;
		border: 1px solid var(--line-2);
		border-radius: 9px;
		background: var(--raise);
	}

	.b-name {
		color: var(--txt);
		font-size: 12.5px;
		font-weight: 500;
		line-height: 1.35;
	}

	.b-domain {
		color: var(--txt-3);
		font-size: 10px;
		line-height: 1.35;
	}

	@media (max-width: 760px) {
		.group {
			grid-template-columns: minmax(0, 1fr);
			gap: 14px;
			padding: 22px 0;
		}

		.g-label {
			padding-top: 0;
		}

		.badge {
			flex: 1 1 148px;
		}
	}
</style>
