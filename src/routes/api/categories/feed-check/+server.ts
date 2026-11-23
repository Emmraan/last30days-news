import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { z } from 'zod';
import { readJson } from '#lib/server/api';
import { probeFeed } from '#lib/server/sources/probe';

export const prerender = false;

const body = z.object({ url: z.string().trim().min(1).max(2048) }).strict();

export async function POST({ request, fetch }: RequestEvent) {
	const parsed = await readJson(request, body);
	if (!parsed.ok) return parsed.response;

	const result = await probeFeed(parsed.data.url, { fetch });
	if (!result.ok) return json({ ok: false, code: result.code, message: result.message });
	return json({ ok: true, feedTitle: result.feedTitle, itemCount: result.itemCount });
}
