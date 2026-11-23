import { randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { expect, test } from 'vitest';
import { SESSION_TTL_MS } from './session';
import { VAULT_COOKIE, clearVaultCookie, readVaultCookie, setVaultCookie } from './vault-cookie';

function fakeCookies() {
	const values = new Map<string, string>();
	const options = new Map<string, Record<string, unknown>>();
	const cookies = {
		get: (name: string) => values.get(name),
		getAll: () => [...values].map(([name, value]) => ({ name, value })),
		set: (name: string, value: string, opts?: unknown) => {
			values.set(name, value);
			if (opts) options.set(name, opts as Record<string, unknown>);
		},
		delete: (name: string) => {
			values.delete(name);
			options.delete(name);
		},
		serialize: () => ''
	} as unknown as Cookies;
	return { cookies, values, options };
}

const sessionId = randomBytes(32).toString('hex');

test('the vault key round-trips and the cookie keeps the session flags', () => {
	const { cookies, values, options } = fakeCookies();
	const key = randomBytes(32);
	setVaultCookie(cookies, sessionId, key, new URL('http://127.0.0.1:4477/login'));

	expect(values.has(VAULT_COOKIE)).toBe(true);
	expect(readVaultCookie(cookies, sessionId)?.equals(key)).toBe(true);
	const opts = options.get(VAULT_COOKIE)!;
	expect(opts).toMatchObject({
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		secure: false,
		maxAge: SESSION_TTL_MS / 1000
	});
});

test('the vault cookie is Secure over HTTPS', () => {
	const { cookies, options } = fakeCookies();
	setVaultCookie(cookies, sessionId, randomBytes(32), new URL('https://example.com/login'));
	expect(options.get(VAULT_COOKIE)!.secure).toBe(true);
});

test('a vault cookie from another session is rejected', () => {
	const { cookies } = fakeCookies();
	setVaultCookie(cookies, sessionId, randomBytes(32), new URL('http://127.0.0.1:4477/'));
	const other = randomBytes(32).toString('hex');
	expect(readVaultCookie(cookies, other)).toBeUndefined();
});

test('a tampered vault cookie is rejected', () => {
	const { cookies, values } = fakeCookies();
	setVaultCookie(cookies, sessionId, randomBytes(32), new URL('http://127.0.0.1:4477/'));
	const payload = values.get(VAULT_COOKIE)!;
	values.set(VAULT_COOKIE, payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A'));
	expect(readVaultCookie(cookies, sessionId)).toBeUndefined();
});

test('a missing vault cookie reads as undefined', () => {
	const { cookies } = fakeCookies();
	expect(readVaultCookie(cookies, sessionId)).toBeUndefined();
});

test('clearing removes the vault cookie', () => {
	const { cookies, values } = fakeCookies();
	setVaultCookie(cookies, sessionId, randomBytes(32), new URL('http://127.0.0.1:4477/'));
	clearVaultCookie(cookies);
	expect(values.has(VAULT_COOKIE)).toBe(false);
});
