/** S14 keyboard map. Pure so the bindings can be tested without a DOM. */

export type KeyAction =
	| 'search'
	| 'quick-search'
	| 'next'
	| 'prev'
	| 'open'
	| 'escape'
	| 'refresh'
	| 'preset-24h'
	| 'preset-7d'
	| 'preset-30d'
	| 'settings'
	| 'help'
	| 'g'
	| null;

type KeyEvent = {
	key: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
};

type Context = {
	/** A text field has focus, so only Esc is still ours. */
	typing: boolean;
	/** `g` was pressed and the next key completes the chord. */
	awaitingG: boolean;
	/** Focus sits on a button or link, whose own Enter/Space must still work. */
	activable?: boolean;
};

const PLAIN: Record<string, KeyAction> = {
	'/': 'search',
	j: 'next',
	k: 'prev',
	Enter: 'open',
	Escape: 'escape',
	r: 'refresh',
	'1': 'preset-24h',
	'2': 'preset-7d',
	'3': 'preset-30d',
	'?': 'help',
	g: 'g'
};

export function resolveKey(event: KeyEvent, context: Context): KeyAction {
	// Ctrl/Cmd+K is the one browser shortcut the app claims: quick search.
	if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
		return 'quick-search';
	}

	// Every other modifying key belongs to the browser or the OS, never to the feed.
	if (event.ctrlKey || event.metaKey || event.altKey) return null;

	if (context.typing) return event.key === 'Escape' ? 'escape' : null;

	// The chord is only ever `g` then `s`; anything else after `g` is dropped.
	if (context.awaitingG) {
		return event.key === 's' ? 'settings' : null;
	}

	const action = PLAIN[event.key] ?? null;

	// Enter on a focused button or link belongs to that control, or the button
	// becomes unusable from the keyboard.
	if (action === 'open' && context.activable) return null;

	return action;
}

/** Returns the index to select, or null to stay put (edges and empty lists). */
export function stepIndex(length: number, current: number, delta: 1 | -1): number | null {
	if (length === 0) return null;
	if (current < 0) return 0;

	const next = current + delta;
	return next >= 0 && next < length ? next : null;
}
