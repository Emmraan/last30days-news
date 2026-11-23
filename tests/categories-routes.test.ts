import { expect, test } from 'vitest';
import { eq } from 'drizzle-orm';
import { GET as listCategories, POST as createCategory } from '../src/routes/api/categories/+server';
import {
	DELETE as deleteCategory,
	PATCH as patchCategory
} from '../src/routes/api/categories/[id]/+server';
import { POST as rescore } from '../src/routes/api/categories/[id]/rescore/+server';
import { POST as feedCheck } from '../src/routes/api/categories/feed-check/+server';
import { POST as createSource } from '../src/routes/api/sources/+server';
import { seed } from '#lib/server/db/seed';
import {
	category,
	categoryItem,
	categorySource,
	item,
	itemSource,
	source
} from '#lib/server/db/schema';
import { promptHash } from '#lib/server/categories/filter';
import { makeEvent, read } from './events';
import { freshDb } from './helper';

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const JSON_FEED = JSON.stringify({
	version: 'https://jsonfeed.org/version/1.1',
	title: 'Example JSON',
	items: [{ id: '1', url: 'https://example.com/1', title: 'One' }]
});
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example RSS</title><item><title>One</title><link>https://example.com/1</link></item></channel></rss>`;

function fakeFetch(body: string, init: ResponseInit = {}) {
	let calls = 0;
	return {
		fetch: (async () => {
			calls++;
			return new Response(body, init);
		}) as typeof globalThis.fetch,
		calls: () => calls
	};
}

async function fixture() {
	const handle = await freshDb();
	await seed(handle.db);
	await handle.db.insert(category).values({
		id: 'usr-chips',
		name: 'Chips',
		builtin: false,
		matchMode: 'keywords',
		keywords: ['gpt-5'],
		prompt: null,
		aiThreshold: 0.6,
		sortOrder: 2,
		createdAt: T0
	});
	await handle.db.insert(categorySource).values({ categoryId: 'usr-chips', sourceId: 'mit-tr' });
	await handle.db.insert(item).values([
		{
			id: 'a'.repeat(40),
			title: 'GPT-5 launches',
			url: 'https://example.com/a',
			publishedAt: T0,
			publishedEstimated: false,
			fetchedAt: T0,
			excerpt: 'A model.',
			language: 'en',
			category: 'technology',
			sourceCount: 1
		},
		{
			id: 'b'.repeat(40),
			title: 'Other news',
			url: 'https://example.com/b',
			publishedAt: T0 - 1000,
			publishedEstimated: false,
			fetchedAt: T0 - 1000,
			excerpt: 'Something else.',
			language: 'en',
			category: 'technology',
			sourceCount: 1
		}
	]);
	await handle.db.insert(itemSource).values([
		{ itemId: 'a'.repeat(40), sourceId: 'mit-tr', url: 'https://example.com/a' },
		{ itemId: 'b'.repeat(40), sourceId: 'mit-tr', url: 'https://example.com/b' }
	]);
	return handle;
}

test('GET /api/categories reports counts, prompts and pinned sources', async () => {
	const { db } = await fixture();
	const res = await read(
		await listCategories(makeEvent({ db, url: 'http://127.0.0.1:4477/api/categories' }).event)
	);
	expect(res.status).toBe(200);
	const categories = res.body!.categories as Record<string, unknown>[];
	expect(categories.map((c) => c.id)).toEqual(['technology', 'ai', 'usr-chips']);
	const tech = categories[0];
	expect(tech).toMatchObject({
		builtin: true,
		matchMode: 'keywords',
		keywordCount: 0,
		hasPrompt: false,
		itemCount: 2
	});
	expect(tech.sourceIds).toEqual(expect.arrayContaining(['hn-top', 'ars', 'verge']));
	const chips = categories[2];
	expect(chips).toMatchObject({
		keywordCount: 1,
		hasPrompt: false,
		itemCount: 1,
		sourceIds: ['mit-tr']
	});
});

test('POST /api/categories creates a category and its source links', async () => {
	const { db } = await fixture();
	const { event } = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/categories',
		body: {
			name: 'AI Models',
			matchMode: 'both',
			keywords: ['gpt-5', 'llm'],
			prompt: 'Models and research',
			aiThreshold: 0.7,
			sourceIds: ['mit-tr', 'hf-blog']
		}
	});
	const res = await read(await createCategory(event));
	expect(res.status).toBe(201);
	const created = res.body!.category as Record<string, unknown>;
	expect(created).toMatchObject({
		name: 'AI Models',
		builtin: false,
		matchMode: 'both',
		keywords: ['gpt-5', 'llm'],
		prompt: 'Models and research',
		aiThreshold: 0.7,
		keywordCount: 2,
		hasPrompt: true,
		sourceIds: expect.arrayContaining(['mit-tr', 'hf-blog'])
	});
	expect(String(created.id)).toMatch(/^usr-/);
	const links = await db.select().from(categorySource).where(eq(categorySource.categoryId, String(created.id))).all();
	expect(links.map((l) => l.sourceId).sort()).toEqual(['hf-blog', 'mit-tr']);
});

