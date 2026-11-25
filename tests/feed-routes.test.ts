import { expect, test } from 'vitest';
import { GET as getFeed } from '../src/routes/api/feed/+server';
import { GET as getItem } from '../src/routes/api/items/[id]/+server';
import { seed } from '#lib/server/db/seed';
import { item, itemSource, summary } from '#lib/server/db/schema';
import { freshDb } from './helper';
import { makeEvent, read } from './events';

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);

const idFor = (i: number) => i.toString(16).padStart(40, '0');

function row(i: number) {
	const publishedAt = T0 - i * HOUR;
	return {
		id: idFor(i),
		title: `Story ${i}`,
		url: `https://example.com/${i}`,
		author: 'Ada',
		publishedAt,
		publishedEstimated: false,
		fetchedAt: publishedAt,
		excerpt: `Excerpt ${i}`,
		language: 'en',
		category: 'technology',
		sourceCount: 1
	};
}

const feedUrl = (params: Record<string, string> = {}) => {
	const url = new URL('http://127.0.0.1:4477/api/feed');
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return url.toString();
};

test('GET /api/feed returns the default 50-item page and a cursor', async () => {
	const { db } = await freshDb();
	await seed(db);
	await db.insert(item).values(Array.from({ length: 60 }, (_, i) => row(i)));

	const first = await read(await getFeed(makeEvent({ db, url: feedUrl() }).event));
	expect(first.status).toBe(200);
	const body = first.body!;
	const items = body.items as Record<string, unknown>[];
	expect(items).toHaveLength(50);
	expect(typeof body.nextCursor).toBe('string');
	expect(items[0]).toMatchObject({
		id: idFor(0),
		title: 'Story 0',
		category: 'technology',
		sourceCount: 1,
		publishedEstimated: false
	});
	expect(typeof items[0].publishedAt).toBe('number');

	const second = await read(
		await getFeed(
			makeEvent({ db, url: feedUrl({ cursor: String(body.nextCursor) }) }).event
		)
	);
	expect((second.body!.items as unknown[]).length).toBe(10);
	expect(second.body!.nextCursor).toBeNull();
});

test('GET /api/feed includes one attributed source name per item', async () => {
	const { db } = await freshDb();
	await seed(db);
	const attributed = row(0);
	const orphan = row(1);
	await db.insert(item).values([attributed, orphan]);
	await db.insert(itemSource).values([
		{ itemId: attributed.id, sourceId: 'verge', url: attributed.url, rawTitle: null },
		{ itemId: attributed.id, sourceId: 'ars', url: attributed.url, rawTitle: null }
	]);

	const res = await read(await getFeed(makeEvent({ db, url: feedUrl() }).event));
	const items = res.body!.items as Record<string, unknown>[];
	const first = items.find((entry) => entry.id === attributed.id);
	const second = items.find((entry) => entry.id === orphan.id);

	expect(first?.sourceName).toBe('Ars Technica');
	expect(second?.sourceName).toBeNull();
});

test.each([
	['limit=0', 'invalid_limit'],
	['limit=101', 'invalid_limit'],
	['limit=abc', 'invalid_limit'],
	['limit=100000', 'invalid_limit'],
	['from=abc', 'invalid_time'],
	['to=abc', 'invalid_time'],
	['from=2000&to=1000', 'invalid_range'],
	['cursor=forged', 'invalid_cursor'],
	['q=a', 'query_too_short']
])('GET /api/feed rejects %s with %s', async (query, code) => {
	const { db } = await freshDb();
	const params = Object.fromEntries(new URLSearchParams(query));
	const res = await read(await getFeed(makeEvent({ db, url: feedUrl(params) }).event));
	expect(res.status).toBe(400);
	expect(res.body).toEqual({ error: { code, message: expect.any(String) } });
});

test('GET /api/feed paginates a search with the returned cursor', async () => {
	const { db } = await freshDb();
	await seed(db);
	await db.insert(item).values([
		{ ...row(0), title: 'Alpha one' },
		{ ...row(1), title: 'Alpha two' },
		{ ...row(2), title: 'Alpha three' }
	]);

	const first = await read(
		await getFeed(makeEvent({ db, url: feedUrl({ q: 'alpha', limit: '2' }) }).event)
	);
	expect((first.body!.items as { id: string }[]).map((entry) => entry.id)).toEqual([
		idFor(0),
		idFor(1)
	]);

	const second = await read(
		await getFeed(
			makeEvent({
				db,
				url: feedUrl({ q: 'alpha', limit: '2', cursor: String(first.body!.nextCursor) })
			}).event
		)
	);
	expect((second.body!.items as { id: string }[]).map((entry) => entry.id)).toEqual([idFor(2)]);
	expect(second.body!.nextCursor).toBeNull();
});

