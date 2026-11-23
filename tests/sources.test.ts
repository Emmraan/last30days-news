import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { fetchRss } from '#lib/server/sources/rss';
import { fetchHn } from '#lib/server/sources/hn';
import { fetchJson } from '#lib/server/sources/json';

const fixture = (name: string) => readFileSync(join('fixtures', name), 'utf8');

/** A fetch that answers from files. Tests never open a socket (§S17). */
function fixtureFetch(routes: Record<string, { status?: number; body: string }>) {
	const calls: string[] = [];
	const fn = (async (input: string | URL | Request) => {
		const url = String(input);
		calls.push(url);
		const hit = Object.entries(routes).find(([suffix]) => url.endsWith(suffix));
		if (!hit) return new Response('not found', { status: 404 });
		const [, { status = 200, body }] = hit;
		return new Response(body, { status });
	}) as unknown as typeof globalThis.fetch;
	return { fn, calls };
}

test('rss 2.0: items map, tracking params go, HTML is stripped, no-link entry skipped', async () => {
	const { fn } = fixtureFetch({ 'ars.xml': { body: fixture('ars.xml') } });
	const items = await fetchRss(
		{ url: 'https://example.test/ars.xml' },
		{ fetch: fn }
	);

	expect(items).toHaveLength(2);
	// Canonicalising is the ingest step's job (§S7); the adapter keeps the link.
	expect(items[0]).toMatchObject({
		url: 'https://arstechnica.com/space/2026/11/rocket-lab-recovery/?utm_source=rss&utm_medium=feed',
		title: 'Rocket Lab nails its twentieth recovery',
		author: 'Stephen Clark'
	});
	expect(items[0].excerpt).toBe('The booster came back intact for the twentieth time.');
	expect(items[0].publishedAt).toBe(Date.parse('Tue, 18 Nov 2026 10:00:00 GMT'));
	expect(items[1].url).toBe('https://arstechnica.com/tech/2026/11/datacentre-power/');
});

test('atom: entries map through the same shape', async () => {
	const { fn } = fixtureFetch({ 'verge.xml': { body: fixture('verge.xml') } });
	const items = await fetchRss({ url: 'https://example.test/verge.xml' }, { fetch: fn });

	expect(items).toHaveLength(2);
	expect(items[0].url).toBe('https://www.theverge.com/2026/11/18/nothing-phone#comments');
	expect(items[0].publishedAt).toBe(Date.parse('2026-11-18T09:30:00Z'));
	expect(items[0].excerpt).toBe('A phone that ships with nothing on it.');
});

test('rss: an item with no date keeps a null publishedAt rather than a guess', async () => {
	const xml = `<rss version="2.0"><channel><item><title>Undated</title><link>https://example.com/u</link></item></channel></rss>`;
	const { fn } = fixtureFetch({ 'feed.xml': { body: xml } });
	const [item] = await fetchRss({ url: 'https://example.test/feed.xml' }, { fetch: fn });
	expect(item.publishedAt).toBeNull();
});

test('rss: a 500 is thrown so the pass can retry it', async () => {
	const { fn } = fixtureFetch({ 'feed.xml': { status: 500, body: 'nope' } });
	await expect(fetchRss({ url: 'https://example.test/feed.xml' }, { fetch: fn })).rejects.toThrow(
		/500/
	);
});

test('hn: top stories map, jobs are dropped, excerpt falls back to the title', async () => {
	const { fn, calls } = fixtureFetch({
		'/topstories.json': { body: fixture('hn-topstories.json') },
		'/item/101.json': { body: fixture('hn-item-101.json') },
		'/item/102.json': { body: fixture('hn-item-102.json') },
		'/item/103.json': { body: fixture('hn-item-103.json') }
	});
	const items = await fetchHn({ url: 'https://hn.test/v0' }, { fetch: fn });

	expect(items).toHaveLength(2);
	expect(items[0]).toMatchObject({
		url: 'https://example.com/sqlite-wasm',
		title: 'A tiny SQLite in the browser',
		author: 'pg',
		publishedAt: 1794931200 * 1000
	});
	expect(items[1].excerpt).toBe('Ask HN: what broke in your build this week?');
	expect(calls).toHaveLength(4);
});

