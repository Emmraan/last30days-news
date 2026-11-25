import type { Cookies } from '@sveltejs/kit';
import { decryptSecret, encryptSecret } from './secret';
import { SESSION_TTL_MS } from './session';

export const VAULT_COOKIE = 'l30_vault';

// The DB holds the encrypted AI keys and the session ids, but never this
// cookie. The data key is encrypted under the session id so a later request
// can use it without a process-wide cache, which S19 rules out on Vercel.
const SESSION_ID = /^[0-9a-f]{64}$/;

export function setVaultCookie(cookies: Cookies, sessionId: string, key: Buffer, url: URL) {
	if (!SESSION_ID.test(sessionId)) throw new Error('invalid session id');
	if (key.length !== 32) throw new Error('vault key must be 32 bytes');
	cookies.set(
		VAULT_COOKIE,
		encryptSecret(Buffer.from(sessionId, 'hex'), key.toString('base64')),
		{
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			secure: url.protocol === 'https:',
			maxAge: SESSION_TTL_MS / 1000
		}
	);
}

/** Missing, stale or tampered cookies read as undefined; the caller decides. */
export function readVaultCookie(cookies: Cookies, sessionId: string): Buffer | undefined {
	if (!SESSION_ID.test(sessionId)) return undefined;
	const payload = cookies.get(VAULT_COOKIE);
	if (!payload) return undefined;
	try {
		const key = Buffer.from(
			decryptSecret(Buffer.from(sessionId, 'hex'), payload),
			'base64'
		);
		return key.length === 32 ? key : undefined;
	} catch {
		return undefined;
	}
}

export function clearVaultCookie(cookies: Cookies) {
	cookies.delete(VAULT_COOKIE, { path: '/' });
}
