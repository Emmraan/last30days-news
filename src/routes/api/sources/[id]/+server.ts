import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { apiError, readJson } from '#lib/server/api';
import { source } from '#lib/server/db/schema';

export const prerender = false;

// S10: only the toggle is patchable. Name, URL and interval are not.
const body = z.object({ enabled: z.boolean() }).strict();

export async function PATCH({ params, request, locals }: RequestEvent) {
	const parsed = await readJson(request, body);
	if (!parsed.ok) return parsed.response;

	const [row] = await locals.db
		.update(source)
		.set({ enabled: parsed.data.enabled })
		.where(eq(source.id, params.id))
		.returning({ id: source.id, enabled: source.enabled });
	if (!row) return apiError(404, 'not_found', 'No such source.');

	return json(row);
}
