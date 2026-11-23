import { and, asc, desc, eq, gt, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db';
import { item } from '../db/schema';
import type { Item } from '#lib/types';
import { log } from '../log';
import { buildFtsQuery } from '../search/fts';
import {
	categoryVisibleCondition,
	loadCategoryFilter,
	promptHash,
	type CategoryFilter
} from '../categories/filter';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

/** §S13: shorter input is not a search; longer input is capped before it reaches SQL. */
export const MIN_QUERY_CHARS = 2;
export const MAX_QUERY_CHARS = 200;
export const MAX_QUERY_TOKENS = 12;

const MAX_CURSOR_LENGTH = 200;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const HEX_ID = /^[0-9a-f]{40}$/;

/** §S7 rank tuple: source_count desc, published_at desc, id asc. */
export type Cursor = { sourceCount: number; publishedAt: number; id: string };

/** §S13 search rank: higher is better, matching the feed's descending order. */
export type SearchCursor = { rank: number; publishedAt: number; id: string };

export type FeedParams = {
	from?: number;
	to?: number;
	category?: string;
	q?: string;
	cursor?: Cursor | SearchCursor;
	limit: number;
};

export type ParsedFeedQuery =
	| { ok: true; params: FeedParams }
	| { ok: false; code: string; message: string };

export function encodeCursor(cursor: Cursor): string {
	return Buffer.from(
		JSON.stringify([cursor.sourceCount, cursor.publishedAt, cursor.id]),
		'utf8'
	).toString('base64url');
}

export function decodeCursor(value: string): Cursor | null {
	if (!value || value.length > MAX_CURSOR_LENGTH || !BASE64URL.test(value)) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
	} catch {
		return null;
	}

	if (!Array.isArray(parsed) || parsed.length !== 3) return null;
	const [sourceCount, publishedAt, id] = parsed;
	if (!Number.isSafeInteger(sourceCount) || sourceCount < 1) return null;
	if (!Number.isSafeInteger(publishedAt) || publishedAt < 0) return null;
	if (typeof id !== 'string' || !HEX_ID.test(id)) return null;
	return { sourceCount: sourceCount as number, publishedAt: publishedAt as number, id };
}

export function encodeSearchCursor(cursor: SearchCursor): string {
	return Buffer.from(
		JSON.stringify([cursor.rank, cursor.publishedAt, cursor.id]),
		'utf8'
	).toString('base64url');
}

export function decodeSearchCursor(value: string): SearchCursor | null {
	if (!value || value.length > MAX_CURSOR_LENGTH || !BASE64URL.test(value)) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
	} catch {
		return null;
	}

	if (!Array.isArray(parsed) || parsed.length !== 3) return null;
	const [rank, publishedAt, id] = parsed;
	if (typeof rank !== 'number' || !Number.isFinite(rank) || rank < 0) return null;
	if (!Number.isSafeInteger(publishedAt) || publishedAt < 0) return null;
	if (typeof id !== 'string' || !HEX_ID.test(id)) return null;
	return { rank, publishedAt: publishedAt as number, id };
}

function intParam(raw: string | null): number | undefined | null {
	if (raw === null) return undefined;
	if (!/^\d+$/.test(raw)) return null;
	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : null;
}

