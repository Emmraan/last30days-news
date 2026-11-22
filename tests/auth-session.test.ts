import { expect, test } from 'vitest';
import {
	SESSION_COOKIE,
	SESSION_PRUNE_GRACE_MS,
	SESSION_TTL_MS,
	createSession,
	destroyAllSessions,
	destroySession,
	pruneSessions,
	readSession
} from '#lib/server/auth/session';
import { freshDb } from './helper';

test('session id is 32 random bytes as hex and the cookie name is fixed', async () => {
	const { db } = await freshDb();
	const id = await createSession(db);
	expect(SESSION_COOKIE).toBe('l30_session');
	expect(id).toMatch(/^[0-9a-f]{64}$/);
	expect(await createSession(db)).not.toBe(id);
});

test('a fresh session is readable and expires in 30 days', async () => {
	const { db } = await freshDb();
	const now = 1_700_000_000_000;
	const id = await createSession(db, now);
	const row = await readSession(db, id, now);
	expect(row?.id).toBe(id);
	expect(row?.expiresAt).toBe(now + SESSION_TTL_MS);
	expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
});

test('reading touches lastSeenAt but not createdAt or expiresAt', async () => {
	const { db } = await freshDb();
	const id = await createSession(db, 1000);
	const later = 5000;
	const row = await readSession(db, id, later);
	expect(row?.createdAt).toBe(1000);
	expect(row?.expiresAt).toBe(1000 + SESSION_TTL_MS);
	expect(row?.lastSeenAt).toBe(later);
	expect((await readSession(db, id, 9000))?.lastSeenAt).toBe(9000);
});

test('an expired session is not readable and is removed', async () => {
	const { db, client } = await freshDb();
	const id = await createSession(db, 1000);
	expect(await readSession(db, id, 1000 + SESSION_TTL_MS)).toBeNull();
	const { rows } = await client.execute('select count(*) from session');
	expect(Number(rows[0][0])).toBe(0);
});

test('a missing, empty or unknown id reads as null', async () => {
	const { db } = await freshDb();
	for (const id of [undefined, '', 'nope', 'A'.repeat(64)]) {
		expect(await readSession(db, id as string | undefined)).toBeNull();
	}
});

test('a forged id is not a valid session', async () => {
	const { db } = await freshDb();
	await createSession(db);
	expect(await readSession(db, 'f'.repeat(64))).toBeNull();
});

test('destroySession removes only that session', async () => {
	const { db } = await freshDb();
	const a = await createSession(db);
	const b = await createSession(db);
	await destroySession(db, a);
	expect(await readSession(db, a)).toBeNull();
	expect(await readSession(db, b)).not.toBeNull();
	await destroySession(db, 'not-a-session');
});

test('destroyAllSessions empties the table', async () => {
	const { db, client } = await freshDb();
	await createSession(db);
	await createSession(db);
	await destroyAllSessions(db);
	const { rows } = await client.execute('select count(*) from session');
	expect(Number(rows[0][0])).toBe(0);
});

test('pruneSessions keeps recently expired sessions and drops older ones', async () => {
	const { db, client } = await freshDb();
	const now = 1_000_000_000;
	const expiredLongAgo = now - SESSION_TTL_MS - SESSION_PRUNE_GRACE_MS - 1;
	const expiredJustNow = now - 1;
	await client.execute({
		sql: 'insert into session (id, created_at, expires_at, last_seen_at) values (?,?,?,?)',
		args: ['old', expiredLongAgo - SESSION_TTL_MS, expiredLongAgo, expiredLongAgo]
	});
	await client.execute({
		sql: 'insert into session (id, created_at, expires_at, last_seen_at) values (?,?,?,?)',
		args: ['recent', expiredJustNow - SESSION_TTL_MS, expiredJustNow, expiredJustNow]
	});
	const live = await createSession(db, now);

	expect(await pruneSessions(db, now)).toBe(1);
	expect(await readSession(db, live, now)).not.toBeNull();
	const { rows } = await client.execute('select id from session order by id');
	expect(rows.map((r) => String(r.id)).sort()).toEqual(['recent', live].sort());
});
