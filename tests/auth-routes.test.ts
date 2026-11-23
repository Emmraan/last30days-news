import { expect, test, vi } from 'vitest';
import { POST as login } from '../src/routes/api/auth/login/+server';
import { POST as logout } from '../src/routes/api/auth/logout/+server';
import { POST as changePassword } from '../src/routes/api/auth/password/+server';
import { POST as reset } from '../src/routes/api/auth/reset/+server';
import { GET as sessionInfo } from '../src/routes/api/auth/session/+server';
import { SESSION_COOKIE } from '#lib/server/auth/session';
import { VAULT_COOKIE, readVaultCookie } from '#lib/server/auth/vault-cookie';
import { getSalt } from '#lib/server/auth/vault';
import { hashPassword, verifyPassword } from '#lib/server/auth/password';
import { decryptSecret, deriveKey, encryptSecret, newSalt } from '#lib/server/auth/secret';
import { getSetting, setSetting } from '#lib/server/settings';
import { makeEvent, read } from './events';
import { freshDb } from './helper';

async function seededPassword(password: string) {
	const handle = await freshDb();
	// A real install always has a salt: it is written by the first password set.
	await setSetting(handle.db, 'crypto.salt', newSalt().toString('base64'));
	await setSetting(handle.db, 'auth.password', await hashPassword(password));
	return handle;
}

function loginEvent(db: never, password: unknown, extra: Record<string, unknown> = {}) {
	return makeEvent({ db, body: { password }, ...extra });
}

test('GET /api/auth/session reports unauthenticated with no cookie', async () => {
	const { db } = await freshDb();
	const { event } = makeEvent({ db, url: 'http://127.0.0.1:4477/api/auth/session' });
	const res = await read(await sessionInfo(event));
	expect(res.status).toBe(200);
	expect(res.body).toEqual({ authenticated: false, mustChangePassword: false });
});

test('GET /api/auth/session reports authenticated when the guard resolved a session', async () => {
	const { db } = await freshDb();
	const { event } = makeEvent({
		db,
		url: 'http://127.0.0.1:4477/api/auth/session',
		sessionId: 'a'.repeat(64),
		mustChangePassword: true
	});
	const res = await read(await sessionInfo(event));
	expect(res.body).toEqual({ authenticated: true, mustChangePassword: true });
});

test('first run with no stored password accepts last30 and demands a change', async () => {
	const { db } = await freshDb();
	const { event, jar } = loginEvent(db as never, 'last30');
	const res = await read(await login(event));

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ authenticated: true, mustChangePassword: true });
	const cookie = jar.opts.get(SESSION_COOKIE)!;
	expect(cookie.httpOnly).toBe(true);
	expect(cookie.sameSite).toBe('lax');
	expect(cookie.path).toBe('/');
	expect(cookie.maxAge).toBe(30 * 24 * 60 * 60);
	expect(cookie.secure).toBe(false);
	expect(jar.jar.get(SESSION_COOKIE)).toMatch(/^[0-9a-f]{64}$/);
	const vault = readVaultCookie(jar.cookies, jar.jar.get(SESSION_COOKIE)!);
	const salt = await getSalt(db);
	expect(vault).toBeDefined();
	expect(vault!.length).toBe(32);
	expect(vault!.equals(deriveKey('last30', salt!))).toBe(true);
	expect(jar.opts.get(VAULT_COOKIE)).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
	expect(await getSetting(db, 'auth.password')).toBeNull();
});

test('first run rejects anything but last30', async () => {
	const { db } = await freshDb();
	const { event, jar } = loginEvent(db as never, 'last31');
	const res = await read(await login(event));
	expect(res.status).toBe(401);
	expect(res.body).toEqual({
		error: { code: 'invalid_password', message: 'Incorrect password.' }
	});
	expect(jar.jar.has(SESSION_COOKIE)).toBe(false);
});

