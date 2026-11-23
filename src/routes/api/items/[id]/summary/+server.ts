import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { eq } from 'drizzle-orm';
import { apiError } from '#lib/server/api';
import { buildModel, getActiveProvider } from '#lib/server/ai/provider';
import { getCachedSummary, summarizeItem } from '#lib/server/ai/summary';
import { item } from '#lib/server/db/schema';

export const prerender = false;

export async function POST({ params, locals }: RequestEvent) {
	const { db } = locals;

	const exists = await db
		.select({ id: item.id })
		.from(item)
		.where(eq(item.id, params.id))
		.limit(1)
		.all();
	if (!exists[0]) return apiError(404, 'not_found', 'No such item.');

	const provider = await getActiveProvider(db);
	if (!provider) return apiError(409, 'ai_not_configured', 'No AI provider is configured.');

	// The cache is read before the key is: a locked vault can still show a
	// summary that was generated earlier, and costs no model call.
	const cached = await getCachedSummary(db, params.id, provider.cacheKey);
	if (cached) return json({ summary: cached });

	const built = await buildModel(db, provider, locals.vaultKey);
	if (!built.ok) {
		if (built.code === 'ai_locked')
			return apiError(409, 'ai_locked', 'Sign in again to unlock AI keys.');
		return apiError(409, 'ai_not_configured', 'No API key is configured for this provider.');
	}

	const result = await summarizeItem({
		db,
		model: built.model,
		itemId: params.id,
		cacheKey: provider.cacheKey
	});
	if (!result.ok) {
		if (result.code === 'not_found') return apiError(404, 'not_found', 'No such item.');
		if (result.code === 'ai_invalid_output')
			return apiError(502, 'ai_invalid_output', 'The AI provider returned an invalid summary.');
		return apiError(502, 'ai_failed', 'The AI provider did not answer.');
	}

	return json({ summary: result.summary });
}
