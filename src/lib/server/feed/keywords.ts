/** S4 word characters are ASCII letters, digits and underscore in both JS and SQL. */
const WORD_CHAR = /[a-z0-9_]/i;

/** S4: plain case-insensitive match, never a regex or boolean expression. */
export function matchesKeyword(text: string | null | undefined, keyword: string): boolean {
	const haystack = (text ?? '').toLowerCase();
	const needle = keyword.trim().toLowerCase();
	if (!needle) return false;

	// A title may contain a bad occurrence before a good one ("scatter cat"),
	// so every occurrence must be tested rather than only indexOf's first hit.
	for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
		const before = at === 0 ? '' : haystack[at - 1];
		const after = haystack[at + needle.length] ?? '';
		if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true;
	}
	return false;
}

export function matchesAnyKeyword(
	title: string | null | undefined,
	excerpt: string | null | undefined,
	keywords: string[]
): boolean {
	return keywords.some(
		(keyword) => matchesKeyword(title, keyword) || matchesKeyword(excerpt, keyword)
	);
}

function escapeGlob(value: string): string {
	// Escape `[` first: later replacements introduce bracket classes of their own.
	return value.replaceAll('[', '[[]').replaceAll('*', '[*]').replaceAll('?', '[?]');
}

/**
 * S4 SQL mirror of `matchesKeyword`. The leading/trailing space is supplied by
 * the caller, so a `[^a-z0-9_]` guard matches both ends without four patterns.
 */
export function keywordGlob(keyword: string): string {
	return `*[^a-z0-9_]${escapeGlob(keyword.trim().toLowerCase())}[^a-z0-9_]*`;
}
