import { describe, expect, test } from 'vitest';
import { keywordGlob, matchesAnyKeyword, matchesKeyword } from './keywords';

describe('keyword matching', () => {
	const cases: [string, string, string, boolean][] = [
		['exact', 'AI', 'AI', true],
		['case folds', 'the Ai race', 'ai', true],
		['start of text', 'GPT-5 ships', 'gpt-5', true],
		['end of text', 'All about GPT-5', 'gpt-5', true],
		['punctuation boundary', 'A GPT-5, a sequel', 'gpt-5', true],
		['no substring match', 'article about chips', 'art', false],
		['no suffix match', 'GPT-5x is not GPT-5', 'gpt-5x', true],
		['hyphen is a boundary', 'a GPT-5x', 'gpt', true],
		['underscore is a word character', 'a_b', 'a_b', true],
		['underscore blocks a boundary', 'a_b', 'b', false],
		['space is not underscore', 'a b', 'a_b', false],
		['later occurrence counts', 'scatter cat', 'cat', true],
		['regex characters are literal', 'a+b', 'a+b', true],
		['regex characters are not a pattern', 'aab', 'a+b', false],
		['brackets are literal', 'x [y] z', '[y]', true],
		['brackets still need a boundary', 'x[y] z', '[y]', false],
		['brackets with a boundary', 'x [y] z', 'y', true],
		['empty keyword never matches', 'anything', '', false]
	];

	test.each(cases)('%s: %s / %s', (_label, text, keyword, expected) => {
		expect(matchesKeyword(text, keyword)).toBe(expected);
	});

	test('a null excerpt is treated as empty', () => {
		expect(matchesKeyword(null, 'ai')).toBe(false);
	});

	test('title and excerpt both count', () => {
		expect(matchesAnyKeyword('A new chip', 'It runs AI models.', ['ai'])).toBe(true);
		expect(matchesAnyKeyword('A new chip', 'It runs AI models.', ['gpu'])).toBe(false);
		expect(matchesAnyKeyword('A new chip', null, ['chip'])).toBe(true);
	});

	test('one empty keyword does not hide another', () => {
		expect(matchesAnyKeyword('AI news', null, ['', 'ai'])).toBe(true);
	});
});

describe('SQL GLOB patterns', () => {
	test('escape GLOB metacharacters so keywords stay literal', () => {
		expect(keywordGlob('a*b')).toBe('*[^a-z0-9_]a[*]b[^a-z0-9_]*');
		expect(keywordGlob('a?b')).toBe('*[^a-z0-9_]a[?]b[^a-z0-9_]*');
		expect(keywordGlob('a[b')).toBe('*[^a-z0-9_]a[[]b[^a-z0-9_]*');
	});

	test('lowercase the keyword and keep the boundary guards', () => {
		expect(keywordGlob('GPT-5')).toBe('*[^a-z0-9_]gpt-5[^a-z0-9_]*');
	});
});
