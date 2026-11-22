import { json, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { createDb } from '#lib/server/db';
import { readSession } from '#lib/server/auth/session';
import { SESSION_COOKIE } from '#lib/server/auth/session';
import { getSetting } from '#lib/server/settings';
import { log } from '#lib/server/log';

// One pool per process. SvelteKit gives no teardown hook, and the client is
// cheap to keep: a single sqlite handle.
let dbPromise: Promise<Awaited<ReturnType<typeof createDb>>> | null = null;
const getDb = () => (dbPromise ??= createDb());

const PUBLIC_API = new Set(['/api/health', '/api/auth/login', '/api/auth/reset', '/api/auth/session']);
const PUBLIC_PAGES = new Set(['/', '/login', '/reset']);
// Reachable with a first-run session so the password can actually be changed.
const WHILE_CHANGING = new Set(['/api/auth/password', '/api/auth/session', '/api/auth/logout']);

const HEADERS: Record<string, string> = {
	'content-security-policy':
		"default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'no-referrer',
	'x-frame-options': 'DENY'
};

/** Every early return carries the security headers too, not just the resolved one. */
function refuse(status: number, code: string, message: string) {
	const res = json({ error: { code, message } }, { status });
	for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
	return res;
}

export const handle: Handle = async ({ event, resolve }) => {
	const { db } = await getDb();
	event.locals.db = db;

	const path = event.url.pathname;

	// §S9 CSRF: SameSite=Lax plus an Origin check on every non-GET. A missing
	// Origin is refused too — browsers always send one for cross-site writes.
	if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
		const origin = event.request.headers.get('origin');
		if (origin !== event.url.origin) {
			log('warn', 'auth.csrf', { path });
			return refuse(403, 'csrf', 'Cross-origin request refused.');
		}
	}

	const id = event.cookies.get(SESSION_COOKIE);
	const session = await readSession(db, id);
	event.locals.sessionId = session?.id;
	event.locals.mustChangePassword = session ? !(await getSetting(db, 'auth.password')) : false;

	try {
		event.locals.ip = event.getClientAddress();
	} catch {
		// Some adapters expose no peer address; the lockout then shares one
		// bucket instead of failing open.
		event.locals.ip = 'unknown';
	}

	const isPublic = PUBLIC_API.has(path) || PUBLIC_PAGES.has(path);

	if (!session && !isPublic) {
		if (path.startsWith('/api/')) return refuse(401, 'unauthenticated', 'Sign in first.');
		if (!path.startsWith('/_app/') && !path.includes('.')) {
			redirect(303, `/login?next=${encodeURIComponent(path)}`);
		}
	}

	// §S9: the first-run password is public knowledge, so nothing but the
	// change route itself may run until a real one is stored.
	if (session && event.locals.mustChangePassword && path.startsWith('/api/') && !WHILE_CHANGING.has(path)) {
		return refuse(403, 'password_change_required', 'Set a new password first.');
	}

	const response = await resolve(event);
	for (const [k, v] of Object.entries(HEADERS)) response.headers.set(k, v);
	if (path.startsWith('/api/')) response.headers.set('cache-control', 'no-store');
	return response;
};
