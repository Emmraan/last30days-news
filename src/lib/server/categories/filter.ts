import { createHash } from 'node:crypto';
import { eq, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db';
import { category, categorySource, item } from '../db/schema';
import { keywordGlob } from '../feed/keywords';

export type CategoryRow = typeof category.$inferSelect;

export type CategoryFilter = {
	category: CategoryRow;
	sourceIds: string[];
};

/** §S8: scores belong to a prompt, so editing it changes the cache key. */
export function promptHash(prompt: string): string {
	return createHash('sha1').update(prompt).digest('hex');
}

export async function loadCategoryFilter(
	db: Db,
	categoryId: string
): Promise<CategoryFilter | null> {
	const row = await db.select().from(category).where(eq(category.id, categoryId)).get();
	if (!row) return null;
	const links = await db
		.select({ sourceId: categorySource.sourceId })
		.from(categorySource)
		.where(eq(categorySource.categoryId, categoryId))
		.all();
	return { category: row, sourceIds: links.map((link) => link.sourceId) };
}

/**
 * §S4 candidate pool. Seeded categories keep `item.category` as their primary
 * category and cannot be edited, so that indexed column is both cheaper and
 * equivalent to their pinned source list. A user category may draw from any
 * source, so membership is checked through `item_source`.
 */
export function categoryPoolCondition(filter: CategoryFilter): SQL | undefined {
	if (filter.category.builtin) return eq(item.category, filter.category.id);
	if (filter.sourceIds.length === 0) return undefined;

	const ids = sql.join(
		filter.sourceIds.map((id) => sql`${id}`),
		sql`, `
	);
	return sql`exists (
		select 1 from item_source
		where item_source.item_id = ${item.id} and item_source.source_id in (${ids})
	)`;
}

export function categoryKeywordCondition(keywords: string[]): SQL | undefined {
	const patterns = keywords
		.map((keyword) => keyword.trim())
		.filter(Boolean)
		.map(keywordGlob);
	if (patterns.length === 0) return undefined;

	// json_each keeps a 10k-keyword category from turning into a 10k-deep OR
	// tree that SQLite rejects before it can return a row.
	return sql`exists (
		select 1 from json_each(${JSON.stringify(patterns)}) as kw
		where lower(' ' || ${item.title} || ' ') glob kw.value
			or lower(' ' || coalesce(${item.excerpt}, '') || ' ') glob kw.value
	)`;
}

export function categoryScoreCondition(row: CategoryRow): SQL | undefined {
	const prompt = row.prompt?.trim();
	if (!prompt) return undefined;
	return sql`exists (
		select 1 from category_item
		where category_item.category_id = ${row.id}
			and category_item.item_id = ${item.id}
			and category_item.prompt_hash = ${promptHash(prompt)}
			and category_item.score >= ${row.aiThreshold}
	)`;
}

/** §S4: source pool AND (keyword OR score), with every missing layer inert. */
export function categoryVisibleCondition(filter: CategoryFilter): SQL | undefined {
	const pool = categoryPoolCondition(filter);
	const keyword = categoryKeywordCondition(filter.category.keywords);
	const score = categoryScoreCondition(filter.category);

	let mode: SQL | undefined;
	if (filter.category.matchMode === 'keywords') mode = keyword;
	else if (filter.category.matchMode === 'ai') mode = score ?? sql`0`;
	else if (keyword && score) mode = sql`(${keyword}) or (${score})`;
	else mode = keyword ?? score;

	// `both` contains an OR. Without explicit grouping SQL would read this as
	// `(pool AND keyword) OR score` and leak scored items from other sources.
	if (pool && mode) return sql`(${pool}) and (${mode})`;
	return pool ?? mode;
}
