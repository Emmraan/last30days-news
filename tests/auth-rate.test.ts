import { expect, test } from 'vitest';
import {
	LOCK_BASE_MS,
	LOCK_MAX_MS,
	MAX_FAILURES,
	clearFailures,
	lockState,
	pruneAttempts,
	recordFailure
} from '#lib/server/auth/rate';
import { freshDb } from './helper';

const T0 = 1_700_000_000_000;

test('constants match §S9: 5 failures, 15 min base lock, 24 h cap', () => {
	expect(MAX_FAILURES).toBe(5);
	expect(LOCK_BASE_MS).toBe(15 * 60 * 1000);
	expect(LOCK_MAX_MS).toBe(24 * 60 * 60 * 1000);
});

test('an IP with no failures is unlocked', async () => {
	const { db } = await freshDb();
	expect(await lockState(db, '1.2.3.4', T0)).toEqual({ locked: false, retryAfterMs: 0 });
});

test('four failures do not lock, the fifth does for 15 minutes', async () => {
	const { db } = await freshDb();
	for (let i = 0; i < 4; i++) await recordFailure(db, '1.2.3.4', T0);
	expect((await lockState(db, '1.2.3.4', T0)).locked).toBe(false);

	await recordFailure(db, '1.2.3.4', T0);
	const state = await lockState(db, '1.2.3.4', T0);
	expect(state.locked).toBe(true);
	expect(state.retryAfterMs).toBe(LOCK_BASE_MS);
});

test('the lock expires exactly at the boundary, not before', async () => {
	const { db } = await freshDb();
	for (let i = 0; i < MAX_FAILURES; i++) await recordFailure(db, 'ip', T0);
	expect((await lockState(db, 'ip', T0 + LOCK_BASE_MS - 1)).locked).toBe(true);
	expect((await lockState(db, 'ip', T0 + LOCK_BASE_MS)).locked).toBe(false);
});

test('the lock doubles every further five failures and caps at 24 h', async () => {
	const { db } = await freshDb();
	const expected = [
		[5, LOCK_BASE_MS],
		[10, LOCK_BASE_MS * 2],
		[15, LOCK_BASE_MS * 4],
		[20, LOCK_BASE_MS * 8],
		[25, LOCK_BASE_MS * 16],
		[40, LOCK_MAX_MS],
		[60, LOCK_MAX_MS]
	] as const;
	let recorded = 0;
	for (const [total, lockMs] of expected) {
		while (recorded < total) {
			await recordFailure(db, 'ip', T0);
			recorded++;
		}
		expect((await lockState(db, 'ip', T0)).retryAfterMs).toBe(lockMs);
	}
});

test('locks are per IP', async () => {
	const { db } = await freshDb();
	for (let i = 0; i < MAX_FAILURES; i++) await recordFailure(db, 'a', T0);
	expect((await lockState(db, 'a', T0)).locked).toBe(true);
	expect((await lockState(db, 'b', T0)).locked).toBe(false);
});

test('a success clears the IP rows so the counter resets', async () => {
	const { db, client } = await freshDb();
	for (let i = 0; i < MAX_FAILURES; i++) await recordFailure(db, 'ip', T0);
	await clearFailures(db, 'ip');
	expect((await lockState(db, 'ip', T0)).locked).toBe(false);
	const { rows } = await client.execute("select count(*) from login_attempt where ip = 'ip'");
	expect(Number(rows[0][0])).toBe(0);
});

test('clearFailures leaves other IPs alone', async () => {
	const { db } = await freshDb();
	await recordFailure(db, 'a', T0);
	await recordFailure(db, 'b', T0);
	await clearFailures(db, 'a');
	expect(await lockState(db, 'b', T0 + 1)).toEqual({ locked: false, retryAfterMs: 0 });
});

test('pruneAttempts drops rows older than 24 h and keeps newer ones', async () => {
	const { db, client } = await freshDb();
	await recordFailure(db, 'old', T0 - 24 * 60 * 60 * 1000 - 1);
	await recordFailure(db, 'new', T0);
	expect(await pruneAttempts(db, T0)).toBe(1);
	const { rows } = await client.execute('select ip from login_attempt');
	expect(rows.map((r) => String(r.ip))).toEqual(['new']);
});

test('a lockout survives a process restart because it lives in the DB', async () => {
	const { db, client } = await freshDb();
	for (let i = 0; i < MAX_FAILURES; i++) await recordFailure(db, 'ip', T0);
	// Same handle is all a restart gives us here: nothing is held in memory.
	const { rows } = await client.execute('select count(*) from login_attempt');
	expect(Number(rows[0][0])).toBe(MAX_FAILURES);
	expect((await lockState(db, 'ip', T0 + 1000)).locked).toBe(true);
});

test('an unknown IP string is never treated as a wildcard', async () => {
	const { db } = await freshDb();
	for (let i = 0; i < MAX_FAILURES; i++) await recordFailure(db, 'a', T0);
	expect((await lockState(db, '%', T0)).locked).toBe(false);
});
