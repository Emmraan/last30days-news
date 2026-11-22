import { randomBytes } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import type { Db } from '../db';
import { session } from '../db/schema';

export const SESSION_COOKIE = 'l30_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Expired sessions linger this long so a clock-skewed client still gets 401, not a phantom login. */
export const SESSION_PRUNE_GRACE_MS = 24 * 60 * 60 * 1000;

export async function createSession(db: Db, now = Date.now()) {
	const id = randomBytes(32).toString('hex');
	await db.insert(session).values({
		id,
		createdAt: now,
		expiresAt: now + SESSION_TTL_MS,
		lastSeenAt: now
	});
	return id;
}

export async function readSession(db: Db, id: string | undefined, now = Date.now()) {
	if (!id) return null;
	const row = await db.select().from(session).where(eq(session.id, id)).get();
	if (!row) return null;
	if (row.expiresAt <= now) {
		await destroySession(db, id);
		return null;
	}
	await db.update(session).set({ lastSeenAt: now }).where(eq(session.id, id));
	return { ...row, lastSeenAt: now };
}

export async function destroySession(db: Db, id: string) {
	await db.delete(session).where(eq(session.id, id));
}

export async function destroyAllSessions(db: Db) {
	await db.delete(session);
}

export async function pruneSessions(db: Db, now = Date.now()) {
	const cutoff = now - SESSION_PRUNE_GRACE_MS;
	const gone = await db
		.delete(session)
		.where(and(lt(session.expiresAt, cutoff)))
		.returning({ id: session.id });
	return gone.length;
}
