import { expect, test } from 'vitest';
import type { Db } from '#lib/server/db';
import { seed } from '#lib/server/db/seed';
import { item } from '#lib/server/db/schema';
import { compareRank } from '#lib/util/rank';
import { decodeCursor, queryFeed, type FeedParams } from '#lib/server/feed/query';
import { freshDb } from './helper';

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);

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

const idFor = (i: number) => i.toString(16).padStart(40, '0');

function makeRows(count: number): Row[] {
	return Array.from({ length: count }, (_, i) => {
		const publishedAt = T0 - Math.floor(i / 10) * HOUR;
		return {
			id: idFor(i),
			title: `Story ${i}`,
			url: `https://example.com/${i}`,
			author: null,
			publishedAt,
			publishedEstimated: false,
			fetchedAt: publishedAt,
			excerpt: `Excerpt ${i}`,
			language: 'en',
			category: i % 2 === 0 ? 'technology' : 'ai',
			sourceCount: 1 + (i % 3)
		};
	});
}

async function fill(db: Db, rows: Row[]) {
	// SQLite caps bound variables per statement; 500 rows is comfortably under it.
	for (let i = 0; i < rows.length; i += 500) await db.insert(item).values(rows.slice(i, i + 500));
}

async function collect(db: Db, params: FeedParams, limit: number) {
	const seen: string[] = [];
	const durations: number[] = [];
	let cursor = params.cursor;

	for (let pages = 0; pages < 1000; pages++) {
		const start = performance.now();
		const page = await queryFeed(db, { ...params, limit, cursor });
		durations.push(performance.now() - start);
		seen.push(...page.items.map((i) => i.id));
		if (!page.nextCursor) return { seen, durations, pages: pages + 1 };
		cursor = decodeCursor(page.nextCursor)!;
	}

	throw new Error('cursor never terminated');
}

test('paging through 20k rows returns every item exactly once under the latency budget', async () => {
	const { db } = await freshDb();
	await seed(db);

	const rows = makeRows(20_000);
	await fill(db, rows);
	const expected = [...rows].sort(compareRank).map((r) => r.id);

	const { seen, durations, pages } = await collect(db, { limit: 50 }, 50);

	expect(pages).toBe(400);
	expect(seen).toHaveLength(rows.length);
	expect(new Set(seen).size).toBe(rows.length);
	expect(seen).toEqual(expected);

	const sorted = [...durations].sort((a, b) => a - b);
	const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
	expect(p95, `p95 feed query ${p95.toFixed(1)}ms`).toBeLessThan(120);
}, 120_000);

test('an exact final page ends the cursor instead of emitting an empty page', async () => {
	const { db } = await freshDb();
	await seed(db);
	await fill(db, makeRows(100));

	const first = await queryFeed(db, { limit: 50 });
	expect(first.items).toHaveLength(50);
	expect(first.nextCursor).not.toBeNull();

	const second = await queryFeed(db, { limit: 50, cursor: decodeCursor(first.nextCursor!)! });
	expect(second.items).toHaveLength(50);
	expect(second.nextCursor).toBeNull();
});

test('an insert above the cursor mid-scroll neither duplicates nor skips rows', async () => {
	const { db } = await freshDb();
	await seed(db);

	const rows = makeRows(100);
	await fill(db, rows);
	const expected = [...rows].sort(compareRank).map((r) => r.id);

	const first = await queryFeed(db, { limit: 10 });
	expect(first.items).toHaveLength(10);

	// Highest rank possible, so it belongs before the cursor and cannot show up
	// on any later page — the rows already paged must still all be reachable.
	const fresh: Row = {
		...makeRows(1)[0],
		id: idFor(9_999),
		title: 'Breaking story',
		url: 'https://example.com/breaking',
		publishedAt: T0 + HOUR,
		fetchedAt: T0 + HOUR,
		sourceCount: 9
	};
	await db.insert(item).values(fresh);

	const seen = first.items.map((i) => i.id);
	let cursor = decodeCursor(first.nextCursor!)!;
	for (;;) {
		const page = await queryFeed(db, { limit: 10, cursor });
		seen.push(...page.items.map((i) => i.id));
		if (!page.nextCursor) break;
		cursor = decodeCursor(page.nextCursor)!;
	}

	expect(seen).toEqual(expected);
	expect(seen).not.toContain(fresh.id);
});

test('an insert below the cursor mid-scroll appears exactly once', async () => {
	const { db } = await freshDb();
	await seed(db);

	const rows = makeRows(100);
	await fill(db, rows);

	const first = await queryFeed(db, { limit: 10 });
	const late: Row = {
		...makeRows(1)[0],
		id: 'e'.repeat(40),
		title: 'Late story',
		url: 'https://example.com/late',
		// Oldest and lowest source count: it lands on the very last page.
		publishedAt: T0 - 10_000 * HOUR,
		fetchedAt: T0 - 10_000 * HOUR,
		sourceCount: 1
	};
	await db.insert(item).values(late);

	const seen = first.items.map((i) => i.id);
	let cursor = decodeCursor(first.nextCursor!)!;
	for (;;) {
		const page = await queryFeed(db, { limit: 10, cursor });
		seen.push(...page.items.map((i) => i.id));
		if (!page.nextCursor) break;
		cursor = decodeCursor(page.nextCursor)!;
	}

	expect(seen).toHaveLength(101);
	expect(new Set(seen).size).toBe(101);
	expect(seen.filter((id) => id === late.id)).toHaveLength(1);
	expect(seen[seen.length - 1]).toBe(late.id);
});