test('a stored password logs in and does not demand a change', async () => {
	const { db } = await seededPassword('correct horse');
	const { event, jar } = loginEvent(db as never, 'correct horse');
	const res = await read(await login(event));
	expect(res.status).toBe(200);
	expect(res.body).toEqual({ authenticated: true, mustChangePassword: false });
	expect(jar.jar.has(SESSION_COOKIE)).toBe(true);
	const salt = await getSalt(db);
	const vault = readVaultCookie(jar.cookies, jar.jar.get(SESSION_COOKIE)!);
	expect(vault!.equals(deriveKey('correct horse', salt!))).toBe(true);
});

test('a wrong password is a 401 with no cookie and a recorded failure', async () => {
	const { db, client } = await seededPassword('right');
	const { event, jar } = loginEvent(db as never, 'wrong');
	const res = await read(await login(event));
	expect(res.status).toBe(401);
	expect(jar.jar.has(SESSION_COOKIE)).toBe(false);
	const { rows } = await client.execute('select count(*) from login_attempt');
	expect(Number(rows[0][0])).toBe(1);
});

test('the fifth failure locks the IP with 429 and a Retry-After header', async () => {
	const { db } = await seededPassword('right');
	for (let i = 0; i < 4; i++) {
		const { event } = loginEvent(db as never, 'wrong');
		expect((await login(event)).status).toBe(401);
	}
	const { event } = loginEvent(db as never, 'wrong');
	const res = await read(await login(event));
	expect(res.status).toBe(429);
	expect(res.body).toEqual({ error: { code: 'locked', message: 'Too many attempts. Try again later.' } });
	expect(res.headers.get('retry-after')).toBe('900');

	// A correct password while locked is still refused.
	const after = loginEvent(db as never, 'right');
	expect((await login(after.event)).status).toBe(429);
});

test('a successful login clears earlier failures', async () => {
	const { db, client } = await seededPassword('right');
	for (let i = 0; i < 3; i++) {
		const { event } = loginEvent(db as never, 'wrong');
		await login(event);
	}
	const { event } = loginEvent(db as never, 'right');
	expect((await login(event)).status).toBe(200);
	const { rows } = await client.execute('select count(*) from login_attempt');
	expect(Number(rows[0][0])).toBe(0);
});

test('login rejects unknown body fields instead of ignoring them', async () => {
	const { db } = await seededPassword('right');
	const { event } = makeEvent({ db, body: { password: 'right', role: 'admin' } });
	const res = await read(await login(event));
	expect(res.status).toBe(400);
	expect((res.body!.error as { code: string }).code).toBe('validation');
});

test('login rejects a non-string, empty or oversized password without hashing', async () => {
	const { db } = await seededPassword('right');
	for (const body of [{ password: 123 }, { password: '' }, { password: 'x'.repeat(5000) }, {}]) {
		const { event } = makeEvent({ db, body });
		expect((await login(event)).status).toBe(400);
	}
	const { event } = makeEvent({ db, body: undefined, method: 'POST', headers: { 'content-type': 'application/json' } });
	expect((await login(event)).status).toBe(400);
});

test('login rotates the session id on every login', async () => {
	const { db } = await seededPassword('right');
	const a = loginEvent(db as never, 'right');
	await login(a.event);
	const b = loginEvent(db as never, 'right');
	await login(b.event);
	expect(a.jar.jar.get(SESSION_COOKIE)).not.toBe(b.jar.jar.get(SESSION_COOKIE));
});

test('logout deletes the session row and clears the cookie', async () => {
	const { db, client } = await freshDb();
	const { event: loginEv, jar } = loginEvent(db as never, 'last30');
	await login(loginEv);
	const id = jar.jar.get(SESSION_COOKIE)!;

	const { event } = makeEvent({ db, method: 'POST', body: {}, cookies: jar, sessionId: id });
	const res = await read(await logout(event));
	expect(res.status).toBe(204);
	expect(jar.jar.has(SESSION_COOKIE)).toBe(false);
	const { rows } = await client.execute({ sql: 'select count(*) from session where id = ?', args: [id] });
	expect(Number(rows[0][0])).toBe(0);
	expect(jar.jar.has(VAULT_COOKIE)).toBe(false);
});

