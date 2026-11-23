import { describe, expect, it } from 'vitest';
import { resolveKey, stepIndex, type KeyAction } from './keys';

type Case = {
	name: string;
	key: string;
	typing?: boolean;
	awaitingG?: boolean;
	activable?: boolean;
	ctrl?: boolean;
	meta?: boolean;
	alt?: boolean;
	want: KeyAction;
};

const cases: Case[] = [
	{ name: 'slash focuses search', key: '/', want: 'search' },
	{ name: 'j moves down', key: 'j', want: 'next' },
	{ name: 'k moves up', key: 'k', want: 'prev' },
	{ name: 'Enter opens', key: 'Enter', want: 'open' },
	{ name: 'Esc closes', key: 'Escape', want: 'escape' },
	{ name: 'r refreshes', key: 'r', want: 'refresh' },
	{ name: '1 is 24h', key: '1', want: 'preset-24h' },
	{ name: '2 is 7d', key: '2', want: 'preset-7d' },
	{ name: '3 is 30d', key: '3', want: 'preset-30d' },
	{ name: '? opens the map', key: '?', want: 'help' },
	{ name: 'g arms the chord', key: 'g', want: 'g' },
	{ name: 's after g opens settings', key: 's', awaitingG: true, want: 'settings' },
	// A chord key without `g` first must do nothing at all.
	{ name: 's alone is not a shortcut', key: 's', want: null },
	{ name: 'an unbound key is ignored', key: 'x', want: null },
	{ name: 'an unbound chord key is ignored', key: 'z', awaitingG: true, want: null },
	// A text input owns every key except Esc, or typing would fight the shortcuts.
	{ name: 'typing swallows slash', key: '/', typing: true, want: null },
	{ name: 'typing swallows j', key: 'j', typing: true, want: null },
	{ name: 'typing swallows 1', key: '1', typing: true, want: null },
	{ name: 'typing swallows the chord', key: 'g', typing: true, want: null },
	{ name: 'typing keeps Esc', key: 'Escape', typing: true, want: 'escape' },
	// Enter on a focused control activates it; the page must not steal it.
	{ name: 'Enter on a button is the button', key: 'Enter', activable: true, want: null },
	{ name: 'j still moves while a button has focus', key: 'j', activable: true, want: 'next' },
	// Browser and OS shortcuts stay theirs, except Esc.
	{ name: 'ctrl+j is the browser', key: 'j', ctrl: true, want: null },
	{ name: 'meta+r is a reload', key: 'r', meta: true, want: null },
	{ name: 'alt+1 is the OS', key: '1', alt: true, want: null }
];

describe('resolveKey', () => {
	for (const entry of cases) {
		it(entry.name, () => {
			const action = resolveKey(
				{ key: entry.key, ctrlKey: entry.ctrl, metaKey: entry.meta, altKey: entry.alt },
				{
					typing: entry.typing ?? false,
					awaitingG: entry.awaitingG ?? false,
					activable: entry.activable ?? false
				}
			);
			expect(action).toBe(entry.want);
		});
	}
});

describe('stepIndex', () => {
	it('steps within bounds', () => {
		expect(stepIndex(5, 0, 1)).toBe(1);
		expect(stepIndex(5, 3, 1)).toBe(4);
		expect(stepIndex(5, 4, 1)).toBe(null);
		expect(stepIndex(5, 4, -1)).toBe(3);
		expect(stepIndex(5, 0, -1)).toBe(null);
	});

	it('selects the first row when nothing is selected', () => {
		expect(stepIndex(5, -1, 1)).toBe(0);
		expect(stepIndex(5, -1, -1)).toBe(0);
	});

	it('reports nothing to step through in an empty list', () => {
		expect(stepIndex(0, -1, 1)).toBe(null);
		expect(stepIndex(0, 0, 1)).toBe(null);
	});
});
