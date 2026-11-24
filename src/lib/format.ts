const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function localDate(ms: number, now: number): string {
	const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
	return new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: sameYear ? undefined : 'numeric'
	}).format(ms);
}

/**
 * §S12 rows and §S17 detail byline. A feed with no publish date falls back to
 * the fetch time, so the estimate marker must travel with the timestamp.
 */
export function formatWhen(ms: number, now: number, estimated = false): string {
	const marker = estimated ? '~' : '';
	const elapsed = now - ms;
	if (elapsed < MINUTE) return `${marker}now`;
	if (elapsed < HOUR) return `${marker}${Math.floor(elapsed / MINUTE)}m ago`;
	if (elapsed < DAY) return `${marker}${Math.floor(elapsed / HOUR)}h ago`;
	if (elapsed < 7 * DAY) return `${marker}${Math.floor(elapsed / DAY)}d ago`;
	return `${marker}${localDate(ms, now)}`;
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'for', 'on', 'in', 'at', 'to']);

function initial(word: string): string {
	return Array.from(word)[0] ?? '';
}

/** Compact `fav` badge text: at most two initials, never empty. */
export function sourceInitials(name: string | null | undefined): string {
	// The badge is text, so it needs the same bidi/control strip as the title.
	const cleaned = displayText(name ?? '');
	if (!cleaned) return '?';

	const words = cleaned.split(/\s+/);
	const meaningful = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()));
	const chosen = meaningful.length ? meaningful : words;
	const letters = chosen.slice(0, 2).map(initial).join('');
	return letters.toUpperCase() || '?';
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const BIDI = /[\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const LINE_BREAK = /[\t\n\r\u2028\u2029]+/g;

/** The entities feeds actually emit; anything else stays literal. */
const NAMED: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	hellip: '…',
	mdash: '—',
	ndash: '–',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”',
	middot: '·',
	bull: '•'
};

const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z]+);/gi;

function decodeEntities(value: string): string {
	return value.replace(ENTITY, (whole, body: string) => {
		if (body.startsWith('#')) {
			const code =
				body[1] === 'x' || body[1] === 'X'
					? Number.parseInt(body.slice(2), 16)
					: Number.parseInt(body.slice(1), 10);
			return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
		}
		return NAMED[body.toLowerCase()] ?? whole;
	});
}

/**
 * Feed content is stored raw. Bidi controls and zero-width characters can
 * disguise the text a person reads, so drop them before rendering. Entities are
 * decoded first: feeds ship `[&#8230;]` where they mean `[…]`.
 */
export function displayText(value: string): string {
	return decodeEntities(value)
		.normalize('NFC')
		.replace(LINE_BREAK, ' ')
		.replace(CONTROL, '')
		.replace(BIDI, '')
		.trim();
}

/**
 * Prose keeps its paragraph breaks. A feed or model can hand over multi-line
 * copy, and flattening every newline into one block makes the detail pane read
 * as a wall of text. Single newlines stay spaces so hard-wrapped text survives.
 */
export function displayParagraphs(value: string | null | undefined): string[] {
	if (!value) return [];
	return value
		.replace(/\r\n?/g, '\n')
		.split(/\n\s*\n+/)
		.map(displayText)
		.filter((paragraph) => paragraph.length > 0);
}

/** Only absolute http(s) links may reach an `href` in the dashboard. */
export function safeHref(value: string | null | undefined): string {
	const raw = value?.trim();
	if (!raw) return '#';
	try {
		const protocol = new URL(raw).protocol;
		return protocol === 'http:' || protocol === 'https:' ? raw : '#';
	} catch {
		return '#';
	}
}
