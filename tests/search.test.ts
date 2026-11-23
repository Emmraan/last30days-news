import { expect, test } from 'vitest';
import { sql } from 'drizzle-orm';
import type { Db } from '#lib/server/db';
import { seed } from '#lib/server/db/seed';
import { item } from '#lib/server/db/schema';
import {
	decodeSearchCursor,
	queryFeed,
	type FeedParams,
	type SearchCursor
} from '#lib/server/feed/query';
import { freshDb } from './helper';

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const idFor = (i: number) => i.toString(16).padStart(40, '0');

type Row = {
	id: string;
	title: string;
	url: string;
	author: string | null;
	publishedAt: number;
	publishedEstimated: boolean;
	fetchedAt: number;
	excerpt: string | null;
	language: string | null;
	category: string;
	sourceCount: number;
};

function makeRow(i: number, patch: Partial<Row> = {}): Row {
	return {
		id: idFor(i),
		title: `Story ${i}`,
		url: `https://example.com/${i}`,
		author: null,
		publishedAt: T0 - i * 60_000,
		publishedEstimated: false,
		fetchedAt: T0 - i * 60_000,
		excerpt: null,
		language: 'en',
		category: 'technology',
		sourceCount: 1,
		...patch
	};
}

async function fill(db: Db, rows: Row[]) {
	for (let i = 0; i < rows.length; i += 500) await db.insert(item).values(rows.slice(i, i + 500));
}

async function ids(db: Db, params: FeedParams) {
	return (await queryFeed(db, params)).items.map((entry) => entry.id);
}

async function collect(db: Db, params: FeedParams, limit: number) {
	const seen: string[] = [];
	const durations: number[] = [];
	let cursor: SearchCursor | undefined;

	for (let pages = 0; pages < 1000; pages++) {
		const start = performance.now();
		const page = await queryFeed(db, { ...params, limit, cursor });
		durations.push(performance.now() - start);
		seen.push(...page.items.map((entry) => entry.id));
		if (!page.nextCursor) return { seen, durations, pages: pages + 1 };
		cursor = decodeSearchCursor(page.nextCursor)!;
	}

	throw new Error('cursor never terminated');
}

test('a multi-token search is ANDed across title and excerpt, case-insensitively', async () => {
	const { db } = await freshDb();
	await seed(db);
	await fill(db, [
		makeRow(11, { title: 'Alpha gamma', excerpt: null }),
		makeRow(12, { title: 'Alpha only', excerpt: 'beta lives here' }),
		makeRow(13, { title: 'Unrelated', excerpt: null })
	]);

	expect(await ids(db, { q: 'alpha', limit: 50 })).toEqual([idFor(11), idFor(12)]);
	expect(await ids(db, { q: 'ALPHA', limit: 50 })).toEqual([idFor(11), idFor(12)]);
	expect(await ids(db, { q: 'alpha gamma', limit: 50 })).toEqual([idFor(11)]);
	expect(await ids(db, { q: 'alpha beta', limit: 50 })).toEqual([idFor(12)]);
	expect(await ids(db, { q: 'missing', limit: 50 })).toEqual([]);
});

test('a title hit outranks an excerpt hit', async () => {
	const { db } = await freshDb();
	await seed(db);
	await fill(db, [
		makeRow(21, {
			title: 'needle appears',
			excerpt: 'padding padding',
			publishedAt: T0 - HOUR,
			fetchedAt: T0 - HOUR
		}),
		makeRow(22, {
			title: 'padding padding',
			excerpt: 'needle appears',
			publishedAt: T0 - 2 * HOUR,
			fetchedAt: T0 - 2 * HOUR
		})
	]);

	expect(await ids(db, { q: 'needle', limit: 50 })).toEqual([idFor(21), idFor(22)]);
});

