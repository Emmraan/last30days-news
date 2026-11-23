import { expect, test } from 'vitest';
import { compareRank, type Rankable } from '#lib/util/rank';

const row = (id: string, sourceCount: number, publishedAt: number): Rankable => ({
	id,
	sourceCount,
	publishedAt
});

test('source_count desc comes first', () => {
	const sorted = [row('a', 1, 300), row('b', 2, 100), row('c', 1, 200)].sort(compareRank);
	expect(sorted.map((r) => r.id)).toEqual(['b', 'a', 'c']);
});

test('published_at desc breaks a source_count tie', () => {
	const sorted = [row('old', 1, 100), row('new', 1, 300), row('mid', 1, 200)].sort(compareRank);
	expect(sorted.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
});

test('id asc breaks a full tie', () => {
	const sorted = [row('c', 1, 100), row('a', 1, 100), row('b', 1, 100)].sort(compareRank);
	expect(sorted.map((r) => r.id)).toEqual(['a', 'b', 'c']);
	expect(compareRank(row('x', 1, 100), row('x', 1, 100))).toBe(0);
});

test('the comparator is a total order', () => {
	const a = row('a', 1, 100);
	const b = row('b', 2, 50);
	expect(Math.sign(compareRank(a, b))).toBe(-Math.sign(compareRank(b, a)));
});
