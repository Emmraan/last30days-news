import { createHash } from 'node:crypto';

/** S7: params that never identify an article, only the click. */
const DROPPED = new Set([
	'fbclid',
	'gclid',
	'ref',
	'ref_src',
	'source',
	'mc_cid',
	'mc_eid',
	'igshid'
]);

/**
 * S7. Returns null for anything that is not an http(s) URL, so a `file:` or
 * `javascript:` link from a hostile feed never becomes an item.
 */
export function canonicalUrl(input: string): string | null {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

	const host = url.host.replace(/^www\./, '');
	const params = [...url.searchParams]
		.filter(([k]) => !DROPPED.has(k) && !k.toLowerCase().startsWith('utm_'))
		.sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : av > bv ? 1 : 0) : a < b ? -1 : 1));

	let path = url.pathname;
	while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

	const query = params.length
		? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
		: '';
	return `${url.protocol}//${host}${path}${query}`;
}

/** S7: `id = sha1(canonical)`. */
export const itemId = (canonical: string) => createHash('sha1').update(canonical).digest('hex');
