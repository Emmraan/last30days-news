import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { z } from 'zod';
import { locked, readJson } from '#lib/server/api';
import { DUMMY_HASH, FIRST_RUN_PASSWORD, verifyPassword } from '#lib/server/auth/password';
import { isDeployed } from '#lib/server/auth/deployment';
import { lockState, clearFailures, recordFailure } from '#lib/server/auth/rate';
import { createSession } from '#lib/server/auth/session';
import { setSessionCookie } from '#lib/server/auth/cookie';
import { setVaultCookie } from '#lib/server/auth/vault-cookie';
import { keyFor } from '#lib/server/auth/vault';
import { getSetting } from '#lib/server/settings';
import { log } from '#lib/server/log';

export const prerender = false;

const body = z.object({ password: z.string().min(1).max(1024) }).strict();

export async function POST({ request, cookies, url, locals }: RequestEvent) {
	const parsed = await readJson(request, body);
	if (!parsed.ok) return parsed.response;

	const { db, ip } = locals;

	const lock = await lockState(db, ip);
	if (lock.locked) {
		log('warn', 'auth.fail', { ip, reason: 'locked' });
		return locked(lock.retryAfterMs);
	}

	const stored = await getSetting<string>(db, 'auth.password');
	const deployed = isDeployed();
	if (!stored && deployed) {
		// A public deployment has no owner at the keyboard, so it fails closed
		// instead of accepting the repository's public default password.
		log('warn', 'auth.fail', { ip, reason: 'setup' });
		return json(
			{
				error: {
					code: 'setup_required',
					message: 'This deployment has no password yet. Set L30_INITIAL_PASSWORD and restart.'
				}
			},
			{ status: 503 }
		);
	}
	const ok = await verifyPassword(parsed.data.password, stored ?? DUMMY_HASH);
	// The first run compares against the fixed default, so the timing is the
	// same shape as a real verify rather than a free pass.
	const firstRunMatch = !stored && parsed.data.password === FIRST_RUN_PASSWORD;
	// A database copied from a local install may already hold the public
	// default as a hash. A deployment must not honour it even then.
	const defaultOnDeployment = deployed && parsed.data.password === FIRST_RUN_PASSWORD;
	const granted = stored ? ok && !defaultOnDeployment : firstRunMatch;

	if (!granted) {
		await recordFailure(db, ip);
		log('warn', 'auth.fail', { ip, reason: 'password' });
		// The failure that reaches the limit is answered as a lock, so the
		// caller learns the lock exists on the attempt that caused it.
		const after = await lockState(db, ip);
		if (after.locked) return locked(after.retryAfterMs);
		return json(
			{ error: { code: 'invalid_password', message: 'Incorrect password.' } },
			{ status: 401 }
		);
	}

	await clearFailures(db, ip);
	const vaultKey = await keyFor(db, parsed.data.password);
	const id = await createSession(db);
	setSessionCookie(cookies, id, url);
	setVaultCookie(cookies, id, vaultKey, url);
	log('info', 'auth.login', { ip, firstRun: !stored });
	return json({ authenticated: true, mustChangePassword: !stored });
}