test('time filters use published_at and fall back to fetched_at only for estimated dates', async () => {
	const { db } = await freshDb();
	await seed(db);

	const plainOld: Row = {
		...makeRows(1)[0],
		id: idFor(1),
		title: 'Old plain',
		publishedAt: T0 - 48 * HOUR,
		fetchedAt: T0 - HOUR,
		publishedEstimated: false
	};
	const estimated: Row = {
		...makeRows(1)[0],
		id: idFor(2),
		title: 'Stale estimated',
		publishedAt: T0 - 48 * HOUR,
		fetchedAt: T0 - HOUR,
		publishedEstimated: true
	};
	const recent: Row = {
		...makeRows(1)[0],
		id: idFor(3),
		title: 'Alpha gamma',
		excerpt: 'A unique needle',
		publishedAt: T0 - 2 * HOUR,
		fetchedAt: T0 - 2 * HOUR
	};
	const otherCategory: Row = {
		...makeRows(1)[0],
		id: idFor(4),
		title: 'Alpha delta',
		category: 'ai',
		publishedAt: T0 - 3 * HOUR,
		fetchedAt: T0 - 3 * HOUR
	};
	await db.insert(item).values([plainOld, estimated, recent, otherCategory]);

	const inWindow = await queryFeed(db, { from: T0 - 10 * HOUR, to: T0, limit: 50 });
	expect(inWindow.items.map((i) => i.id).sort()).toEqual(
		[estimated.id, recent.id, otherCategory.id].sort()
	);

	const technology = await queryFeed(db, {
		from: T0 - 10 * HOUR,
		to: T0,
		category: 'technology',
		limit: 50
	});
	expect(technology.items.map((i) => i.id).sort()).toEqual([estimated.id, recent.id].sort());

	const noMatch = await queryFeed(db, { category: 'missing', limit: 50 });
	expect(noMatch.items).toEqual([]);
	expect(noMatch.nextCursor).toBeNull();
});

test('search tokens are case-insensitive, ANDed, and match title or excerpt', async () => {
	const { db } = await freshDb();
	await seed(db);

	const rows: Row[] = [
		{ ...makeRows(1)[0], id: idFor(11), title: 'Alpha gamma', excerpt: null },
		{ ...makeRows(1)[0], id: idFor(12), title: 'Alpha only', excerpt: 'beta lives here' },
		{ ...makeRows(1)[0], id: idFor(13), title: 'Unrelated', excerpt: null }
	];
	await db.insert(item).values(rows);

	const ids = async (q: string) =>
		(await queryFeed(db, { q, limit: 50 })).items.map((i) => i.id).sort();

	expect(await ids('alpha')).toEqual([idFor(11), idFor(12)].sort());
	expect(await ids('ALPHA')).toEqual([idFor(11), idFor(12)].sort());
	expect(await ids('alpha gamma')).toEqual([idFor(11)]);
	expect(await ids('alpha beta')).toEqual([idFor(12)]);
	expect(await ids('beta')).toEqual([idFor(12)]);
	expect(await ids('missing')).toEqual([]);
});

test('LIKE wildcards in the search input are matched literally', async () => {
	const { db } = await freshDb();
	await seed(db);

	const rows: Row[] = [
		{ ...makeRows(1)[0], id: idFor(21), title: '100% done' },
		{ ...makeRows(1)[0], id: idFor(22), title: '100x done' },
		{ ...makeRows(1)[0], id: idFor(23), title: 'a_b story' },
		{ ...makeRows(1)[0], id: idFor(24), title: 'axb story' }
	];
	await db.insert(item).values(rows);

	const ids = async (q: string) =>
		(await queryFeed(db, { q, limit: 50 })).items.map((i) => i.id).sort();

	expect(await ids('100%')).toEqual([idFor(21)]);
	expect(await ids('a_b')).toEqual([idFor(23)]);
	expect(await ids('a%b')).toEqual([]);
});

test('FTS and SQL metacharacters in search are inert', async () => {
	const { db } = await freshDb();
	await seed(db);

	const rows: Row[] = [
		{ ...makeRows(1)[0], id: idFor(41), title: 'NEAR * ^ "quoted": literal' },
		{ ...makeRows(1)[0], id: idFor(42), title: 'Ordinary story' }
	];
	await db.insert(item).values(rows);

	const ids = async (q: string) =>
		(await queryFeed(db, { q, limit: 50 })).items.map((i) => i.id);

	expect(await ids('NEAR')).toEqual([idFor(41)]);
	expect(await ids('NEAR *')).toEqual([idFor(41)]);
	expect(await ids('^ "quoted":')).toEqual([idFor(41)]);
	expect(await ids(`' OR 1=1 --`)).toEqual([]);
	expect((await queryFeed(db, { category: `' OR 1=1 --`, limit: 50 })).items).toEqual([]);
});

test('search and filters compose as AND', async () => {	const { db } = await freshDb();
	await seed(db);

	const rows: Row[] = [
		{
			...makeRows(1)[0],
			id: idFor(31),
			title: 'Alpha in technology',
			category: 'technology',
			publishedAt: T0 - HOUR,
			fetchedAt: T0 - HOUR
		},
		{
			...makeRows(1)[0],
			id: idFor(32),
			title: 'Alpha in ai',
			category: 'ai',
			publishedAt: T0 - HOUR,
			fetchedAt: T0 - HOUR
		},
		{
			...makeRows(1)[0],
			id: idFor(33),
			title: 'Alpha is old',
			category: 'technology',
			publishedAt: T0 - 48 * HOUR,
			fetchedAt: T0 - 48 * HOUR
		}
	];
	await db.insert(item).values(rows);

	const page = await queryFeed(db, {
		q: 'alpha',
		category: 'technology',
		from: T0 - 10 * HOUR,
		to: T0,
		limit: 50
	});
	expect(page.items.map((i) => i.id)).toEqual([idFor(31)]);
});
