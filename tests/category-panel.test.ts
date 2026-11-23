import { describe, expect, it } from 'vitest';
import { moveCategory, parseKeywords, takeScoreEvents } from '../src/lib/category-panel';

describe('moveCategory', () => {
	const rows = [
		{ id: 'technology', sortOrder: 0 },
		{ id: 'ai', sortOrder: 1 },
		{ id: 'usr-chips', sortOrder: 2 }
	];

	it('moves a row up by rewriting sortOrder from list position', () => {
		expect(moveCategory(rows, 'usr-chips', 'up')).toEqual([
			{ id: 'technology', sortOrder: 0 },
			{ id: 'usr-chips', sortOrder: 1 },
			{ id: 'ai', sortOrder: 2 }
		]);
	});

	it('moves a row down by rewriting sortOrder from list position', () => {
		expect(moveCategory(rows, 'technology', 'down')).toEqual([
			{ id: 'ai', sortOrder: 0 },
			{ id: 'technology', sortOrder: 1 },
			{ id: 'usr-chips', sortOrder: 2 }
		]);
	});

	it('returns null at the ends and for an unknown id', () => {
		expect(moveCategory(rows, 'technology', 'up')).toBeNull();
		expect(moveCategory(rows, 'usr-chips', 'down')).toBeNull();
		expect(moveCategory(rows, 'nope', 'up')).toBeNull();
	});

	it('reorders two tied rows in both directions', () => {
		const tied = [
			{ id: 'a', sortOrder: 0 },
			{ id: 'b', sortOrder: 0 }
		];
		expect(moveCategory(tied, 'b', 'up')).toEqual([
			{ id: 'b', sortOrder: 0 },
			{ id: 'a', sortOrder: 1 }
		]);
		expect(moveCategory(tied, 'a', 'down')).toEqual([
			{ id: 'b', sortOrder: 0 },
			{ id: 'a', sortOrder: 1 }
		]);
	});
});

describe('parseKeywords', () => {
	it('splits on commas and newlines and drops duplicates', () => {
		expect(parseKeywords('gpt-5, chips\n GPT-5 , ,neurons')).toEqual(['gpt-5', 'chips', 'neurons']);
	});

	it('returns nothing for blank input', () => {
		expect(parseKeywords('  , \n ')).toEqual([]);
	});
});

describe('takeScoreEvents', () => {
	it('parses whole frames and keeps the partial tail', () => {
		const buffer =
			'data: {"type":"progress","scored":1,"total":4}\n\n' +
			'data: {"type":"done","scored":4,"total":4,"degraded":false}\n\n' +
			'data: {"type":"prog';
		const result = takeScoreEvents(buffer);
		expect(result.events).toEqual([
			{ type: 'progress', scored: 1, total: 4 },
			{ type: 'done', scored: 4, total: 4, degraded: false }
		]);
		expect(result.rest).toBe('data: {"type":"prog');
	});

	it('skips a malformed frame and keeps reading', () => {
		const result = takeScoreEvents('data: nope\n\ndata: {"type":"degraded","code":"ai_failed"}\n\n');
		expect(result.events).toEqual([{ type: 'degraded', code: 'ai_failed' }]);
		expect(result.rest).toBe('');
	});
});
