import { describe, expect, test } from 'vitest';
import { buildFtsQuery } from './fts';

describe('buildFtsQuery', () => {
	test.each([
		['', ''],
		['   ', ''],
		['alpha', '"alpha"*'],
		['alpha beta', '"alpha" AND "beta"*'],
		['  alpha   beta  ', '"alpha" AND "beta"*'],
		['ALPHA Gamma', '"ALPHA" AND "Gamma"*'],
		['NEAR OR "quoted":', '"NEAR" AND "OR" AND """quoted"":"*'],
		['say "hi" now', '"say" AND """hi""" AND "now"*'],
		['a*b', '"a*b"*'],
		['café', '"café"*']
	])('escapes %j into %j', (input, expected) => {
		expect(buildFtsQuery(input)).toBe(expected);
	});
});
