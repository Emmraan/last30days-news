import { describe, expect, it } from 'vitest';
import { initialPassword, isDeployed, isLoopback, resetAllowed } from './deployment';

describe('isLoopback', () => {
	it.each([
		['127.0.0.1', true],
		['127.8.9.10', true],
		['::1', true],
		['0:0:0:0:0:0:0:1', true],
		['[::1]', true],
		['::ffff:127.0.0.1', true],
		['203.0.113.9', false],
		['10.0.0.1', false],
		['localhost', false],
		['', false],
		[undefined, false]
	])('%s -> %s', (ip, expected) => {
		expect(isLoopback(ip)).toBe(expected);
	});
});

describe('isDeployed', () => {
	it('is false for a normal local install', () => {
		expect(isDeployed({})).toBe(false);
	});

	it('is true on Vercel or when L30_DEPLOYED=1', () => {
		expect(isDeployed({ VERCEL: '1' })).toBe(true);
		expect(isDeployed({ L30_DEPLOYED: '1' })).toBe(true);
		expect(isDeployed({ L30_DEPLOYED: '0' })).toBe(false);
	});
});

describe('resetAllowed', () => {
	it('allows a loopback client on a normal install', () => {
		expect(resetAllowed('127.0.0.1', {})).toBe(true);
		expect(resetAllowed('::1', {})).toBe(true);
	});

	it('refuses a remote client', () => {
		expect(resetAllowed('203.0.113.9', {})).toBe(false);
		expect(resetAllowed(undefined, {})).toBe(false);
	});

	it('refuses every client on a deployment', () => {
		expect(resetAllowed('127.0.0.1', { VERCEL: '1' })).toBe(false);
		expect(resetAllowed('127.0.0.1', { L30_DEPLOYED: '1' })).toBe(false);
	});
});

describe('initialPassword', () => {
	it('accepts 8 characters or more', () => {
		expect(initialPassword({ L30_INITIAL_PASSWORD: '12345678' })).toBe('12345678');
		expect(initialPassword({ L30_INITIAL_PASSWORD: 'a longer password' })).toBe('a longer password');
	});

	it('rejects a missing, short or oversized value', () => {
		expect(initialPassword({})).toBeNull();
		expect(initialPassword({ L30_INITIAL_PASSWORD: '' })).toBeNull();
		expect(initialPassword({ L30_INITIAL_PASSWORD: '1234567' })).toBeNull();
		expect(initialPassword({ L30_INITIAL_PASSWORD: 'x'.repeat(1025) })).toBeNull();
	});
});
