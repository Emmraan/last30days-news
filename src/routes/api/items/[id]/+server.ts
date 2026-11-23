import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { asc, desc, eq } from 'drizzle-orm';
import { apiError } from '#lib/server/api';
import { item, itemSource, source, summary } from '#lib/server/db/schema';
import type { Item, Summary } from '#lib/types';

export const prerender = false;

export async function GET({ params, locals }: RequestEvent) {
	const rows: Item[] = await locals.db
		.select({
			id: item.id,
			title: item.title,
			url: item.url,
			author: item.author,
			publishedAt: item.publishedAt,
			publishedEstimated: item.publishedEstimated,
			fetchedAt: item.fetchedAt,
			excerpt: item.excerpt,
			language: item.language,
			category: item.category,
			sourceCount: item.sourceCount
		})
		.from(item)
		.where(eq(item.id, params.id))
		.limit(1)
		.all();

	const row = rows[0];
	if (!row) return apiError(404, 'not_found', 'No such item.');

	const sources = await locals.db
		.select({
			id: source.id,
			name: source.name,
			url: itemSource.url,
			rawTitle: itemSource.rawTitle
		})
		.from(itemSource)
		.innerJoin(source, eq(itemSource.sourceId, source.id))
		.where(eq(itemSource.itemId, row.id))
		.orderBy(asc(source.name))
		.all();

	// §S8 caches per (item, model); the pane shows the newest one.
	const cached: Summary[] = await locals.db
		.select({
			model: summary.model,
			body: summary.body,
			citations: summary.citations,
			createdAt: summary.createdAt
		})
		.from(summary)
		.where(eq(summary.itemId, row.id))
		.orderBy(desc(summary.createdAt), asc(summary.model))
		.limit(1)
		.all();

	return json({ item: row, sources, summary: cached[0] ?? null });
}
