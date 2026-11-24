import { describe, expect, test } from 'vitest';
import { mergeEnv } from '../vite.config';

describe('mergeEnv', () => {
	test('fills missing keys and keeps values from the environment', () => {
		const target: NodeJS.ProcessEnv = { KEEP: 'shell', EMPTY: '' };
		mergeEnv(target, { KEEP: 'file', EMPTY: 'file', NEW: 'value' });
		expect(target).toEqual({ KEEP: 'shell', EMPTY: '', NEW: 'value' });
	});

	test('does not add an undefined file value', () => {
		const target: NodeJS.ProcessEnv = {};
		mergeEnv(target, { MISSING: undefined });
		expect('MISSING' in target).toBe(false);
	});
});
