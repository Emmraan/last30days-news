import { and, eq, gte, lt } from 'drizzle-orm';
import type { Db } from '../db';
import { loginAttempt } from '../db/schema';

export const MAX_FAILURES = 5;
export const LOCK_BASE_MS = 15 * 60 * 1000;
export const LOCK_MAX_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

export async function recordFailure(db: Db, ip: string, now = Date.now()) {
	await db.insert(loginAttempt).values({ ip, ts: now });
}

export async function clearFailures(db: Db, ip: string) {
	await db.delete(loginAttempt).where(eq(loginAttempt.ip, ip));
}

/**
 * S9: 5 failures per 15 min window, then a lock that doubles with every
 * further 5 failures, capped at 24 h. Counting all rows for the IP (not just
 * the last window) is what makes the escalation survive a restart.
 */
export async function lockState(db: Db, ip: string, now = Date.now()) {
	const recent = await db
		.select({ ts: loginAttempt.ts })
		.from(loginAttempt)
		.where(and(eq(loginAttempt.ip, ip), gte(loginAttempt.ts, now - WINDOW_MS)))
		.all();
	const total = await db.select({ ts: loginAttempt.ts }).from(loginAttempt).where(eq(loginAttempt.ip, ip)).all();

	if (recent.length < MAX_FAILURES) return { locked: false as const, retryAfterMs: 0 };

	const tier = Math.floor(total.length / MAX_FAILURES);
	const lockMs = Math.min(LOCK_BASE_MS * 2 ** (tier - 1), LOCK_MAX_MS);
	// The lock starts at the fifth failure of the current window, not the first.
	const lastTs = Math.max(...recent.map((r) => r.ts));
	const until = lastTs + lockMs;
	if (until <= now) return { locked: false as const, retryAfterMs: 0 };
	return { locked: true as const, retryAfterMs: until - now };
}

export async function pruneAttempts(db: Db, now = Date.now()) {
	const gone = await db
		.delete(loginAttempt)
		.where(lt(loginAttempt.ts, now - 24 * 60 * 60 * 1000))
		.returning({ ip: loginAttempt.ip });
	return gone.length;
}
