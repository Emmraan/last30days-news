/**
 * S16: one NDJSON line per event on stdout. Never a request body, an item
 * body, a key, a hash or a cookie — the scrub below is the last line of
 * defence, not the first: callers still must not pass them.
 */
export type Level = 'error' | 'warn' | 'info' | 'debug';

const SENSITIVE =
	/password|cookie|hash|secret|token|api[-_]?key|authorization|title|excerpt|body|content/i;

function scrub(value: unknown, depth = 0): unknown {
	if (value instanceof Error) return { name: value.name };
	if (depth > 4) return '[deep]';
	if (Array.isArray(value)) {
		return value
			.map((v) => scrub(v, depth + 1))
			.filter((v) => !(v && typeof v === 'object' && Object.keys(v).length === 0));
	}
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			if (SENSITIVE.test(k)) continue;
			out[k] = scrub(v, depth + 1);
		}
		return out;
	}
	return value;
}

export function log(level: Level, event: string, data: Record<string, unknown> = {}) {
	if (level === 'debug' && process.env.L30_DEBUG !== '1') return;
	process.stdout.write(
		JSON.stringify({ ts: Date.now(), level, event, data: scrub(data) }) + '\n'
	);
}
