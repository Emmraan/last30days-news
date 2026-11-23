import { createHash, randomBytes } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { apiError, readJson } from '#lib/server/api';
import { category, categorySource, source } from '#lib/server/db/schema';
import { probeFeed } from '#lib/server/sources/probe';

export const prerender = false;

const createBody = z
	.object({
		url: z.string().trim().min(1).max(2048),
		name: z.string().trim().min(1).max(120).optional(),
		categoryId: z.string().trim().min(1),
		intervalMin: z.number().int().min(1).max(1440).default(60)
	})
	.strict();

const view = (row: typeof source.$inferSelect) => ({
	id: row.id,
	name: row.name,
	kind: row.kind,
	url: row.url,
	category: row.category,
	enabled: row.enabled,
	fetchIntervalMin: row.fetchIntervalMin,
	lastFetchedAt: row.lastFetchedAt,
	lastStatus: row.lastStatus,
	lastError: row.lastError
});

export async function GET({ locals }: RequestEvent) {
	const rows = await locals.db.select().from(source).all();
	return json({ sources: rows.map(view) });
}

export async function POST({ request, fetch, locals }: RequestEvent) {
	const parsed = await readJson(request, createBody);
	if (!parsed.ok) return parsed.response;
	const data = parsed.data;

	const target = await locals.db
		.select({ id: category.id, name: category.name })
		.from(category)
		.where(eq(category.id, data.categoryId))
		.get();
	if (!target) return apiError(404, 'not_found', 'No such category.');

	const existing = await locals.db
		.select({ id: source.id })
		.from(source)
		.where(eq(source.url, data.url))
		.get();
	if (existing) return apiError(409, 'source_exists', 'That feed is already added.');

	const probe = await probeFeed(data.url, { fetch });
	if (!probe.ok) return apiError(400, probe.code, probe.message);

	const name = data.name ?? probe.feedTitle ?? new URL(data.url).hostname;
	const idBase = `src-${createHash('sha1').update(data.url).digest('hex').slice(0, 12)}`;
	let id = idBase;
	if (await locals.db.select({ id: source.id }).from(source).where(eq(source.id, id)).get())
		id = `${idBase}-${randomBytes(3).toString('hex')}`;

	const row: typeof source.$inferSelect = {
		id,
		name,
		kind: probe.kind,
		url: data.url,
		category: data.categoryId,
		enabled: true,
		fetchIntervalMin: data.intervalMin,
		lastFetchedAt: null,
		lastStatus: null,
		lastError: null,
		createdAt: Date.now()
	};

	await locals.db.transaction(async (tx) => {
		await tx.insert(source).values(row);
		await tx
			.insert(categorySource)
			.values({ categoryId: data.categoryId, sourceId: id })
			.onConflictDoNothing();
	});

	return json({ source: view(row) }, { status: 201 });
}