test('FTS operators in the input are quoted literals, not syntax', async () => {
	const { db } = await freshDb();
	await seed(db);
	await fill(db, [
		makeRow(41, { title: 'NEAR * ^ "quoted": literal' }),
		makeRow(42, { title: 'Ordinary story' })
	]);

	expect(await ids(db, { q: 'NEAR', limit: 50 })).toEqual([idFor(41)]);
	expect(await ids(db, { q: 'NEAR OR story', limit: 50 })).toEqual([]);
	expect(await ids(db, { q: 'quoted:', limit: 50 })).toEqual([idFor(41)]);
	expect(await ids(db, { q: '^ quoted:', limit: 50 })).toEqual([]);
	expect(await ids(db, { q: `' OR 1=1 --`, limit: 50 })).toEqual([]);
	expect((await queryFeed(db, { category: `' OR 1=1 --`, limit: 50 })).items).toEqual([]);
});

test('search results paginate in rank order without duplicates or gaps', async () => {
	const { db } = await freshDb();
	await seed(db);

	const rows = Array.from({ length: 25 }, (_, i) =>
		makeRow(i, {
			title: `alpha ${i} ${'padding '.repeat(i % 4)}`,
			excerpt: i % 3 === 0 ? 'alpha in the excerpt' : null
		})
	);
	await fill(db, rows);

	const all = await ids(db, { q: 'alpha', limit: 100 });
	expect(all).toHaveLength(rows.length);

	const { seen, pages } = await collect(db, { q: 'alpha', limit: 7 }, 7);
	expect(pages).toBe(4);
	expect(seen).toEqual(all);
	expect(new Set(seen).size).toBe(rows.length);
});

test('search composes with time and category filters', async () => {
	const { db } = await freshDb();
	await seed(db);
	await fill(db, [
		makeRow(31, {
			title: 'Alpha in technology',
			category: 'technology',
			publishedAt: T0 - HOUR,
			fetchedAt: T0 - HOUR
		}),
		makeRow(32, {
			title: 'Alpha in ai',
			category: 'ai',
			publishedAt: T0 - HOUR,
			fetchedAt: T0 - HOUR
		}),
		makeRow(33, {
			title: 'Alpha is old',
			category: 'technology',
			publishedAt: T0 - 48 * HOUR,
			fetchedAt: T0 - 48 * HOUR
		})
	]);

	expect(
		await ids(db, {
			q: 'alpha',
			category: 'technology',
			from: T0 - 10 * HOUR,
			to: T0,
			limit: 50
		})
	).toEqual([idFor(31)]);
});

test('a search stays within the p95 budget while paging 20k rows', async () => {
	const { db } = await freshDb();
	await seed(db);

	const rows = Array.from({ length: 20_000 }, (_, i) =>
		makeRow(i, { title: `alpha story ${i}` })
	);
	await fill(db, rows);

	const seen: string[] = [];
	const durations: number[] = [];
	let cursor: SearchCursor | undefined;
	for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
		const start = performance.now();
		const page = await queryFeed(db, { q: 'alpha', limit: 50, cursor });
		durations.push(performance.now() - start);
		seen.push(...page.items.map((entry) => entry.id));
		expect(page.nextCursor).not.toBeNull();
		cursor = decodeSearchCursor(page.nextCursor!)!;
	}

	expect(new Set(seen).size).toBe(seen.length);
	const sorted = [...durations].sort((a, b) => a - b);
	const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
	expect(p95, `p95 search query ${p95.toFixed(1)}ms`).toBeLessThan(300);
}, 120_000);

test('without FTS5 the query falls back to a title-only LIKE', async () => {
	const { db } = await freshDb();
	await seed(db);
	await fill(db, [
		makeRow(51, { title: 'alpha beta in title' }),
		makeRow(52, { title: 'alpha gamma in title' }),
		makeRow(53, { title: 'ordinary', excerpt: 'alpha beta in excerpt' })
	]);

	await db.run(sql`drop table item_fts`);

	expect(await ids(db, { q: 'alpha beta', limit: 50 })).toEqual([idFor(51)]);
	expect(await ids(db, { q: 'alpha', limit: 50 })).toEqual([idFor(51), idFor(52)]);
});
