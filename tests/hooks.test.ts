import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { createDb } from '#lib/server/db';
import { SESSION_COOKIE, createSession } from '#lib/server/auth/session';
import { setSetting } from '#lib/server/settings';
import { hashPassword } from '#lib/server/auth/password';
import { newSalt } from '#lib/server/auth/secret';
import { VAULT_COOKIE, setVaultCookie } from '#lib/server/auth/vault-cookie';
import { cookieJar } from './events';

// The hook opens its own handle from the data dir, so the test points it at a
// temp dir before the module is imported.
const dir = mkdtempSync(join(tmpdir(), 'l30-hooks-'));
process.env.L30_DATA_DIR = dir;
const { handle } = await import('../src/hooks.server');
const seeded = await createDb();

afterAll(() => {
	try {
		seeded.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
	} catch {
		/* Windows keeps the libSQL handle briefly; the OS cleans the temp dir. */
	}
});

type Init = {
	path: string;
	method?: string;
	body?: string;
	origin?: string;
	session?: string;
};

function eventFor({ path, method = 'GET', body, origin, session }: Init) {
	const url = new URL(path, 'http://127.0.0.1:4477');
	const headers = new Headers();
	if (origin) headers.set('origin', origin);
	if (body) headers.set('content-type', 'application/json');
	const jar = cookieJar();
	if (session) jar.jar.set(SESSION_COOKIE, session);
	const event = {
		request: new Request(url, { method, headers, body }),
		url,
		cookies: jar.cookies,
		locals: {},
		getClientAddress: () => '127.0.0.1',
		params: {},
		route: { id: null },
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		fetch: globalThis.fetch
	} as never;
	return { event, jar };
}

const ok = async () => new Response('ok', { status: 200 });

test('an API route without a session is a 401', async () => {
	const { event } = eventFor({ path: '/api/feed' });
	const res = await handle({ event, resolve: ok });
	expect(res.status).toBe(401);
});

test('the two AI write routes are not reachable without a session', async () => {
	for (const path of ['/api/items/x/summary', '/api/settings/ai/test']) {
		const { event } = eventFor({
			path,
			method: 'POST',
			body: '{}',
			origin: 'http://127.0.0.1:4477'
		});
		const res = await handle({ event, resolve: ok });
		expect(res.status).toBe(401);
	}
});

test('other API routes are refused while the default password is still in use', async () => {
	const id = await createSession(seeded.db);
	const { event } = eventFor({ path: '/api/feed', session: id });
	const res = await handle({ event, resolve: ok });
	expect(res.status).toBe(403);
	expect(await res.json()).toEqual({
		error: { code: 'password_change_required', message: expect.any(String) }
	});
});

test('the password change route stays reachable while a change is required', async () => {
	const id = await createSession(seeded.db);
	const { event } = eventFor({ path: '/api/auth/password', method: 'POST', body: '{}', origin: 'http://127.0.0.1:4477', session: id });
	const res = await handle({ event, resolve: ok });
	expect(res.status).toBe(200);
});

test('once a password is stored the guard stops demanding a change', async () => {
	await setSetting(seeded.db, 'crypto.salt', newSalt().toString('base64'));
	await setSetting(seeded.db, 'auth.password', await hashPassword('a real password'));
	const id = await createSession(seeded.db);
	const { event } = eventFor({ path: '/api/feed', session: id });
	const res = await handle({ event, resolve: ok });
	expect(res.status).toBe(200);
});

test('a valid vault cookie is exposed as locals.vaultKey', async () => {
	const id = await createSession(seeded.db);
	const key = Buffer.alloc(32, 7);
	const { event, jar } = eventFor({ path: '/api/feed', session: id });
	setVaultCookie(jar.cookies, id, key, new URL('http://127.0.0.1:4477'));
	let seen: Buffer | undefined;
	const res = await handle({
		event,
		resolve: async (ev) => {
			seen = ev.locals.vaultKey;
			return ok();
		}
	});
	expect(res.status).toBe(200);
	expect(seen?.equals(key)).toBe(true);
});

test('a tampered vault cookie leaves locals.vaultKey undefined', async () => {
	const id = await createSession(seeded.db);
	const { event, jar } = eventFor({ path: '/api/feed', session: id });
	jar.jar.set(VAULT_COOKIE, 'tampered');
	let seen: Buffer | undefined = Buffer.alloc(1);
	const res = await handle({
		event,
		resolve: async (ev) => {
			seen = ev.locals.vaultKey;
			return ok();
		}
	});
	expect(res.status).toBe(200);
	expect(seen).toBeUndefined();
});

test('API responses are not cacheable', async () => {
	const { event } = eventFor({ path: '/api/health' });
	const res = await handle({ event, resolve: ok });
	expect(res.headers.get('cache-control')).toBe('no-store');
});

test('static assets keep their cache headers', async () => {
	const { event } = eventFor({ path: '/_app/immutable/chunk.js' });
	const res = await handle({ event, resolve: ok });
	expect(res.headers.get('cache-control')).toBeNull();
});

test('a write from another origin is refused', async () => {
	const id = await createSession(seeded.db);
	const { event } = eventFor({
		path: '/api/auth/logout',
		method: 'POST',
		body: '{}',
		origin: 'http://evil.example',
		session: id
	});
	const res = await handle({ event, resolve: ok });
	expect(res.status).toBe(403);
	expect(res.headers.get('x-content-type-options')).toBe('nosniff');
});
