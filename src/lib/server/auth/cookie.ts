import type { Cookies } from '@sveltejs/kit';
import { SESSION_COOKIE, SESSION_TTL_MS } from './session';

/** S9: HttpOnly, SameSite=Lax, Path=/, Secure only over HTTPS. */
export function setSessionCookie(cookies: Cookies, id: string, url: URL) {
	cookies.set(SESSION_COOKIE, id, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		secure: url.protocol === 'https:',
		maxAge: SESSION_TTL_MS / 1000
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
