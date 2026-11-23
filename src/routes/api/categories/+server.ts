import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { asc, inArray } from 'drizzle-orm';
import { apiError, readJson } from '#lib/server/api';
import { category, categorySource, source } from '#lib/server/db/schema';
import { cleanKeywords, cleanSourceIds, createCategoryBody } from '#lib/server/categories/input';
import {
	categoryViewById,
	categoryViews,
	nameTaken,
	nextSortOrder,
	slugId
} from '#lib/server/categories/store';

export const prerender = false;

export async function GET({ locals }: RequestEvent) {
	const rows = await locals.db
		.select()
		.from(category)
		.orderBy(asc(category.sortOrder), asc(category.id))
		.all();
	return json({ categories: await categoryViews(locals.db, rows) });
}

export async function POST({ request, locals }: RequestEvent) {
	const parsed = await readJson(request, createCategoryBody);
	if (!parsed.ok) return parsed.response;
	const data = parsed.data;

	if (data.matchMode === 'ai' && !data.prompt)
		return apiError(400, 'prompt_required', 'An AI category needs a prompt.');
	if (await nameTaken(locals.db, data.name))
		return apiError(409, 'name_taken', 'That category name is already in use.');

	const sourceIds = cleanSourceIds(data.sourceIds);
	if (sourceIds.length) {
		const found = await locals.db
			.select({ id: source.id })
			.from(source)
			.where(inArray(source.id, sourceIds))
			.all();
		if (found.length !== sourceIds.length)
			return apiError(400, 'invalid_source', 'One of those sources no longer exists.');
	}

	const ids = new Set(
		(await locals.db.select({ id: category.id }).from(category).all()).map((row) => row.id)
	);
	const id = slugId(data.name, ids);
	const createdAt = Date.now();
	const sortOrder = await nextSortOrder(locals.db);

	await locals.db.transaction(async (tx) => {
		await tx.insert(category).values({
			id,
			name: data.name,
			builtin: false,
			matchMode: data.matchMode,
			keywords: cleanKeywords(data.keywords),
			prompt: data.prompt,
			aiThreshold: data.aiThreshold,
			sortOrder,
			createdAt
		});
		if (sourceIds.length)
			await tx
				.insert(categorySource)
				.values(sourceIds.map((sourceId) => ({ categoryId: id, sourceId })));
	});

	return json({ category: await categoryViewById(locals.db, id) }, { status: 201 });
}