test('logout without a session still succeeds and is idempotent', async () => {
	const { db } = await freshDb();
	const { event } = makeEvent({ db, method: 'POST', body: {} });
	expect((await logout(event)).status).toBe(204);
});

test('POST /api/auth/password requires a session', async () => {
	const { db } = await seededPassword('right');
	const { event } = makeEvent({ db, body: { current: 'right', next: 'brand new password' } });
	const res = await read(await changePassword(event));
	expect(res.status).toBe(401);
});

test('changing the password re-encrypts stored secrets and keeps them usable', async () => {
	const { db, client } = await seededPassword('old password');
	const oldKey = deriveKey('old password', await getSetting<string>(db, 'crypto.salt').then((s) => Buffer.from(s!, 'base64')));
	await setSetting(db, 'secret.openai.apiKey', encryptSecret(oldKey, 'sk-live-123'));

	const { event: loginEv, jar } = loginEvent(db as never, 'old password');
	await login(loginEv);
	const sessionId = jar.jar.get(SESSION_COOKIE)!;

	const { event } = makeEvent({
		db,
		body: { current: 'old password', next: 'new password 1' },
		cookies: jar,
		sessionId
	});
	const res = await read(await changePassword(event));
	expect(res.status).toBe(200);
	expect(res.raw).not.toContain('sk-live-123');

	expect(await verifyPassword('new password 1', (await getSetting<string>(db, 'auth.password'))!)).toBe(true);
	const newSalt = Buffer.from((await getSetting<string>(db, 'crypto.salt'))!, 'base64');
	const payload = (await getSetting<string>(db, 'secret.openai.apiKey'))!;
	expect(decryptSecret(deriveKey('new password 1', newSalt), payload)).toBe('sk-live-123');

	// The old session id must not survive a password change.
	const { rows } = await client.execute({ sql: 'select id from session' });
	expect(rows.map((r) => String(r.id))).not.toContain(sessionId);
	expect(jar.jar.get(SESSION_COOKIE)).toMatch(/^[0-9a-f]{64}$/);
	expect(jar.jar.get(SESSION_COOKIE)).not.toBe(sessionId);
	expect(readVaultCookie(jar.cookies, jar.jar.get(SESSION_COOKIE)!)!.equals(deriveKey('new password 1', newSalt))).toBe(true);
});

test('changing the password rejects a wrong current password and an unchanged next', async () => {
	const { db } = await seededPassword('old password');
	const { event: loginEv, jar } = loginEvent(db as never, 'old password');
	await login(loginEv);
	const sessionId = jar.jar.get(SESSION_COOKIE)!;
	const attempt = (body: unknown) =>
		changePassword(makeEvent({ db, body, cookies: jar, sessionId }).event).then(read);

	expect((await attempt({ current: 'nope', next: 'new password 1' })).status).toBe(401);
	expect((await attempt({ current: 'old password', next: 'short' })).status).toBe(400);
	expect((await attempt({ current: 'old password', next: 'old password' })).status).toBe(400);
	expect((await attempt({ current: 'old password' })).status).toBe(400);
	expect((await attempt({ current: 'old password', next: 'x'.repeat(2000) })).status).toBe(400);
	expect(await verifyPassword('old password', (await getSetting<string>(db, 'auth.password'))!)).toBe(true);
});

test('POST /api/auth/reset needs no session but the exact word reset', async () => {
	const { db } = await seededPassword('old password');
	const { event } = makeEvent({ db, body: { confirm: 'Reset', next: 'new password 1' } });
	const res = await read(await reset(event));
	expect(res.status).toBe(400);
	expect(await getSetting<string>(db, 'auth.password')).not.toBeNull();
});

