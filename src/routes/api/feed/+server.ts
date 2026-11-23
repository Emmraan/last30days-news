import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { apiError } from '#lib/server/api';
import { parseFeedQuery, queryFeed } from '#lib/server/feed/query';

export const prerender = false;

export async function GET({ url, locals }: RequestEvent) {
	const parsed = parseFeedQuery(url.searchParams);
	if (!parsed.ok) return apiError(400, parsed.code, parsed.message);
	return json(await queryFeed(locals.db, parsed.params));
}
