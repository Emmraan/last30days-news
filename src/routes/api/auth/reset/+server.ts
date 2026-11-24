import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { z } from 'zod';
import { apiError, locked, readJson } from '#lib/server/api';
import { resetAllowed } from '#lib/server/auth/deployment';
import { hashPassword } from '#lib/server/auth/password';
import { clearFailures, lockState, recordFailure } from '#lib/server/auth/rate';
import { destroyAllSessions } from '#lib/server/auth/session';
import { deleteSecrets } from '#lib/server/auth/vault';
import { clearSessionCookie } from '#lib/server/auth/cookie';
import { clearVaultCookie } from '#lib/server/auth/vault-cookie';
import { deleteSetting, setSetting } from '#lib/server/settings';
import { newSalt } from '#lib/server/auth/secret';
import { SALT_KEY } from '#lib/server/auth/vault';
import type { Db } from '#lib/server/db';
import { log } from '#lib/server/log';

export const prerender = false;

const body = z.object({
	confirm: z.literal('reset'),
	next: z.string().min(8).max(1024)
}).strict();

export async function POST({ request, cookies, locals }: RequestEvent) {
	const { db, ip } = locals;

	// A reset needs no session, so the network location is the only proof that
	// the caller owns the machine. Check it before parsing the body, so a
	// remote caller cannot even use this route as a retry oracle.
	if (!resetAllowed(ip)) return apiError(403, 'reset_local_only', 'Reset is only available from this machine.');

	const lock = await lockState(db, ip);
	if (lock.locked) return locked(lock.retryAfterMs);

	const parsed = await readJson(request, body);
	if (!parsed.ok) {
		// A typo in the confirmation word is a failed attempt, so reset cannot
		// be used as a free retry oracle.
		await recordFailure(db, ip);
		return parsed.response;
	}

	// §S9: password, sessions, secrets and the salt go; items, sources and
	// every other setting stay. One transaction, because a reset that stops
	// halfway leaves no stored password and the default `last30` works again.
	const hash = await hashPassword(parsed.data.next);
	const salt = newSalt().toString('base64');

	await db.transaction(async (tx) => {
		const h = tx as unknown as Db;
		await deleteSetting(h, 'auth.password');
		await deleteSecrets(h);
		await setSetting(h, SALT_KEY, salt);
		await setSetting(h, 'auth.password', hash);
	});

	await destroyAllSessions(db);
	await clearFailures(db, ip);
	clearSessionCookie(cookies);
	clearVaultCookie(cookies);
	log('info', 'auth.reset', { ip });

	return json({ authenticated: false, mustChangePassword: false });
}
