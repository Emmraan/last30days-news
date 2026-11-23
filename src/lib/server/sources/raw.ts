/** One shape for all three source kinds (§S5). */
export type RawItem = {
	url: string;
	title: string;
	author?: string | null;
	publishedAt?: number | null;
	excerpt?: string | null;
};

export type FetchCtx = { fetch: typeof globalThis.fetch; signal?: AbortSignal };

export const USER_AGENT =
	'last30days-news/0.1 (+https://github.com/last30days-news/last30days-news)';

/** §S6: no source may flood the DB in one pass. */
export const MAX_ITEMS_PER_SOURCE = 200;

/**
 * §S6/§S17. A feed is untrusted input: 5 MiB is far more than any real feed
 * and small enough that a hostile one cannot exhaust memory before we look.
 * The cap is applied to the decompressed stream, so a zip bomb is caught too.
 */
export const MAX_FEED_BYTES = 5 * 1024 * 1024;

const MAX_REDIRECTS = 3;

export const requestInit = (signal?: AbortSignal): RequestInit => ({
	headers: { 'user-agent': USER_AGENT, accept: '*/*' },
	// A feed never needs the app session; a redirect back to our own origin
	// must not turn the probe into an authenticated request.
	credentials: 'omit',
	signal
});

/**
 * §4 SSRF. Loopback, link-local, private ranges and non-HTTP schemes are
 * refused before a socket is opened. DNS rebinding is out of scope: the
 * resolved address is not pinned, only the literal host is checked.
 */
const PRIVATE_HOST =
	/^(localhost\.?|.*\.localhost|127\.|0\.|10\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.0\.0\.|192\.168\.|198\.18\.|198\.19\.|.*\.local$|.*\.internal$)/i;

/** A URL the guard refuses; the code cannot be inferred from a message. */
export class UnsafeUrlError extends Error {
	constructor(
		readonly code: 'invalid_url' | 'blocked_url',
		message: string
	) {
		super(message);
		this.name = 'UnsafeUrlError';
	}
}

/** IPv6 literals arrive bracketed from `URL.hostname`. */
function privateV6(hostname: string): boolean {
	if (!hostname.startsWith('[')) return false;
	const value = hostname.slice(1, -1);
	// `::` covers unspecified, loopback, IPv4-compatible and IPv4-mapped forms.
	if (value.startsWith('::')) return true;
	if (/^f[cd]/.test(value)) return true; // fc00::/7 unique local
	if (/^fe[89abcdef]/.test(value)) return true; // fe80::/10 plus site-local
	if (/^ff/.test(value)) return true; // multicast
	if (value.startsWith('64:ff9b:')) return true; // NAT64 to an IPv4 target
	return false;
}

function publicUrl(target: string): URL {
	let url: URL;
	try {
		url = new URL(target);
	} catch {
		throw new UnsafeUrlError('invalid_url', 'refusing to fetch a malformed url');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:')
		throw new UnsafeUrlError('invalid_url', `refusing to fetch ${url.protocol} url`);
	const hostname = url.hostname.toLowerCase();
	if (PRIVATE_HOST.test(hostname) || privateV6(hostname))
		throw new UnsafeUrlError('blocked_url', `refusing to fetch ${url.hostname}`);
	return url;
}

/** Fetches a feed, refusing private targets and stopping a redirect chain. */
export async function safeFetch(target: string, { fetch, signal }: FetchCtx): Promise<Response> {
	let current = publicUrl(target).toString();
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const res = await fetch(current, { ...requestInit(signal), redirect: 'manual' });
		if (res.status < 300 || res.status >= 400) return res;
		const location = res.headers.get('location');
		if (!location) return res;
		current = publicUrl(new URL(location, current).toString()).toString();
	}
	throw new Error(`too many redirects for ${target}`);
}

/** Reads a body up to `MAX_FEED_BYTES`; `res.text()` would buffer anything. */
export async function readText(res: Response): Promise<string> {
	if (!res.body) return '';
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_FEED_BYTES) {
			await reader.cancel();
			throw new Error(`feed too large (>${MAX_FEED_BYTES} bytes)`);
		}
		chunks.push(value);
	}
	return new TextDecoder().decode(Buffer.concat(chunks));
}

const ENTITIES: Record<string, string> = {
	'&nbsp;': ' ',
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'"
};

/** Feed bodies carry HTML; nothing downstream ever renders it. */
export function toText(input: string | null | undefined): string | null {
	if (!input) return null;
	const text = input
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text || null;
}

/** Keeps a 100-id HN fetch from becoming 100 sockets at once. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
	const out: R[] = new Array(items.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (next < items.length) {
				const i = next++;
				out[i] = await fn(items[i]);
			}
		})
	);
	return out;
}
