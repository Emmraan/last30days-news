import { describe, expect, test } from 'vitest';
import {
	DEFAULT_LIMIT,
	MAX_LIMIT,
	MAX_QUERY_CHARS,
	MAX_QUERY_TOKENS,
	decodeCursor,
	encodeCursor,
	parseFeedQuery,
	type Cursor
} from './query';

const ID = '0123456789abcdef0123456789abcdef01234567';

const roundTrip: Cursor[] = [
	{ sourceCount: 1, publishedAt: 0, id: ID },
	{ sourceCount: 3, publishedAt: 1_700_000_000_000, id: ID },
	{ sourceCount: 99, publishedAt: 9_999_999_999_999, id: 'f'.repeat(40) }
];

describe('cursor encoding', () => {
	test.each(roundTrip)('round-trips $sourceCount/$publishedAt', (cursor) => {
		expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
	});

	test('uses base64url with no padding', () => {
		const encoded = encodeCursor(roundTrip[1]);
		expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(encoded).not.toMatch(/[+/=]/);
	});

	const bad: [string, string][] = [
		['empty', ''],
		['standard base64', 'abc+def'],
		['padding', 'abcd='],
		['not base64url', 'not a cursor!'],
		['too long', 'A'.repeat(300)],
		['not JSON', Buffer.from('plain text').toString('base64url')],
		['object', Buffer.from('{}').toString('base64url')],
		['empty array', Buffer.from('[]').toString('base64url')],
		['short array', Buffer.from(JSON.stringify([1, 2])).toString('base64url')],
		['string count', Buffer.from(JSON.stringify(['1', 2, ID])).toString('base64url')],
		['fractional time', Buffer.from(JSON.stringify([1, 1.5, ID])).toString('base64url')],
		['negative time', Buffer.from(JSON.stringify([1, -1, ID])).toString('base64url')],
		['zero count', Buffer.from(JSON.stringify([0, 0, ID])).toString('base64url')],
		['short id', Buffer.from(JSON.stringify([1, 0, 'abc'])).toString('base64url')],
		['object id', Buffer.from(JSON.stringify([1, 0, { id: ID }])).toString('base64url')],
		['extra field', Buffer.from(JSON.stringify([1, 0, ID, 'x'])).toString('base64url')]
	];

	test.each(bad)('rejects %s', (_label, value) => {
		expect(decodeCursor(value)).toBeNull();
	});
});

describe('feed query parsing', () => {
	const ok = (qs: string) => {
		const parsed = parseFeedQuery(new URLSearchParams(qs));
		if (!parsed.ok) throw new Error(`expected ok, got ${parsed.code}`);
		return parsed.params;
	};
	const code = (qs: string) => {
		const parsed = parseFeedQuery(new URLSearchParams(qs));
		return parsed.ok ? 'ok' : parsed.code;
	};

	test('defaults to the documented limit and applies no filters', () => {
		expect(ok('')).toEqual({ limit: DEFAULT_LIMIT });
	});

	test('accepts the limit range and rejects everything outside it', () => {
		expect(ok('limit=1').limit).toBe(1);
		expect(ok(`limit=${MAX_LIMIT}`).limit).toBe(MAX_LIMIT);
		for (const bad of ['0', '-1', '1.5', 'abc', '', String(MAX_LIMIT + 1), '100000', '1e3']) {
			expect(code(`limit=${bad}`)).toBe('invalid_limit');
		}
	});

	test('accepts integer millisecond bounds, including equal bounds', () => {
		expect(ok('from=1000&to=2000')).toMatchObject({ from: 1000, to: 2000 });
		expect(ok('from=0&to=0')).toMatchObject({ from: 0, to: 0 });
		expect(ok('from=2000')).toMatchObject({ from: 2000 });
		expect(ok('to=2000')).toMatchObject({ to: 2000 });
	});

	test('rejects malformed and inverted time bounds', () => {
		for (const bad of ['-1', '1.5', 'abc', '', '1e3', '99999999999999999999']) {
			expect(code(`from=${bad}`)).toBe('invalid_time');
			expect(code(`to=${bad}`)).toBe('invalid_time');
		}
		expect(code('from=2000&to=1000')).toBe('invalid_range');
	});

	test('trims the category and ignores a blank one', () => {
		expect(ok('category=ai').category).toBe('ai');
		expect(ok('category=%20ai%20').category).toBe('ai');
		expect(ok('category=%20').category).toBeUndefined();
	});

	test('a blank query means no search', () => {
		expect(ok('q=').q).toBeUndefined();
		expect(ok('q=%20%20').q).toBeUndefined();
	});

	test('enforces the two-character minimum and the input caps', () => {
		expect(ok('q=ab').q).toBe('ab');
		expect(ok('q=%20ab%20').q).toBe('ab');
		expect(code('q=a')).toBe('query_too_short');
		expect(code('q=%20a%20')).toBe('query_too_short');
		expect(code(`q=${'x'.repeat(MAX_QUERY_CHARS + 1)}`)).toBe('query_too_long');
		expect(ok(`q=${'x'.repeat(MAX_QUERY_CHARS)}`).q).toBe('x'.repeat(MAX_QUERY_CHARS));
		expect(ok(`q=${Array.from({ length: MAX_QUERY_TOKENS }, () => 'ab').join(' ')}`).q).toBeTruthy();
		expect(
			code(`q=${Array.from({ length: MAX_QUERY_TOKENS + 1 }, () => 'ab').join(' ')}`)
		).toBe('too_many_terms');
	});

	test('decodes a valid cursor and rejects a forged one', () => {
		const cursor = { sourceCount: 2, publishedAt: 1_700_000_000_000, id: ID };
		expect(ok(`cursor=${encodeCursor(cursor)}`).cursor).toEqual(cursor);
		expect(code('cursor=not-a-cursor')).toBe('invalid_cursor');
	});

	test('ignores unknown parameters', () => {
		expect(ok('sort=title&offset=10')).toEqual({ limit: DEFAULT_LIMIT });
	});
});