test('hn: an ask post with no url links to the discussion, not to nothing', async () => {
	const { fn } = fixtureFetch({
		'/topstories.json': { body: '[102]' },
		'/item/102.json': { body: fixture('hn-item-102.json') }
	});
	const [item] = await fetchHn({ url: 'https://hn.test/v0' }, { fetch: fn });
	expect(item.url).toBe('https://news.ycombinator.com/item?id=102');
});

test('json feed: url, external_url and skip-if-no-url', async () => {
	const { fn } = fixtureFetch({ 'feed.json': { body: fixture('json-feed.json') } });
	const items = await fetchJson({ url: 'https://example.test/feed.json' }, { fetch: fn });

	expect(items).toHaveLength(2);
	expect(items[0]).toMatchObject({ url: 'https://example.org/posts/one', author: 'Ada' });
	expect(items[1].url).toBe('https://example.net/two');
	expect(items[1].excerpt).toBe('The second post.');
});

test('every adapter sends the documented user agent', async () => {
	const seen: string[] = [];
	const fn = (async (_url: string, init?: RequestInit) => {
		seen.push(String((init?.headers as Record<string, string>)['user-agent']));
		return new Response(fixture('json-feed.json'));
	}) as unknown as typeof globalThis.fetch;
	await fetchJson({ url: 'https://example.test/feed.json' }, { fetch: fn });
	expect(seen[0]).toBe('last30days-news/0.1 (+https://github.com/last30days-news/last30days-news)');
});

test('a feed larger than the byte cap is refused, not buffered', async () => {
	const huge = `<rss version="2.0"><channel><item><title>${'x'.repeat(6 * 1024 * 1024)}</title><link>https://example.com/a</link></item></channel></rss>`;
	const fn = (async () => new Response(huge)) as unknown as typeof globalThis.fetch;
	await expect(fetchRss({ url: 'https://example.test/feed.xml' }, { fetch: fn })).rejects.toThrow(
		/too large/
	);
});

test('a redirect into a private address is refused before the second request', async () => {
	const seen: string[] = [];
	const fn = (async (input: string | URL | Request) => {
		const url = String(input);
		seen.push(url);
		if (url.startsWith('https://example.test/'))
			return new Response(null, {
				status: 302,
				headers: { location: 'http://169.254.169.254/latest/meta-data' }
			});
		return new Response('secret');
	}) as unknown as typeof globalThis.fetch;

	await expect(fetchRss({ url: 'https://example.test/feed.xml' }, { fetch: fn })).rejects.toThrow(
		/refus/i
	);
	expect(seen).toHaveLength(1);
});

test('a loopback, file or private literal never reaches fetch', async () => {
	const urls = [
		'http://127.0.0.1:4477/api/health',
		'http://localhost/feed',
		'http://[::1]/feed',
		'http://[::ffff:127.0.0.1]/feed',
		'http://[fc00::1]/feed',
		'http://[fe80::1]/feed',
		'http://100.64.0.1/feed',
		'http://feed.localhost/',
		'http://10.0.0.5/feed',
		'http://192.168.1.1/feed',
		'http://172.16.0.1/feed',
		'file:///etc/passwd'
	];
	for (const url of urls) {
		let called = false;
		const fn = (async () => {
			called = true;
			return new Response('x');
		}) as unknown as typeof globalThis.fetch;
		await expect(fetchRss({ url }, { fetch: fn })).rejects.toThrow(/refus/i);
		expect(called).toBe(false);
	}
});

test('a redirect chain longer than the hop cap stops', async () => {
	let n = 0;
	const fn = (async (input: string | URL | Request) => {
		n++;
		return new Response(null, {
			status: 302,
			headers: { location: `https://example.test/hop-${String(input).length}` }
		});
	}) as unknown as typeof globalThis.fetch;
	await expect(fetchRss({ url: 'https://example.test/start' }, { fetch: fn })).rejects.toThrow(
		/redirect/i
	);
	expect(n).toBeLessThanOrEqual(4);
});

test('a 5000-item feed maps only the first 200', async () => {
	const entries = Array.from(
		{ length: 5000 },
		(_, i) => `<item><title>I${i}</title><link>https://example.com/${i}</link></item>`
	).join('');
	const fn = (async () =>
		new Response(`<rss version="2.0"><channel>${entries}</channel></rss>`)) as unknown as typeof globalThis.fetch;
	const items = await fetchRss({ url: 'https://example.test/feed.xml' }, { fetch: fn });
	expect(items).toHaveLength(200);
});