test('POST /api/categories rejects a duplicate name case-insensitively and a missing AI prompt', async () => {
	const { db } = await fixture();
	const duplicate = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/categories',
		body: { name: 'chips' }
	});
	const first = await read(await createCategory(duplicate.event));
	expect(first.status).toBe(409);
	expect(first.body).toEqual({ error: { code: 'name_taken', message: expect.any(String) } });

	const noPrompt = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/categories',
		body: { name: 'Only AI', matchMode: 'ai' }
	});
	expect((await createCategory(noPrompt.event)).status).toBe(400);
});

test('PATCH and DELETE reject a builtin category', async () => {
	const { db } = await fixture();
	const patch = makeEvent({
		db,
		method: 'PATCH',
		url: 'http://127.0.0.1:4477/api/categories/technology',
		params: { id: 'technology' },
		body: { name: 'Renamed' }
	});
	const patched = await read(await patchCategory(patch.event));
	expect(patched.status).toBe(403);
	expect(patched.body).toEqual({ error: { code: 'builtin_category', message: expect.any(String) } });

	const remove = makeEvent({
		db,
		method: 'DELETE',
		url: 'http://127.0.0.1:4477/api/categories/technology',
		params: { id: 'technology' }
	});
	expect((await deleteCategory(remove.event)).status).toBe(403);
});

test('PATCH changes a custom category prompt and source links', async () => {
	const { db } = await fixture();
	const { event } = makeEvent({
		db,
		method: 'PATCH',
		url: 'http://127.0.0.1:4477/api/categories/usr-chips',
		params: { id: 'usr-chips' },
		body: { prompt: 'Chip companies', sourceIds: ['ars'] }
	});
	const res = await read(await patchCategory(event));
	expect(res.status).toBe(200);
	expect(res.body!.category).toMatchObject({ prompt: 'Chip companies', sourceIds: ['ars'] });
	const links = await db.select().from(categorySource).where(eq(categorySource.categoryId, 'usr-chips')).all();
	expect(links.map((l) => l.sourceId)).toEqual(['ars']);
});

test('DELETE disables its sources and moves their items instead of deleting them', async () => {
	const { db } = await fixture();
	await db.insert(source).values({
		id: 'usr-feed',
		name: 'User Feed',
		kind: 'rss',
		url: 'https://example.com/feed',
		category: 'usr-chips',
		enabled: true,
		fetchIntervalMin: 60,
		createdAt: T0
	});
	await db.insert(item).values({
		id: 'c'.repeat(40),
		title: 'Custom item',
		url: 'https://example.com/c',
		publishedAt: T0,
		publishedEstimated: false,
		fetchedAt: T0,
		excerpt: null,
		language: 'en',
		category: 'usr-chips',
		sourceCount: 1
	});
	await db.insert(itemSource).values({
		itemId: 'c'.repeat(40),
		sourceId: 'usr-feed',
		url: 'https://example.com/c'
	});

	const { event } = makeEvent({
		db,
		method: 'DELETE',
		url: 'http://127.0.0.1:4477/api/categories/usr-chips',
		params: { id: 'usr-chips' }
	});
	expect((await deleteCategory(event)).status).toBe(200);

	expect(await db.select().from(category).where(eq(category.id, 'usr-chips')).get()).toBeUndefined();
	const movedSource = await db.select().from(source).where(eq(source.id, 'usr-feed')).get();
	expect(movedSource).toMatchObject({ enabled: false, category: 'technology' });
	const movedItem = await db.select().from(item).where(eq(item.id, 'c'.repeat(40))).get();
	expect(movedItem).toMatchObject({ category: 'technology' });
});

test('POST /api/categories/feed-check fetches once and saves nothing', async () => {
	const { db } = await fixture();
	const before = {
		sources: (await db.select().from(source).all()).length,
		categories: (await db.select().from(category).all()).length
	};
	const f = fakeFetch(JSON_FEED, { headers: { 'content-type': 'application/json' } });
	const { event } = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/categories/feed-check',
		body: { url: 'https://example.com/feed.json' },
		fetch: f.fetch
	});
	const res = await read(await feedCheck(event));
	expect(res.status).toBe(200);
	expect(res.body).toEqual({ ok: true, feedTitle: 'Example JSON', itemCount: 1 });
	expect(f.calls()).toBe(1);
	expect(await db.select().from(source).all()).toHaveLength(before.sources);
	expect(await db.select().from(category).all()).toHaveLength(before.categories);
});

test('feed-check reports a bad URL inline with a non-2xx network status', async () => {
	const { db } = await fixture();
	const f = fakeFetch('<html>no</html>');
	const { event } = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/categories/feed-check',
		body: { url: 'https://example.com/' },
		fetch: f.fetch
	});
	const res = await read(await feedCheck(event));
	expect(res.status).toBe(200);
	expect(res.body).toMatchObject({ ok: false, code: 'not_a_feed' });
});

