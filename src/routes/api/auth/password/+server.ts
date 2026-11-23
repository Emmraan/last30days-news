import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { z } from 'zod';
import { apiError, readJson } from '#lib/server/api';
import { hashPassword, verifyPassword } from '#lib/server/auth/password';
import { createSession, destroyAllSessions } from '#lib/server/auth/session';
import { setSessionCookie } from '#lib/server/auth/cookie';
import { setVaultCookie } from '#lib/server/auth/vault-cookie';
import { decryptSecret, deriveKey, encryptSecret, newSalt } from '#lib/server/auth/secret';
import { SALT_KEY, deleteSecrets, getSalt, listSecrets } from '#lib/server/auth/vault';
import { getSetting, setSetting } from '#lib/server/settings';
import type { Db } from '#lib/server/db';
import { log } from '#lib/server/log';

export const prerender = false;

const body = z.object({
	current: z.string().min(1).max(1024),
	next: z.string().min(8).max(1024)
}).strict();

export async function POST({ request, cookies, url, locals }: RequestEvent) {
	if (!locals.sessionId) return apiError(401, 'unauthenticated', 'Sign in first.');

	const parsed = await readJson(request, body);
	if (!parsed.ok) return parsed.response;
	const { current, next } = parsed.data;
	const { db, ip } = locals;

	const stored = await getSetting<string>(db, 'auth.password');
	if (!(await verifyPassword(current, stored)))
		return apiError(401, 'invalid_password', 'Incorrect password.');
	if (await verifyPassword(next, stored))
		return apiError(400, 'password_unchanged', 'Choose a different password.');

	// One pass over the vault: a half-rewritten set of secrets under the new
	// key would be unreadable, and the old key is about to stop existing.
	const oldSalt = await getSalt(db);
	const oldKey = oldSalt ? deriveKey(current, oldSalt) : null;
	const plain: Record<string, string> = {};
	for (const [key, payload] of Object.entries(await listSecrets(db))) {
		try {
			plain[key] = decryptSecret(oldKey!, payload);
		} catch {
			// A secret written under a lost key is dropped, not carried forward
			// as an unreadable blob.
		}
	}

	const salt = newSalt();
	const newKey = deriveKey(next, salt);
	const hash = await hashPassword(next);

	await db.transaction(async (tx) => {
		// The tx handle exposes the same builder API as the facade; the cast is
		// only to satisfy the helper signatures, which use neither.
		const h = tx as unknown as Db;
		await setSetting(h, 'auth.password', hash);
		await setSetting(h, SALT_KEY, salt.toString('base64'));
		await deleteSecrets(h);
		for (const [key, value] of Object.entries(plain))
			await setSetting(h, key, encryptSecret(newKey, value));
	});

	await destroyAllSessions(db);
	const sessionId = await createSession(db);
	setSessionCookie(cookies, sessionId, url);
	setVaultCookie(cookies, sessionId, newKey, url);
	log('info', 'auth.password', { ip, secrets: Object.keys(plain).length });

	return json({ authenticated: true, mustChangePassword: false });
}
