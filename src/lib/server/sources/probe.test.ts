import { expect, test } from 'vitest';
import { probeFeed } from './probe';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example Feed</title>
  <item><title>One</title><link>https://example.com/1</link></item>
  <item><title>Two</title><link>https://example.com/2</link></item>
</channel></rss>`;

const JSON_FEED = JSON.stringify({
	version: 'https://jsonfeed.org/version/1.1',
	title: 'JSON Feed',
	items: [{ id: '1', url: 'https://example.com/1', title: 'One' }]
});

const fake = (body: string, init: ResponseInit = {}) => {
	let calls = 0;
	return {
		fetch: (async () => {
			calls++;
			return new Response(body, init);
		}) as typeof globalThis.fetch,
		calls: () => calls
	};
};

test('an RSS feed reports its title and item count', async () => {
	const f = fake(RSS, { headers: { 'content-type': 'application/rss+xml' } });
	const result = await probeFeed('https://example.com/feed.xml', { fetch: f.fetch });
	expect(result).toEqual({ ok: true, kind: 'rss', feedTitle: 'Example Feed', itemCount: 2 });
});

test('a JSON feed is detected without relying on the content type', async () => {
	const f = fake(JSON_FEED);
	const result = await probeFeed('https://example.com/feed.json', { fetch: f.fetch });
	expect(result).toMatchObject({ ok: true, kind: 'json', feedTitle: 'JSON Feed', itemCount: 1 });
});

test('HTML is not a feed', async () => {
	const f = fake('<html><body>Not a feed</body></html>');
	const result = await probeFeed('https://example.com/', { fetch: f.fetch });
	expect(result.ok).toBe(false);
});

test('a non-200 response is reported without leaking its body', async () => {
	const f = fake('secret upstream body', { status: 500 });
	const result = await probeFeed('https://example.com/feed', { fetch: f.fetch });
	expect(result).toMatchObject({ ok: false, code: 'fetch_failed' });
	expect(JSON.stringify(result)).not.toContain('secret upstream body');
});

test('a private URL is refused before a socket is opened', async () => {
	const f = fake(RSS);
	const result = await probeFeed('http://127.0.0.1:9/feed', { fetch: f.fetch });
	expect(result).toMatchObject({ ok: false, code: 'blocked_url' });
	expect(f.calls()).toBe(0);
});

test('a malformed URL is refused before a socket is opened', async () => {
	const f = fake(RSS);
	const result = await probeFeed('file:///etc/passwd', { fetch: f.fetch });
	expect(result).toMatchObject({ ok: false, code: 'invalid_url' });
	expect(f.calls()).toBe(0);
});

test('an empty feed is rejected as a bad URL rather than shown as valid', async () => {
	const f = fake('<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>');
	const result = await probeFeed('https://example.com/empty.xml', { fetch: f.fetch });
	expect(result).toMatchObject({ ok: false, code: 'not_a_feed' });
});

test('a feed whose items have no link or title is not usable', async () => {
	const rss = fake('<?xml version="1.0"?><rss version="2.0"><channel><title>Broken</title><item><description>x</description></item></channel></rss>');
	expect(
		await probeFeed('https://example.com/broken.xml', { fetch: rss.fetch })
	).toMatchObject({ ok: false, code: 'not_a_feed' });

	const json = fake(JSON.stringify({ title: 'Broken', items: [{ title: 'No link' }] }));
	expect(await probeFeed('https://example.com/broken.json', { fetch: json.fetch })).toMatchObject({
		ok: false,
		code: 'not_a_feed'
	});
});

test.each([
	['IPv4-mapped loopback', 'http://[::ffff:127.0.0.1]/feed'],
	['IPv4-compatible loopback', 'http://[::7f00:1]/feed'],
	['unique local', 'http://[fc00::1]/feed'],
	['link local', 'http://[fe80::1]/feed'],
	['multicast', 'http://[ff02::1]/feed'],
	['NAT64', 'http://[64:ff9b::7f00:1]/feed'],
	['localhost suffix', 'http://feed.localhost/'],
	['carrier-grade NAT', 'http://100.64.0.1/feed']
])('refuses %s before a socket is opened', async (_label, url) => {
	const f = fake(RSS);
	const result = await probeFeed(url, { fetch: f.fetch });
	expect(result).toMatchObject({ ok: false, code: 'blocked_url' });
	expect(f.calls()).toBe(0);
});

test('a feed title becomes a bounded source name', async () => {
	const f = fake(
		`<?xml version="1.0"?><rss version="2.0"><channel><title>${'T'.repeat(500)}</title><item><title>One</title><link>https://example.com/1</link></item></channel></rss>`
	);
	const result = await probeFeed('https://example.com/long-title.xml', { fetch: f.fetch });
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	expect(result.feedTitle).toHaveLength(120);
});

test('a redirect into a private address is refused before the second request', async () => {
	let calls = 0;
	const fetch = (async () => {
		calls++;
		return new Response(null, {
			status: 302,
			headers: { location: 'http://[fc00::1]/feed' }
		});
	}) as unknown as typeof globalThis.fetch;
	const result = await probeFeed('https://example.com/feed', { fetch });
	expect(result).toMatchObject({ ok: false, code: 'blocked_url' });
	expect(calls).toBe(1);
});
