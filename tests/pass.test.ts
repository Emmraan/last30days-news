import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runPass } from '#lib/server/fetch/pass';
import { seed } from '#lib/server/db/seed';
import { source } from '#lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Client } from '@libsql/client';
import { freshDb } from './helper';

const fixture = (name: string) => readFileSync(join('fixtures', name), 'utf8');

const ARS = 'arstechnica.com/arstechnica/index';
const VERGE = 'theverge.com/rss/index.xml';
const MIT = 'technologyreview.com/feed/';
const TC = 'techcrunch.com/category/artificial-intelligence/feed/';
const HF = 'huggingface.co/blog/feed.xml';

/** The seeded URL → the recorded body for it. */
const ALL: Record<string, string> = {
	[ARS]: 'ars.xml',
	[VERGE]: 'verge.xml',
	[MIT]: 'mit-tr.xml',
	[TC]: 'tc-ai.xml',
	[HF]: 'hf-blog.xml',
	'/v0/topstories.json': 'hn-topstories.json',
	'/v0/item/101.json': 'hn-item-101.json',
	'/v0/item/102.json': 'hn-item-102.json',
	'/v0/item/103.json': 'hn-item-103.json'
};

/** Fixture-backed fetch: no test in this file opens a socket. */
function stubFetch(overrides: Record<string, { status: number; body: string }> = {}) {
	const calls: string[] = [];
	const fn = (async (input: string | URL | Request) => {
		const url = String(input);
		calls.push(url);
		for (const [suffix, res] of Object.entries(overrides))
			if (url.endsWith(suffix)) return new Response(res.body, { status: res.status });
		const hit = Object.entries(ALL).find(([suffix]) => url.endsWith(suffix));
		if (!hit) return new Response('not found', { status: 404 });
		return new Response(fixture(hit[1]));
	}) as unknown as typeof globalThis.fetch;
	return { fn, calls };
}

const count = async (client: Client) =>
	Number((await client.execute('select count(*) from item')).rows[0][0]);

test('a fixture pass fills a fresh DB and marks every source ok', async () => {
	const { db, client } = await freshDb();
	await seed(db);
	const { fn } = stubFetch();

	const events = await runPass({ db, fetch: fn, retryDelays: [0, 0] });

	expect(await count(client)).toBe(12);
	const statuses = await client.execute('select id, last_status from source order by id');
	expect(statuses.rows.map((r) => String(r[1]))).toEqual(Array(6).fill('ok'));
	expect(events.at(-1)).toMatchObject({ type: 'done', inserted: 12, sources: 6 });
});

test('a source that always 500s is marked error and the pass still finishes', async () => {
	const { db, client } = await freshDb();
	await seed(db);
	const { fn } = stubFetch({ [TC]: { status: 500, body: 'boom' } });

	const events = await runPass({ db, fetch: fn, retryDelays: [0, 0] });

	const failed = await client.execute("select last_status, last_error from source where id = 'tc-ai'");
	expect(String(failed.rows[0][0])).toBe('error');
	expect(String(failed.rows[0][1])).toContain('500');
	const ok = await client.execute("select last_status from source where id = 'ars'");
	expect(String(ok.rows[0][0])).toBe('ok');
	expect(await count(client)).toBe(10);
	expect(events.some((e) => e.type === 'source' && e.sourceId === 'tc-ai' && !e.ok)).toBe(true);
});

test('three consecutive failures auto-disable the source', async () => {
	const { db, client } = await freshDb();
	await seed(db);
	const { fn } = stubFetch({ [TC]: { status: 500, body: 'boom' } });
	const t0 = Date.now();

	for (let i = 0; i < 3; i++)
		await runPass({ db, fetch: fn, now: t0 + i * 61 * 60_000, retryDelays: [0, 0] });

	const { rows } = await client.execute(
		"select enabled, last_status from source where id = 'tc-ai'"
	);
	expect(Number(rows[0][0])).toBe(0);
	expect(String(rows[0][1])).toBe('disabled');
});

