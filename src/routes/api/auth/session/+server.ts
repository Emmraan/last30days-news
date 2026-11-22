import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export const prerender = false;

export function GET({ locals }: RequestEvent) {
	return json({
		authenticated: Boolean(locals.sessionId),
		mustChangePassword: locals.sessionId ? locals.mustChangePassword : false
	});
}