test('POST /api/sources validates by one fetch and writes a source only on success', async () => {
	const { db } = await fixture();
	const f = fakeFetch(RSS);
	const good = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/sources',
		body: { url: 'https://example.com/rss.xml', name: 'Example', categoryId: 'technology' },
		fetch: f.fetch
	});
	const created = await read(await createSource(good.event));
	expect(created.status).toBe(201);
	expect(created.body!.source).toMatchObject({
		name: 'Example',
		kind: 'rss',
		url: 'https://example.com/rss.xml',
		category: 'technology',
		enabled: true,
		fetchIntervalMin: 60
	});
	expect(f.calls()).toBe(1);
	const row = await db.select().from(source).where(eq(source.url, 'https://example.com/rss.xml')).get();
	expect(row).toBeTruthy();

	const before = (await db.select().from(source).all()).length;
	const badFetch = fakeFetch('<html>no</html>');
	const bad = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/sources',
		body: { url: 'https://example.com/bad', categoryId: 'technology' },
		fetch: badFetch.fetch
	});
	const failed = await read(await createSource(bad.event));
	expect(failed.status).toBe(400);
	expect(failed.body).toMatchObject({ error: { code: 'not_a_feed' } });
	expect(await db.select().from(source).all()).toHaveLength(before);
});

test('POST /api/sources refuses a private URL before fetching', async () => {
	const { db } = await fixture();
	const f = fakeFetch(RSS);
	const { event } = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/sources',
		body: { url: 'http://127.0.0.1:9/feed', categoryId: 'technology' },
		fetch: f.fetch
	});
	const res = await read(await createSource(event));
	expect(res.status).toBe(400);
	expect(res.body).toMatchObject({ error: { code: 'blocked_url' } });
	expect(f.calls()).toBe(0);
});

test('POST /api/sources rejects an unknown category before fetching', async () => {
	const { db } = await fixture();
	const f = fakeFetch(RSS);
	const { event } = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/sources',
		body: { url: 'https://example.com/feed', categoryId: 'nope' },
		fetch: f.fetch
	});
	const res = await read(await createSource(event));
	expect(res.status).toBe(404);
	expect(f.calls()).toBe(0);
});

test('rescore resets cached scores and degrades cleanly without a provider', async () => {
	const { db } = await fixture();
	await db
		.update(category)
		.set({ matchMode: 'ai', prompt: 'chips' })
		.where(eq(category.id, 'usr-chips'));
	await db.insert(categoryItem).values({
		categoryId: 'usr-chips',
		itemId: 'a'.repeat(40),
		promptHash: promptHash('chips'),
		score: 0.9,
		reason: 'Yes',
		createdAt: T0
	});

	const { event } = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/categories/usr-chips/rescore',
		params: { id: 'usr-chips' },
		body: { reset: true }
	});
	const res = await rescore(event);
	expect(res.status).toBe(200);
	expect(res.headers.get('content-type')).toContain('text/event-stream');
	const text = await res.text();
	expect(text).toContain('"type":"degraded"');
	expect(text).toContain('"code":"ai_not_configured"');
	expect(await db.select().from(categoryItem).all()).toHaveLength(0);
});

test('rescore accepts an empty body as a no-op reset', async () => {
	const { db } = await fixture();
	await db
		.update(category)
		.set({ matchMode: 'ai', prompt: 'chips' })
		.where(eq(category.id, 'usr-chips'));
	const { event } = makeEvent({
		db,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/categories/usr-chips/rescore',
		params: { id: 'usr-chips' }
	});
	const res = await rescore(event);
	expect(res.status).toBe(200);
	const text = await res.text();
	expect(text).toContain('"type":"degraded"');
	expect(text).toContain('"type":"done"');
});

test('rescore closes the stream when a query fails mid-open', async () => {
	const { db } = await fixture();
	await db
		.update(category)
		.set({ matchMode: 'ai', prompt: 'chips' })
		.where(eq(category.id, 'usr-chips'));

	let selects = 0;
	const flaky = new Proxy(db, {
		get(target, prop, receiver) {
			if (prop === 'select') {
				return (...args: unknown[]) => {
					selects++;
					if (selects > 2) throw new Error('database unavailable');
					return (target.select as unknown as (...a: unknown[]) => unknown)(...args);
				};
			}
			return Reflect.get(target, prop, receiver);
		}
	}) as typeof db;

	const { event } = makeEvent({
		db: flaky,
		method: 'POST',
		url: 'http://127.0.0.1:4477/api/categories/usr-chips/rescore',
		params: { id: 'usr-chips' }
	});
	const text = await (await rescore(event)).text();
	expect(text).toContain('"code":"ai_failed"');
	expect(text).toContain('"type":"done"');
});

test('rescore rejects an unknown or non-AI category', async () => {
	const { db } = await fixture();
	expect(
		(
			await read(
				await rescore(
					makeEvent({
						db,
						method: 'POST',
						url: 'http://127.0.0.1:4477/api/categories/nope/rescore',
						params: { id: 'nope' },
						body: {}
					}).event
				)
			)
		).status
	).toBe(404);

	expect(
		(
			await read(
				await rescore(
					makeEvent({
						db,
						method: 'POST',
						url: 'http://127.0.0.1:4477/api/categories/technology/rescore',
						params: { id: 'technology' },
						body: {}
					}).event
				)
			)
		).status
	).toBe(400);
});