test('a success resets the strike count', async () => {
	const { db, client } = await freshDb();
	await seed(db);
	const bad = stubFetch({ [TC]: { status: 500, body: 'boom' } });
	const good = stubFetch();
	const t0 = Date.now();

	await runPass({ db, fetch: bad.fn, now: t0, retryDelays: [0, 0] });
	await runPass({ db, fetch: bad.fn, now: t0 + 61 * 60_000, retryDelays: [0, 0] });
	await runPass({ db, fetch: good.fn, now: t0 + 122 * 60_000, retryDelays: [0, 0] });
	await runPass({ db, fetch: bad.fn, now: t0 + 183 * 60_000, retryDelays: [0, 0] });

	const { rows } = await client.execute(
		"select enabled, last_status from source where id = 'tc-ai'"
	);
	expect(Number(rows[0][0])).toBe(1);
	expect(String(rows[0][1])).toBe('error');
});

test('a source is not fetched again before its interval', async () => {
	const { db } = await freshDb();
	await seed(db);
	const now = Date.now();
	await db.update(source).set({ lastFetchedAt: now - 60_000 }).where(eq(source.id, 'ars'));
	const { fn, calls } = stubFetch();

	await runPass({ db, fetch: fn, now, retryDelays: [0, 0] });

	expect(calls.some((u) => u.endsWith(ARS))).toBe(false);
	expect(calls.some((u) => u.endsWith(VERGE))).toBe(true);
});

test('one retry recovers a transient 500', async () => {
	const { db, client } = await freshDb();
	await seed(db);
	let first = true;
	const inner = stubFetch();
	const fn = (async (input: string | URL | Request, init?: RequestInit) => {
		if (String(input).endsWith(ARS) && first) {
			first = false;
			return new Response('flaky', { status: 500 });
		}
		return inner.fn(input as never, init);
	}) as unknown as typeof globalThis.fetch;

	await runPass({ db, fetch: fn, retryDelays: [0, 0] });

	const { rows } = await client.execute("select last_status from source where id = 'ars'");
	expect(String(rows[0][0])).toBe('ok');
});

test('a 200-item cap per source is enforced', async () => {
	const { db, client } = await freshDb();
	await seed(db);
	const entries = Array.from(
		{ length: 250 },
		(_, i) =>
			`<item><title>Item ${i}</title><link>https://example.com/i/${i}</link><pubDate>Mon, 17 Nov 2026 08:00:00 GMT</pubDate></item>`
	).join('');
	const big = `<rss version="2.0"><channel>${entries}</channel></rss>`;
	const fn = (async (input: string | URL | Request) => {
		if (String(input).endsWith(ARS)) return new Response(big);
		if (String(input).endsWith('/v0/topstories.json')) return new Response('[]');
		return new Response('<rss version="2.0"><channel></channel></rss>');
	}) as unknown as typeof globalThis.fetch;

	await runPass({ db, fetch: fn, retryDelays: [0, 0] });

	expect(await count(client)).toBe(200);
});

test('batch mode fetches at most four sources per call', async () => {
	const { db } = await freshDb();
	await seed(db);
	const { fn, calls } = stubFetch();

	await runPass({ db, fetch: fn, batch: true, retryDelays: [0, 0] });

	expect(calls.filter((u) => !u.includes('/item/')).length).toBeLessThanOrEqual(4);
});

test('the pass prunes items past retention', async () => {
	const { db, client } = await freshDb();
	await seed(db);
	await client.execute({
		sql: 'insert into item (id,title,url,published_at,fetched_at,category) values (?,?,?,?,?,?)',
		args: ['old', 'Old', 'https://example.com/old', 1, 1, 'technology']
	});

	const events = await runPass({ db, fetch: stubFetch().fn, retryDelays: [0, 0] });

	expect(await count(client)).toBe(12);
	expect(events.at(-1)).toMatchObject({ type: 'done', pruned: 1 });
});

test('a client that disconnects mid-pass does not abort the pass', async () => {
	const { db, client } = await freshDb();
	await seed(db);
	let seen = 0;
	const events = await runPass({
		db,
		fetch: stubFetch().fn,
		retryDelays: [0, 0],
		emit: () => {
			seen++;
			if (seen === 2) throw new Error('client went away');
		}
	});

	expect(await count(client)).toBe(12);
	expect(events.at(-1)).toMatchObject({ type: 'done', inserted: 12 });
});
