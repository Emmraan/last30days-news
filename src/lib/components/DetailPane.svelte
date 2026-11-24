<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import { displayParagraphs, displayText, formatWhen, safeHref } from '#lib/format';
	import type { ItemDetail, ItemSource } from '#lib/types';
	import Empty from './Empty.svelte';
	import Skeleton from './Skeleton.svelte';

	let {
		state,
		detail,
		error,
		categoryName,
		now,
		generating,
		generateError,
		onretry,
		ongenerate,
		onback
	}: {
		state: 'idle' | 'loading' | 'error' | 'ready';
		detail: ItemDetail | null;
		error: string;
		categoryName: string;
		now: number;
		generating: boolean;
		generateError: string;
		onretry: () => void;
		ongenerate: () => void;
		onback?: () => void;
	} = $props();

	function citationSource(id: string, sources: ItemSource[]): string {
		const name = sources.find((source) => source.id === id)?.name;
		return name ? displayText(name) : 'Source';
	}
</script>

<section class="pane detail-pane" aria-label="Item detail">
	<div class="pane-head">
		<div class="head-start">
			{#if onback}
				<button
					class="iconbtn back"
					type="button"
					aria-label="Back to feed"
					title="Back to feed"
					onclick={onback}
				>
					<ArrowLeft size={17} aria-hidden="true" />
				</button>
			{/if}
			<h2>Detail</h2>
		</div>
	</div>

	{#if state === 'idle'}
		<Empty text="Select an item to read it." />
	{:else if state === 'loading'}
		<div class="scroll">
			<Skeleton variant="detail" />
		</div>
	{:else if state === 'error' || !detail}
		<div class="detail-error" role="alert">
			<p>{error}</p>
			<button class="btn" type="button" onclick={onretry}>Try again</button>
		</div>
	{:else}
		<div class="scroll">
			<article class="article">
				<h1 class="title">{displayText(detail.item.title) || 'Untitled'}</h1>

				<p class="byline">
					<time datetime={new Date(detail.item.publishedAt).toISOString()}>
						{formatWhen(detail.item.publishedAt, now, detail.item.publishedEstimated)}
					</time>
					{#if detail.item.publishedEstimated}
						<span class="tag">estimated</span>
					{/if}
					{#if detail.item.author}
						<span class="author">{displayText(detail.item.author)}</span>
					{/if}
					<span class="tag">{displayText(categoryName) || detail.item.category}</span>
				</p>

				<div class="actions">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external article URL, not an app route -->
					<a class="btn" href={safeHref(detail.item.url)} target="_blank" rel="noopener noreferrer">
						Open original
					</a>
					{#if detail.sources.length}
						<span class="via">
							via
							{#each detail.sources as source, index (source.id)}
								{#if index > 0}<span aria-hidden="true">, </span>{/if}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external source URL, not an app route -->
								<a href={safeHref(source.url)} target="_blank" rel="noopener noreferrer">
									{displayText(source.name) || 'Source'}
								</a>
							{/each}
						</span>
					{/if}
				</div>

				{#if detail.item.reason}
					<div class="why item-reason">{displayText(detail.item.reason)}</div>
				{/if}

				{#if detail.summary}
					<section class="summary" aria-label="Summary">
						<h2>Summary</h2>
						<div class="body prose">
							{#each displayParagraphs(detail.summary.body) as paragraph, index (index)}
								<p>{paragraph}</p>
							{/each}
						</div>

						{#if detail.summary.keyPoints.length}
							<h2>Key points</h2>
							<ul class="points">
								{#each detail.summary.keyPoints as point, index (index)}
									<li>{displayText(point)}</li>
								{/each}
							</ul>
						{/if}

						{#if detail.summary.whyItMatters}
							<h2>Why it matters</h2>
							<p class="why">{displayText(detail.summary.whyItMatters)}</p>
						{/if}

						{#if detail.summary.citations.length}
							<div class="cites" aria-label="Citations">
								{#each detail.summary.citations as citation (citation.n)}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external citation URL, not an app route -->
									<a href={safeHref(citation.url)} target="_blank" rel="noopener noreferrer">
										[{citation.n}] {citationSource(citation.source_id, detail.sources)}
									</a>
								{/each}
							</div>
						{/if}

						<p class="provenance mono">
							{displayText(detail.summary.model)} · {formatWhen(detail.summary.createdAt, now)}
						</p>
					</section>
				{:else}
					<div class="excerpt-block">
						<h2 class="label">Excerpt</h2>
						{#if displayParagraphs(detail.item.excerpt).length}
							<div class="excerpt prose">
								{#each displayParagraphs(detail.item.excerpt) as paragraph, index (index)}
									<p>{paragraph}</p>
								{/each}
							</div>
						{:else}
							<p class="excerpt muted">No excerpt saved for this item.</p>
						{/if}

						<div class="generate">
							<button class="btn" type="button" disabled={generating} onclick={ongenerate}>
								{generating ? 'Generating...' : 'Generate summary'}
							</button>
							{#if generateError}
								<p class="gen-error" role="alert">{generateError}</p>
							{/if}
						</div>
					</div>
				{/if}
			</article>

			{#if detail.item.score !== undefined && detail.item.score !== null}
				<footer class="scorefoot">
					<span>Relevance</span>
					<span class="mono">{detail.item.score.toFixed(2)}</span>
				</footer>
			{/if}
		</div>
	{/if}
</section>

<style>
	.pane-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex: none;
		height: 52px;
		padding: 0 18px;
		box-shadow: none;
	}

	.head-start {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.back {
		display: none;
		margin-left: -8px;
	}

	.pane-head h2 {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--txt-3);
	}

	.scroll {
		flex: 1;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
		scrollbar-gutter: stable;
		padding: 8px 24px 32px;
	}

	.article {
		max-width: 70ch;
		animation: detail-in 180ms var(--ease) both;
	}

	.title {
		overflow-wrap: break-word;
		text-wrap: pretty;
		font-size: 23px;
		font-weight: 600;
		line-height: 1.32;
		letter-spacing: -0.015em;
	}

	.byline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 7px;
		margin: 10px 0 0;
		color: var(--txt-3);
		font-size: 12px;
	}

	.byline time {
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-variant-numeric: tabular-nums;
	}

	.author {
		min-width: 0;
		max-width: 100%;
		color: var(--txt-2);
		overflow-wrap: break-word;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
		margin-top: 16px;
	}

	.via {
		min-width: 0;
		color: var(--txt-3);
		font-size: 12.5px;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	.via a {
		color: var(--txt-2);
		text-decoration: underline;
		text-decoration-color: var(--line-2);
		text-underline-offset: 2px;
	}

	.via a:hover {
		color: var(--accent);
	}

	.item-reason {
		margin-top: 16px;
		overflow-wrap: break-word;
	}

	.summary {
		margin-top: 24px;
		padding-top: 20px;
		box-shadow: inset 0 1px 0 var(--line);
	}

	.summary h2 {
		margin-top: 20px;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.summary h2:first-child {
		margin-top: 0;
	}

	.prose {
		overflow-wrap: break-word;
		text-wrap: pretty;
	}

	.prose p {
		margin: 0;
	}

	.prose p + p {
		margin-top: 10px;
	}

	.body {
		margin-top: 9px;
		color: var(--txt-2);
		font-size: 15px;
		line-height: 1.68;
	}

	.points {
		margin: 9px 0 0;
		padding-left: 19px;
		color: var(--txt-2);
	}

	.points li {
		margin: 6px 0;
		font-size: 14.5px;
		line-height: 1.62;
		overflow-wrap: break-word;
	}

	.summary .why {
		margin-top: 9px;
		font-size: 14.5px;
		line-height: 1.65;
	}

	.cites {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 16px;
		font-size: 12.5px;
		line-height: 1.5;
	}

	.cites a {
		color: var(--accent);
		overflow-wrap: anywhere;
	}

	.cites a:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.provenance {
		margin: 18px 0 0;
		color: var(--txt-3);
		font-size: 10.5px;
		line-height: 1.5;
	}

	.excerpt {
		margin-top: 9px;
		max-width: 66ch;
		color: var(--txt-2);
		font-size: 15px;
		line-height: 1.72;
	}

	.excerpt-block {
		margin-top: 24px;
		padding-top: 20px;
		box-shadow: inset 0 1px 0 var(--line);
	}

	.label {
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.excerpt.muted {
		color: var(--txt-3);
	}

	.generate {
		margin-top: 16px;
	}

	.gen-error {
		margin: 10px 0 0;
		color: var(--warn);
		font-size: 12.5px;
		line-height: 1.5;
	}

	.scorefoot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 20px;
		padding: 10px 0 12px;
		border-top: 1px solid var(--line);
		color: var(--txt-3);
		font-size: 12.5px;
		line-height: 1.4;
	}

	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.detail-error {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 20px;
		color: var(--txt-2);
		font-size: 13.5px;
		line-height: 1.5;
	}

	.detail-error p {
		margin: 0;
	}

	@keyframes detail-in {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (max-width: 760px) {
		.pane-head {
			padding: 0 12px;
		}

		.back {
			display: inline-grid;
		}

		.scroll {
			padding: 8px 16px 24px;
			scrollbar-gutter: auto;
		}

		.title {
			font-size: 21px;
		}

		.summary {
			margin-top: 20px;
			padding-top: 16px;
		}

		.excerpt-block {
			margin-top: 20px;
			padding-top: 16px;
		}
	}
</style>
