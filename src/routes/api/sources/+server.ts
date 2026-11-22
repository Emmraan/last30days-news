import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { source } from '#lib/server/db/schema';

export const prerender = false;

export async function GET({ locals }: RequestEvent) {
	const rows = await locals.db.select().from(source).all();
	return json({
		sources: rows.map((r) => ({
			id: r.id,
			name: r.name,
			kind: r.kind,
			url: r.url,
			category: r.category,
			enabled: r.enabled,
			fetchIntervalMin: r.fetchIntervalMin,
			lastFetchedAt: r.lastFetchedAt,
			lastStatus: r.lastStatus,
			lastError: r.lastError
		}))
	});
}
