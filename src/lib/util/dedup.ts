/**
 * S7. Title identity is lowercase, punctuation-stripped, whitespace-collapsed.
 * Punctuation becomes a space rather than vanishing, so "AI—now" and "AI now"
 * share a key instead of gluing into "ainow".
 */
export function titleKey(input: string): string {
	return input
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
		.trim();
}

/** A hostile title can be 100k chars; a token sample is enough to compare. */
const MAX_TOKENS = 64;

/**
 * S7 token Jaccard. Both arguments are `titleKey` output, so callers
 * normalise each candidate title once instead of once per comparison.
 */
export function jaccard(a: string, b: string): number {
	const left = new Set(a ? a.split(' ').slice(0, MAX_TOKENS) : []);
	const right = new Set(b ? b.split(' ').slice(0, MAX_TOKENS) : []);
	if (!left.size || !right.size) return 0;

	let shared = 0;
	for (const token of left) if (right.has(token)) shared++;
	return shared / (left.size + right.size - shared);
}