export function parseFeedQuery(search: URLSearchParams): ParsedFeedQuery {
	const limit = intParam(search.get('limit'));
	if (limit === null || (limit !== undefined && (limit < 1 || limit > MAX_LIMIT)))
		return {
			ok: false,
			code: 'invalid_limit',
			message: `limit must be an integer from 1 to ${MAX_LIMIT}.`
		};

	const from = intParam(search.get('from'));
	if (from === null)
		return { ok: false, code: 'invalid_time', message: 'from must be milliseconds since the epoch.' };

	const to = intParam(search.get('to'));
	if (to === null)
		return { ok: false, code: 'invalid_time', message: 'to must be milliseconds since the epoch.' };

	if (from !== undefined && to !== undefined && from > to)
		return { ok: false, code: 'invalid_range', message: 'from must not be after to.' };

	const rawQuery = search.get('q');
	let q: string | undefined;
	if (rawQuery !== null) {
		// A NUL reaches FTS5 as an unterminated string. Drop it at the boundary
		// so hostile input can never turn into a 500 from the query builder.
		const trimmed = rawQuery.replace(/\u0000/g, ' ').trim();
		if (trimmed) {
			if ([...trimmed].length < MIN_QUERY_CHARS)
				return {
					ok: false,
					code: 'query_too_short',
					message: `Search needs at least ${MIN_QUERY_CHARS} characters.`
				};
			if (trimmed.length > MAX_QUERY_CHARS)
				return {
					ok: false,
					code: 'query_too_long',
					message: `Search is limited to ${MAX_QUERY_CHARS} characters.`
				};
			if (trimmed.split(/\s+/).length > MAX_QUERY_TOKENS)
				return {
					ok: false,
					code: 'too_many_terms',
					message: `Search is limited to ${MAX_QUERY_TOKENS} terms.`
				};
			q = trimmed;
		}
	}

	const rawCursor = search.get('cursor');
	let cursor: Cursor | SearchCursor | undefined;
	if (rawCursor !== null) {
		const decoded = q !== undefined ? decodeSearchCursor(rawCursor) : decodeCursor(rawCursor);
		if (!decoded) return { ok: false, code: 'invalid_cursor', message: 'Cursor is not valid.' };
		cursor = decoded;
	}

	const category = search.get('category')?.trim() || undefined;

	return { ok: true, params: { from, to, category, q, cursor, limit: limit ?? DEFAULT_LIMIT } };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const FTS_MISSING = /no such table:\s*item_fts|no such module:\s*fts5|unable to use function match/i;
const missingFts = new WeakSet<Db>();
let loggedFtsMissing = false;

function isFtsMissing(err: unknown): boolean {
	let current: unknown = err;
	for (let depth = 0; current && depth < 3; depth++) {
		if (FTS_MISSING.test(current instanceof Error ? current.message : String(current))) return true;
		current = current instanceof Error ? current.cause : undefined;
	}
	return false;
}

/**
 * §S7 keyset order and §S3 time semantics. The time filter reads the effective
 * date: a row with no publish date is filtered by when it was fetched.
 */
export async function queryFeed(
	db: Db,
	params: FeedParams
): Promise<{ items: Item[]; nextCursor: string | null }> {
	const conditions: SQL[] = [];

	if (params.from !== undefined || params.to !== undefined) {
		const effective =
			sql`case when ${item.publishedEstimated} then ${item.fetchedAt} else ${item.publishedAt} end`;
		if (params.from !== undefined) conditions.push(sql`${effective} >= ${params.from}`);
		if (params.to !== undefined) conditions.push(sql`${effective} <= ${params.to}`);
	}

	let categoryFilter: CategoryFilter | null = null;
	if (params.category) {
		categoryFilter = await loadCategoryFilter(db, params.category);
		if (!categoryFilter) return { items: [], nextCursor: null };
		const visible = categoryVisibleCondition(categoryFilter);
		if (visible) conditions.push(visible);
	}

	const base = {
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
		sourceCount: item.sourceCount,
		// §S12 rows need a stable source label for the fav badge. A multi-source
		// item picks the first name alphabetically so paging never reshuffles it.
		// The outer table must be written out: Drizzle renders ${item.id} as a
		// bare "id", which the subquery would resolve to source.id instead.
		sourceName: sql<string | null>`(
			select source.name from item_source
			join source on source.id = item_source.source_id
			where item_source.item_id = item.id
			order by source.name
			limit 1
		)`
	};

	// §S9: the reason is rendered as the row's why callout, so it is read from
	// the same cache row that admitted the item, never from a model response.
	const prompt = categoryFilter?.category.prompt?.trim();
	const withScore =
		categoryFilter !== null &&
		categoryFilter.category.matchMode !== 'keywords' &&
		Boolean(prompt);
	const selection = withScore
		? {
				...base,
				score: sql<number | null>`(
					select category_item.score from category_item
					where category_item.category_id = ${categoryFilter!.category.id}
						and category_item.item_id = item.id
						and category_item.prompt_hash = ${promptHash(prompt!)}
						and category_item.score >= ${categoryFilter!.category.aiThreshold}
					limit 1
				)`,
				reason: sql<string | null>`(
					select category_item.reason from category_item
					where category_item.category_id = ${categoryFilter!.category.id}
						and category_item.item_id = item.id
						and category_item.prompt_hash = ${promptHash(prompt!)}
						and category_item.score >= ${categoryFilter!.category.aiThreshold}
					limit 1
				)`
			}
		: base;

	if (params.q) {
		if (!missingFts.has(db)) {
			try {
				const rank = sql<number>`-bm25(item_fts, 3.0, 1.0)`;
				const where = [sql`item_fts match ${buildFtsQuery(params.q)}`, ...conditions];

				if (params.cursor && 'rank' in params.cursor) {
					const cursor = params.cursor;
					where.push(sql`(
						${rank} < ${cursor.rank}
						or (${rank} = ${cursor.rank} and ${item.publishedAt} < ${cursor.publishedAt})
						or (${rank} = ${cursor.rank} and ${item.publishedAt} = ${cursor.publishedAt} and ${item.id} > ${cursor.id})
					)`);
				}

				const ranked = await db.all<{ id: string; rank: number; publishedAt: number }>(sql`
					select ${item.id} as id, ${rank} as rank, ${item.publishedAt} as publishedAt
					from item_fts
					join item on item.rowid = item_fts.rowid
					where ${and(...where)}
					order by rank desc, ${item.publishedAt} desc, ${item.id} asc
					limit ${params.limit + 1}
				`);

				const pageIds = ranked.slice(0, params.limit).map((row) => row.id);
				const hydrated = pageIds.length
					? ((await db
							.select(selection)
							.from(item)
							.where(inArray(item.id, pageIds))
							.all()) as Item[])
					: [];
				const byId = new Map(hydrated.map((row) => [row.id, row]));
				const page = pageIds
					.map((id) => byId.get(id))
					.filter((row): row is Item => row !== undefined);
				const last = ranked[params.limit - 1];
				const nextCursor =
					ranked.length > params.limit && last
						? encodeSearchCursor({
								rank: last.rank,
								publishedAt: last.publishedAt,
								id: last.id
							})
						: null;

				return { items: page, nextCursor };
			} catch (err) {
				if (!isFtsMissing(err)) throw err;
				missingFts.add(db);
				if (!loggedFtsMissing) {
					loggedFtsMissing = true;
					log('warn', 'boot', { fts5: false, fallback: 'like' });
				}
			}
		}

		// §S13 fallback: a target without FTS5 gets the whole input as one title
		// LIKE. It is deliberately weaker than the indexed search, but never 500s.
		const pattern = `%${escapeLike(params.q)}%`;
		conditions.push(sql`${item.title} like ${pattern} escape '\\'`);
	}

	if (params.cursor && 'sourceCount' in params.cursor) {
		const { sourceCount, publishedAt, id } = params.cursor;
		const after = or(
			lt(item.sourceCount, sourceCount),
			and(eq(item.sourceCount, sourceCount), lt(item.publishedAt, publishedAt)),
			and(eq(item.sourceCount, sourceCount), eq(item.publishedAt, publishedAt), gt(item.id, id))
		);
		if (after) conditions.push(after);
	}

	const rows = (await db
		.select(selection)
		.from(item)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(item.sourceCount), desc(item.publishedAt), asc(item.id))
		.limit(params.limit + 1)
		.all()) as Item[];

	const page = rows.slice(0, params.limit);
	const last = page[page.length - 1];
	const nextCursor =
		rows.length > params.limit && last
			? encodeCursor({
					sourceCount: last.sourceCount,
					publishedAt: last.publishedAt,
					id: last.id
				})
			: null;

	return { items: page, nextCursor };
}
