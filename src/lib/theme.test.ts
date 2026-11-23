import { expect, test } from 'vitest';
import { readTheme, THEME_COOKIE } from './theme';

test('the theme cookie has a stable name', () => {
	expect(THEME_COOKIE).toBe('l30_theme');
});

test('only the two exact theme values are accepted', () => {
	const cases: [string | null | undefined, 'dark' | 'light' | null][] = [
		['dark', 'dark'],
		['light', 'light'],
		['Dark', null],
		['light ', null],
		[' dark', null],
		['system', null],
		['', null],
		[null, null],
		[undefined, null]
	];
	for (const [value, expected] of cases) {
		expect(readTheme(value), String(value)).toBe(expected);
	}
});
