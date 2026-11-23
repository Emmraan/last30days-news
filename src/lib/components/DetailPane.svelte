<script lang="ts">
	import { displayText, formatWhen, safeHref } from '#lib/format';
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
		ongenerate
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
	} = $props();

	function citationSource(id: string, sources: ItemSource[]): string {
		const name = sources.find((source) => source.id === id)?.name;
		return name ? displayText(name) : 'Source';
	}
</script>

<section class="pane detail-pane" aria-label="Item detail">
	<div class="pane-head">
		<h2>Detail</h2>
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
								<a href={safeHref(source.url)} target="_blank" rel="noopener noreferrer">{displayText(source.name) || 'Source'}</a>
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
						<p class="body">{displayText(detail.summary.body)}</p>

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
					{#if detail.item.excerpt}
						<p class="excerpt">{displayText(detail.item.excerpt)}</p>
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

	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 14px 16px 0;
	}

	.title {
		overflow-wrap: anywhere;
		font-size: 20px;
		line-height: 1.3;
	}

	.byline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 8px 0 0;
		color: var(--txt-3);
	}

	.byline time {
		font-family: var(--font-mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		margin-top: 12px;
	}

	.via {
		min-width: 0;
		color: var(--txt-3);
		font-size: 12px;
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
		margin-top: 12px;
		overflow-wrap: anywhere;
	}

	.summary {
		margin-top: 18px;
	}

	.summary h2 {
		margin-top: 16px;
		color: var(--txt-3);
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.summary h2:first-child {
		margin-top: 0;
	}

	.body {
		margin: 8px 0 0;
		color: var(--txt-2);
		font-size: 14px;
		line-height: 1.55;
		overflow-wrap: anywhere;
	}

	.points {
		margin: 8px 0 0;
		padding-left: 17px;
		color: var(--txt-2);
	}

	.points li {
		margin: 4px 0;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	.summary .why {
		margin-top: 8px;
		overflow-wrap: anywhere;
	}

	.cites {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 12px;
		font-size: 12px;
		line-height: 1.45;
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
		margin: 14px 0 0;
		color: var(--txt-3);
		font-size: 10px;
		line-height: 1.5;
	}

	.excerpt {
		margin: 16px 0 0;
		color: var(--txt-2);
		font-size: 14px;
		line-height: 1.55;
		overflow-wrap: anywhere;
	}

	.excerpt.muted {
		color: var(--txt-3);
	}

	.generate {
		margin-top: 14px;
	}

	.gen-error {
		margin: 8px 0 0;
		color: var(--warn);
		font-size: 12px;
		line-height: 1.45;
	}

	.scorefoot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 18px;
		padding: 8px 0 10px;
		border-top: 1px solid var(--line);
		color: var(--txt-3);
		font-size: 12px;
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
		gap: 10px;
		padding: 16px;
		color: var(--txt-2);
		font-size: 13px;
	}

	.detail-error p {
		margin: 0;
	}
</style>
