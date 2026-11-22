import { json } from '@sveltejs/kit';
import { VERSION } from '#lib/version';

export const prerender = false;

export function GET() {
	return json({ ok: true, version: VERSION });
}