test('reset wipes password, sessions and secrets, rewrites the salt, keeps data', async () => {
	const { db, client } = await seededPassword('old password');
	const oldSalt = (await getSetting<string>(db, 'crypto.salt'))!;
	const { event: loginEv, jar } = loginEvent(db as never, 'old password');
	await login(loginEv);
	await setSetting(db, 'secret.openai.apiKey', 'encrypted-blob');
	await client.execute({
		sql: 'insert into category (id,name,builtin,match_mode,keywords,ai_threshold,sort_order,created_at) values (?,?,?,?,?,?,?,?)',
		args: ['ai', 'AI', 1, 'keywords', '[]', 0.6, 1, 1]
	});
	await client.execute({
		sql: 'insert into item (id,title,url,published_at,fetched_at,category) values (?,?,?,?,?,?)',
		args: ['i1', 'Title', 'https://example.com/a', 1, 1, 'ai']
	});

	const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
	const { event } = makeEvent({ db, body: { confirm: 'reset', next: 'new password 1' }, cookies: jar });
	const res = await read(await reset(event));
	spy.mockRestore();

	expect(res.status).toBe(200);
	expect(await getSetting<string>(db, 'auth.password')).not.toBeNull();
	expect(await verifyPassword('new password 1', (await getSetting<string>(db, 'auth.password'))!)).toBe(true);
	expect(await getSetting<string>(db, 'secret.openai.apiKey')).toBeNull();
	expect((await getSetting<string>(db, 'crypto.salt'))!).not.toBe(oldSalt);
	expect(jar.jar.has(SESSION_COOKIE)).toBe(false);
	expect(jar.jar.has(VAULT_COOKIE)).toBe(false);
	const sessionCount = await client.execute('select count(*) from session');
	expect(Number(sessionCount.rows[0][0])).toBe(0);
	const { rows } = await client.execute('select count(*) from item');
	expect(Number(rows[0][0])).toBe(1);
});

test('reset rolls back completely when the write fails, leaving the old password', async () => {
	const { db, client } = await seededPassword('old password');
	await client.execute(
		"create trigger boom before insert on setting when new.key = 'auth.password' begin select raise(abort,'boom'); end"
	);
	const oldSalt = (await getSetting<string>(db, 'crypto.salt'))!;

	const { event } = makeEvent({ db, body: { confirm: 'reset', next: 'new password 1' } });
	await expect(reset(event)).rejects.toThrow();

	// A half-applied reset would leave no password, and login would accept the
	// documented default again.
	const stored = await getSetting<string>(db, 'auth.password');
	expect(stored).not.toBeNull();
	expect(await verifyPassword('old password', stored!)).toBe(true);
	expect(await getSetting<string>(db, 'crypto.salt')).toBe(oldSalt);
});

test('reset requires a new password of at least 8 characters', async () => {
	const { db } = await seededPassword('old password');
	const { event } = makeEvent({ db, body: { confirm: 'reset', next: 'short' } });
	expect((await reset(event)).status).toBe(400);
	expect(await verifyPassword('old password', (await getSetting<string>(db, 'auth.password'))!)).toBe(true);
});

test('reset is rate limited by the same counter as login', async () => {
	const { db } = await seededPassword('old password');
	for (let i = 0; i < 5; i++) {
		const { event } = makeEvent({ db, body: { confirm: 'nope', next: 'new password 1' } });
		await reset(event);
	}
	const { event } = makeEvent({ db, body: { confirm: 'reset', next: 'new password 1' } });
	expect((await reset(event)).status).toBe(429);
});

test('no route leaks a password hash or a secret in its body', async () => {
	const { db } = await seededPassword('old password');
	const hash = (await getSetting<string>(db, 'auth.password'))!;
	const { event } = loginEvent(db as never, 'wrong');
	const res = await read(await login(event));
	expect(res.raw).not.toContain(hash);
	expect(res.raw).not.toContain('scrypt$');
});
