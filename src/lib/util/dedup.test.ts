import { expect, test } from 'vitest';
import { jaccard, titleKey } from '#lib/util/dedup';

const keyCases: [string, string][] = [
	['Hello, World!', 'hello world'],
	['  Multiple   spaces\tand\nnewlines  ', 'multiple spaces and newlines'],
	['“Smart” quotes — and dashes', 'smart quotes and dashes'],
	// Punctuation separates words instead of gluing them together.
	['C++ & C#', 'c c'],
	['MiXeD CaSe', 'mixed case'],
	['café', 'café'],
	['cafe\u0301', 'café'],
	['...', ''],
	['', '']
];

for (const [input, expected] of keyCases) {
	test(`titleKey ${JSON.stringify(input)}`, () => {
		expect(titleKey(input)).toBe(expected);
	});
}

test('titleKey has no punctuation and no repeated whitespace', () => {
	const key = titleKey('  Breaking: “AI” -- is   it, really?! ');
	expect(key).toBe('breaking ai is it really');
	expect(key).not.toMatch(/[^\p{L}\p{N}\p{M} ]/u);
});

test('jaccard is 1 for identical keys and 0 for disjoint ones', () => {
	expect(jaccard(titleKey('one two three'), titleKey('One, Two — Three!'))).toBe(1);
	expect(jaccard(titleKey('one two'), titleKey('three four'))).toBe(0);
});

test('jaccard is 0 when either side is empty', () => {
	expect(jaccard('', '')).toBe(0);
	expect(jaccard(titleKey('...'), titleKey('word'))).toBe(0);
	expect(jaccard(titleKey('word'), titleKey('...'))).toBe(0);
});

test('jaccard counts a repeated token once', () => {
	expect(jaccard(titleKey('a a a b'), titleKey('a b b'))).toBe(1);
});

test('the boundary is 0.72: 18 shared of 25 tokens merges', () => {
	const shared = Array.from({ length: 18 }, (_, i) => `term${i + 1}`);
	const other = Array.from({ length: 7 }, (_, i) => `extra${i + 1}`);
	const score = jaccard(titleKey(shared.join(' ')), titleKey([...shared, ...other].join(' ')));
	expect(score).toBe(0.72);
});

test('0.68 is below the boundary', () => {
	const shared = Array.from({ length: 18 }, (_, i) => `term${i + 1}`);
	const other = Array.from({ length: 7 }, (_, i) => `extra${i + 1}`);
	const score = jaccard(titleKey(shared.join(' ')), titleKey([...shared.slice(0, 17), ...other].join(' ')));
	expect(score).toBe(0.68);
});

test('a 100k-char title is compared on a bounded token sample', () => {
	const prefix = Array.from({ length: 64 }, (_, i) => `p${i}`).join(' ');
	const a = `${prefix} ${Array.from({ length: 10_000 }, (_, i) => `a${i}`).join(' ')}`;
	const b = `${prefix} ${Array.from({ length: 10_000 }, (_, i) => `b${i}`).join(' ')}`;
	expect(jaccard(titleKey(a), titleKey(b))).toBe(1);
});

test('an RTL override and combining marks do not break the key', () => {
	expect(titleKey('\u202Egnp.exe\u202C')).toBe('gnp exe');
	// A title of only combining marks has no word to key on; it must not throw.
	expect(titleKey('\u0301\u0301\u0301')).toBe('\u0301\u0301\u0301');
});
