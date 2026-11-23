import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { asc, eq, inArray } from 'drizzle-orm';
import { apiError, readJson } from '#lib/server/api';
import { category, categorySource, item, source } from '#lib/server/db/schema';
import { cleanKeywords, cleanSourceIds, patchCategoryBody } from '#lib/server/categories/input';
import { categoryViewById, nameTaken } from '#lib/server/categories/store';

export const prerender = false;

export async function PATCH({ params, request, locals }: RequestEvent) {
	const parsed = await readJson(request, patchCategoryBody);
	if (!parsed.ok) return parsed.response;
	const data = parsed.data;

	const row = await locals.db.select().from(category).where(eq(category.id, params.id)).get();
	if (!row) return apiError(404, 'not_found', 'No such category.');
	if (row.builtin)
		return apiError(403, 'builtin_category', 'Builtin categories cannot be changed.');

	if (data.name !== undefined && (await nameTaken(locals.db, data.name, row.id)))
		return apiError(409, 'name_taken', 'That category name is already in use.');

	const nextMode = data.matchMode ?? row.matchMode;
	const nextPrompt = data.prompt === undefined ? row.prompt : data.prompt;
	if (nextMode === 'ai' && !nextPrompt)
		return apiError(400, 'prompt_required', 'An AI category needs a prompt.');

	const sourceIds = data.sourceIds === undefined ? undefined : cleanSourceIds(data.sourceIds);
	if (sourceIds?.length) {
		const found = await locals.db
			.select({ id: source.id })
			.from(source)
			.where(inArray(source.id, sourceIds))
			.all();
		if (found.length !== sourceIds.length)
			return apiError(400, 'invalid_source', 'One of those sources no longer exists.');
	}

	await locals.db.transaction(async (tx) => {
		await tx
			.update(category)
			.set({
				name: data.name ?? row.name,
				matchMode: nextMode,
				keywords: data.keywords === undefined ? row.keywords : cleanKeywords(data.keywords),
				prompt: nextPrompt,
				aiThreshold: data.aiThreshold ?? row.aiThreshold
			})
			.where(eq(category.id, row.id));

		if (sourceIds !== undefined) {
			await tx.delete(categorySource).where(eq(categorySource.categoryId, row.id));
			if (sourceIds.length)
				await tx
					.insert(categorySource)
					.values(sourceIds.map((sourceId) => ({ categoryId: row.id, sourceId })));
		}
	});

	return json({ category: await categoryViewById(locals.db, row.id) });
}

export async function DELETE({ params, locals }: RequestEvent) {
	const row = await locals.db.select().from(category).where(eq(category.id, params.id)).get();
	if (!row) return apiError(404, 'not_found', 'No such category.');
	if (row.builtin)
		return apiError(403, 'builtin_category', 'Builtin categories cannot be deleted.');

	// A source's category is required, so a deleted custom category moves its
	// sources into the first builtin and disables them rather than cascading.
	const fallback = await locals.db
		.select({ id: category.id })
		.from(category)
		.where(eq(category.builtin, true))
		.orderBy(asc(category.sortOrder))
		.limit(1)
		.get();
	if (!fallback) return apiError(409, 'no_fallback', 'No builtin category is available.');

	await locals.db.transaction(async (tx) => {
		await tx
			.update(source)
			.set({ category: fallback.id, enabled: false })
			.where(eq(source.category, row.id));
		await tx.update(item).set({ category: fallback.id }).where(eq(item.category, row.id));
		await tx.delete(category).where(eq(category.id, row.id));
	});

	return json({ ok: true });
}
