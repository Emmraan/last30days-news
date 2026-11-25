import Parser from 'rss-parser';
import { readText, safeFetch, UnsafeUrlError, type FetchCtx } from './raw';

const parser = new Parser();
const TIMEOUT_MS = 10_000;
const FEED_TITLE_MAX = 120;

export type ProbeResult =
	| { ok: true; kind: 'rss' | 'json'; feedTitle: string | null; itemCount: number }
	| {
			ok: false;
			code: 'invalid_url' | 'blocked_url' | 'fetch_failed' | 'too_large' | 'not_a_feed';
			message: string;
	  };

function fail(
	code: Extract<ProbeResult, { ok: false }>['code'],
	message: string
): ProbeResult {
	return { ok: false, code, message };
}

function looksJson(text: string, contentType: string | null): boolean {
	if (contentType?.toLowerCase().includes('json')) return true;
	const first = text.trimStart()[0];
	return first === '{' || first === '[';
}

/** A feed title becomes a source name, so it needs the same 120-char bound. */
function cleanFeedTitle(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value
		.replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text ? text.slice(0, FEED_TITLE_MAX) : null;
}

function jsonFeed(text: string): ProbeResult {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return fail('not_a_feed', 'That URL did not parse as a feed.');
	}
	if (!value || typeof value !== 'object') return fail('not_a_feed', 'That URL did not parse as a feed.');
	const feed = value as { title?: unknown; items?: unknown };
	if (!Array.isArray(feed.items)) return fail('not_a_feed', 'That URL did not parse as a feed.');
	const usable = feed.items.filter((entry) => {
		if (!entry || typeof entry !== 'object') return false;
		const item = entry as { url?: unknown; external_url?: unknown; title?: unknown };
		const link = typeof item.url === 'string' ? item.url : item.external_url;
		return typeof link === 'string' && link.trim() !== '' && typeof item.title === 'string' && item.title.trim() !== '';
	});
	if (usable.length === 0) return fail('not_a_feed', 'That URL did not parse as a feed.');
	return {
		ok: true,
		kind: 'json',
		feedTitle: cleanFeedTitle(feed.title),
		itemCount: usable.length
	};
}

async function rssFeed(text: string): Promise<ProbeResult> {
	let feed: Awaited<ReturnType<Parser['parseString']>>;
	try {
		feed = await parser.parseString(text);
	} catch {
		return fail('not_a_feed', 'That URL did not parse as an RSS or Atom feed.');
	}
	const usable = (feed.items ?? []).filter(
		(entry) => entry.link?.trim() && entry.title?.trim()
	);
	if (usable.length === 0)
		return fail('not_a_feed', 'That URL did not parse as an RSS or Atom feed.');
	return {
		ok: true,
		kind: 'rss',
		feedTitle: cleanFeedTitle(feed.title),
		itemCount: usable.length
	};
}

/**
 * S4/S10: one fetch proves a pasted URL before anything is saved. It uses the
 * same SSRF guard, byte cap and redirect checks as the normal fetch pass.
 */
export async function probeFeed(url: string, ctx: FetchCtx): Promise<ProbeResult> {
	const target = url.trim();
	if (!target) return fail('invalid_url', 'Enter a feed URL.');

	let res: Response;
	try {
		res = await safeFetch(target, {
			fetch: ctx.fetch,
			signal: ctx.signal ?? AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (error) {
		if (error instanceof UnsafeUrlError)
			return fail(
				error.code,
				error.code === 'invalid_url'
					? 'Enter a valid http or https feed URL.'
					: 'That URL is not allowed.'
			);
		return fail('fetch_failed', 'That URL could not be fetched.');
	}

	if (!res.ok) return fail('fetch_failed', 'That URL could not be fetched.');

	let text: string;
	try {
		text = await readText(res);
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message.includes('too large')) return fail('too_large', 'That feed is too large.');
		return fail('fetch_failed', 'That URL could not be fetched.');
	}

	if (looksJson(text, res.headers.get('content-type'))) return jsonFeed(text);
	return rssFeed(text);
}