test('GET /api/feed accepts filters and returns an empty page honestly', async () => {
	const { db } = await freshDb();
	await seed(db);
	await db.insert(item).values([row(0), row(1)]);

	const res = await read(
		await getFeed(
			makeEvent({
				db,
				url: feedUrl({
					from: String(T0 - 30 * 60 * 1000),
					to: String(T0),
					category: 'technology',
					q: 'story',
					limit: '1'
				})
			}).event
		)
	);
	expect(res.status).toBe(200);
	expect((res.body!.items as unknown[]).length).toBe(1);
	expect(res.body!.nextCursor).toBeNull();

	const empty = await read(
		await getFeed(makeEvent({ db, url: feedUrl({ category: 'nope' }) }).event)
	);
	expect(empty.body).toEqual({ items: [], nextCursor: null });
});

test('GET /api/items/[id] returns the item, its sources, and the newest cached summary', async () => {
	const { db } = await freshDb();
	await seed(db);
	const target = row(7);
	await db.insert(item).values(target);
	await db.insert(itemSource).values([
		{ itemId: target.id, sourceId: 'ars', url: target.url, rawTitle: 'Raw A' },
		{ itemId: target.id, sourceId: 'verge', url: 'https://example.com/other', rawTitle: null }
	]);
	await db.insert(summary).values([
		{
			itemId: target.id,
			model: 'old/model',
			body: 'Old summary',
			citations: [{ n: 1, source_id: 'ars', url: target.url }],
			createdAt: T0 - HOUR,
			tokensIn: 10,
			tokensOut: 5
		},
		{
			itemId: target.id,
			model: 'new/model',
			body: 'New summary',
			keyPoints: ['Faster part', 'Same price'],
			whyItMatters: 'Buyers get more for the same money.',
			citations: [{ n: 1, source_id: 'verge', url: 'https://example.com/other' }],
			createdAt: T0,
			tokensIn: 20,
			tokensOut: 8
		}
	]);

	const res = await read(
		await getItem(
			makeEvent({
				db,
				url: `http://127.0.0.1:4477/api/items/${target.id}`,
				params: { id: target.id }
			}).event
		)
	);

	expect(res.status).toBe(200);
	const body = res.body!;
	expect(body.item).toMatchObject({
		id: target.id,
		title: target.title,
		url: target.url,
		publishedAt: target.publishedAt
	});
	const sources = body.sources as Record<string, unknown>[];
	expect(sources.map((s) => s.name)).toEqual(['Ars Technica', 'The Verge']);
	expect(sources[0]).toMatchObject({ id: 'ars', url: target.url });
	expect(body.summary).toMatchObject({
		model: 'new/model',
		body: 'New summary',
		keyPoints: ['Faster part', 'Same price'],
		whyItMatters: 'Buyers get more for the same money.'
	});

	// The feed's own URL is not part of the article payload (S24 info leak).
	expect(res.raw).not.toContain('https://feeds.arstechnica.com');
});

test('GET /api/items/[id] reports a missing summary as null', async () => {
	const { db } = await freshDb();
	await seed(db);
	const target = row(8);
	await db.insert(item).values(target);

	const res = await read(
		await getItem(
			makeEvent({
				db,
				url: `http://127.0.0.1:4477/api/items/${target.id}`,
				params: { id: target.id }
			}).event
		)
	);

	expect(res.status).toBe(200);
	expect(res.body!.summary).toBeNull();
});

test('GET /api/items/[id] is a 404 for an unknown id', async () => {
	const { db } = await freshDb();
	const res = await read(
		await getItem(
			makeEvent({
				db,
				url: 'http://127.0.0.1:4477/api/items/nope',
				params: { id: 'nope' }
			}).event
		)
	);
	expect(res.status).toBe(404);
	expect(res.body).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
});
