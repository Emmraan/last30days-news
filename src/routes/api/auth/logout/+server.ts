import type { RequestEvent } from './$types';
import { destroySession } from '#lib/server/auth/session';
import { clearSessionCookie } from '#lib/server/auth/cookie';

export const prerender = false;

export async function POST({ locals, cookies }: RequestEvent) {
	// Logout is idempotent: no session is still a success.
	if (locals.sessionId) await destroySession(locals.db, locals.sessionId);
	clearSessionCookie(cookies);
	return new Response(null, { status: 204 });
}
