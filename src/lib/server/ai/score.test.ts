import { describe, expect, test } from 'vitest';
import { buildScorePrompt, parseScoreOutput, type ScoreItem } from './score';

const IDS = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)];

const items: ScoreItem[] = [
	{
		id: IDS[0],
		title: 'A chip ships',
		source: 'Ars Technica',
		publishedAt: 1_700_000_000_000,
		excerpt: 'The chip is faster.'
	}
];

describe('score output parsing', () => {
	test('accepts one score per id and fills a missing id with zero', () => {
		const parsed = parseScoreOutput(
			JSON.stringify({
				scores: [
					{ id: IDS[0], score: 0.9, reason: 'A chip story' },
					{ id: IDS[2], score: 0.1 }
				]
			}),
			IDS
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.scores).toEqual([
			{ id: IDS[0], score: 0.9, reason: 'A chip story' },
			{ id: IDS[1], score: 0, reason: null },
			{ id: IDS[2], score: 0.1, reason: null }
		]);
	});

	test('accepts a fenced JSON object', () => {
		const parsed = parseScoreOutput(
			'```json\n{"scores":[{"id":"' + IDS[0] + '","score":0.5}]}\n```',
			[IDS[0]]
		);
		expect(parsed.ok).toBe(true);
	});

	test.each([
		['not JSON', 'nope'],
		['an array root', '[]'],
		['a missing scores key', '{}'],
		['an unknown id', JSON.stringify({ scores: [{ id: 'z'.repeat(40), score: 0.5 }] })],
		[
			'a duplicate id',
			JSON.stringify({
				scores: [
					{ id: IDS[0], score: 0.5 },
					{ id: IDS[0], score: 0.6 }
				]
			})
		],
		['a score above one', JSON.stringify({ scores: [{ id: IDS[0], score: 1.1 }] })],
		['a negative score', JSON.stringify({ scores: [{ id: IDS[0], score: -0.1 }] })],
		[
			'a reason over 90 chars',
			JSON.stringify({ scores: [{ id: IDS[0], score: 0.5, reason: 'x'.repeat(91) }] })
		],
		[
			'HTML in a reason',
			JSON.stringify({ scores: [{ id: IDS[0], score: 0.5, reason: '<b>click</b>' }] })
		],
		[
			'extra fields in a score',
			JSON.stringify({ scores: [{ id: IDS[0], score: 0.5, why: 'x' }] })
		],
		[
			'extra fields at the root',
			JSON.stringify({ scores: [{ id: IDS[0], score: 0.5 }], note: 'x' })
		]
	])('rejects %s', (_label, text) => {
		expect(parseScoreOutput(text, IDS).ok).toBe(false);
	});
});

describe('score prompt', () => {
	test('contains the intent and only the allowed item fields', () => {
		const prompt = buildScorePrompt('Stories about chips', items);
		expect(prompt).toContain('Stories about chips');
		expect(prompt).toContain('A chip ships');
		expect(prompt).toContain('Ars Technica');
		expect(prompt).toContain('The chip is faster.');
		expect(prompt).not.toContain('https://example.com');
		expect(prompt).not.toContain('"url"');
	});

	test('caps excerpts at 800 characters', () => {
		const prompt = buildScorePrompt('x', [{ ...items[0], excerpt: 'y'.repeat(900) }]);
		expect(prompt).toContain('y'.repeat(800));
		expect(prompt).not.toContain('y'.repeat(801));
	});

	test('caps titles so a hostile feed cannot blow up the prompt', () => {
		const prompt = buildScorePrompt('x', [{ ...items[0], title: 'T'.repeat(900) }]);
		expect(prompt).toContain('T'.repeat(300));
		expect(prompt).not.toContain('T'.repeat(301));
	});
});
