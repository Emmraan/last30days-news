/** Panel-side helpers for the category manager (P11). No DOM, no fetch. */

export type ScoreEvent =
	| { type: 'progress'; scored: number; total: number }
	| { type: 'degraded'; code: string }
	| { type: 'done'; scored: number; total: number; degraded: boolean };

type Ordered = { id: string; sortOrder: number };

/**
 * The rows to rewrite to move `id` one place. sortOrder is re-derived from list
 * position for every row, because pre-panel categories share sortOrder 0 with the
 * builtins and a plain value swap between two tied rows moves nothing. Null at the
 * ends so the caller can disable the button instead of writing a no-op PATCH.
 */
export function moveCategory(
	ordered: Ordered[],
	id: string,
	direction: 'up' | 'down'
): Ordered[] | null {
	const index = ordered.findIndex((row) => row.id === id);
	if (index < 0) return null;
	const next = direction === 'up' ? index - 1 : index + 1;
	if (next < 0 || next >= ordered.length) return null;

	const moved = [...ordered];
	[moved[index], moved[next]] = [moved[next], moved[index]];
	return moved.map((row, position) => ({ id: row.id, sortOrder: position }));
}

/** Comma or newline separated keywords, trimmed, de-duplicated case-insensitively. */
export function parseKeywords(text: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of text.split(/[,\n]/)) {
		const value = raw.trim();
		const key = value.toLowerCase();
		if (!value || seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

/** Splits buffered SSE text into whole `data:` frames; the tail is kept for the next read. */
export function takeScoreEvents(buffer: string): { events: ScoreEvent[]; rest: string } {
	const parts = buffer.split('\n\n');
	const rest = parts.pop() ?? '';
	const events: ScoreEvent[] = [];
	for (const part of parts) {
		const line = part.split('\n').find((entry) => entry.startsWith('data:'));
		if (!line) continue;
		try {
			events.push(JSON.parse(line.slice(5).trim()) as ScoreEvent);
		} catch {
			// A malformed frame must not kill the stream; the UI still waits for `done`.
		}
	}
	return { events, rest };
}
