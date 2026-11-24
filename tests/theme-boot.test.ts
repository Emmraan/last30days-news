import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';

const source = readFileSync('static/theme.js', 'utf8');

function boot(options: { classes?: string[]; stored?: string | null; cookie?: string }) {
	const classes = [...(options.classes ?? [])];
	const root = {
		classList: {
			contains: (name: string) => classes.includes(name),
			add: (name: string) => {
				if (!classes.includes(name)) classes.push(name);
			}
		}
	};
	runInNewContext(source, {
		document: { documentElement: root, cookie: options.cookie ?? '' },
		localStorage: {
			getItem: () => options.stored ?? null
		}
	});
	return classes;
}

test('a stored choice applies before paint when the server cookie is missing', () => {
	expect(boot({ stored: 'dark' })).toEqual(['dark']);
	expect(boot({ stored: 'light' })).toEqual(['light']);
});

test('the server-rendered class wins over storage', () => {
	expect(boot({ classes: ['dark'], stored: 'light' })).toEqual(['dark']);
});

test('the cookie is the fallback when storage is empty', () => {
	expect(boot({ cookie: 'l30_theme=dark; other=1' })).toEqual(['dark']);
	expect(boot({ cookie: 'other=1; l30_theme=light' })).toEqual(['light']);
});

test('a malformed or missing saved value leaves the system choice alone', () => {
	expect(boot({ stored: 'Dark', cookie: 'l30_theme=sepia' })).toEqual([]);
	expect(boot({})).toEqual([]);
});
