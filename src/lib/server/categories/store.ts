import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { category, categorySource, item } from '../db/schema';
import {
	categoryVisibleCondition,
	loadCategoryFilter,
	type CategoryFilter,
	type CategoryRow
} from './filter';

export type CategoryView = {
	id: string;
	name: string;
	builtin: boolean;
	matchMode: CategoryRow['matchMode'];
	keywords: string[];
	prompt: string | null;
	aiThreshold: number;
	sortOrder: number;
	createdAt: number;
	keywordCount: number;
	itemCount: number;
	hasPrompt: boolean;
	sourceIds: string[];
};

async function countItems(db: Db, filter: CategoryFilter): Promise<number> {
	const condition = categoryVisibleCondition(filter);
	const row = await db
		.select({ count: sql<number>`count(*)` })
		.from(item)
		.where(condition)
		.get();
	return row?.count ?? 0;
}

export async function categoryView(db: Db, filter: CategoryFilter): Promise<CategoryView> {
	return {
		id: filter.category.id,
		name: filter.category.name,
		builtin: filter.category.builtin,
		matchMode: filter.category.matchMode,
		keywords: filter.category.keywords,
		prompt: filter.category.prompt,
		aiThreshold: filter.category.aiThreshold,
		sortOrder: filter.category.sortOrder,
		createdAt: filter.category.createdAt,
		keywordCount: filter.category.keywords.filter((keyword) => keyword.trim()).length,
		itemCount: await countItems(db, filter),
		hasPrompt: Boolean(filter.category.prompt?.trim()),
		sourceIds: filter.sourceIds
	};
}

export async function categoryViews(db: Db, rows: CategoryRow[]): Promise<CategoryView[]> {
	const links = await db
		.select({ categoryId: categorySource.categoryId, sourceId: categorySource.sourceId })
		.from(categorySource)
		.orderBy(asc(categorySource.sourceId))
		.all();
	const byCategory = new Map<string, string[]>();
	for (const link of links) {
		const list = byCategory.get(link.categoryId) ?? [];
		list.push(link.sourceId);
		byCategory.set(link.categoryId, list);
	}
	return Promise.all(
		rows.map((row) =>
			categoryView(db, { category: row, sourceIds: byCategory.get(row.id) ?? [] })
		)
	);
}

export async function categoryViewById(db: Db, id: string): Promise<CategoryView | null> {
	const filter = await loadCategoryFilter(db, id);
	return filter ? categoryView(db, filter) : null;
}

/** §S4: names are unique after case-folding, including against builtins. */
export async function nameTaken(db: Db, name: string, exceptId?: string): Promise<boolean> {
	const wanted = name.trim().toLowerCase();
	const rows = await db.select({ id: category.id, name: category.name }).from(category).all();
	return rows.some((row) => row.id !== exceptId && row.name.trim().toLowerCase() === wanted);
}

export function slugId(name: string, taken: Set<string>): string {
	const ascii = name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
	const slug = ascii
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 32);
	const base = `usr-${slug || 'category'}`;
	if (!taken.has(base)) return base;
	for (let suffix = 2; ; suffix++) {
		const candidate = `${base}-${suffix}`;
		if (!taken.has(candidate)) return candidate;
	}
}

export async function nextSortOrder(db: Db): Promise<number> {
	const row = await db.select({ max: sql<number | null>`max(sort_order)` }).from(category).get();
	return (row?.max ?? 0) + 1;
}

export async function categoryExists(db: Db, id: string): Promise<boolean> {
	return Boolean(await db.select({ id: category.id }).from(category).where(eq(category.id, id)).get());
}
