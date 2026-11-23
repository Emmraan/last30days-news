import type { RequestEvent } from './$types';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { apiError, readOptionalJson } from '#lib/server/api';
import { buildModel, getActiveProvider } from '#lib/server/ai/provider';
import { scoreCategory } from '#lib/server/ai/score';
import { categoryItem } from '#lib/server/db/schema';
import { loadCategoryFilter, promptHash } from '#lib/server/categories/filter';

export const prerender = false;

const body = z
	.object({
		reset: z.boolean().default(false),
		from: z.number().int().nonnegative().optional(),
		to: z.number().int().nonnegative().optional()
	})
	.strict();

type ScoreEvent =
	| { type: 'progress'; scored: number; total: number }
	| { type: 'degraded'; code: string }
	| { type: 'done'; scored: number; total: number; degraded: boolean };

export async function POST({ params, request, locals }: RequestEvent) {
	const parsed = await readOptionalJson(request, body);
	if (!parsed.ok) return parsed.response;
	const { reset = false, from, to } = parsed.data ?? {};
	if (from !== undefined && to !== undefined && from > to)
		return apiError(400, 'invalid_range', 'from must not be after to.');

	const filter = await loadCategoryFilter(locals.db, params.id);
	if (!filter) return apiError(404, 'not_found', 'No such category.');
	if (filter.category.builtin || filter.category.matchMode === 'keywords' || !filter.category.prompt)
		return apiError(400, 'not_ai_category', 'This category does not use AI scoring.');

	if (reset) {
		await locals.db
			.delete(categoryItem)
			.where(
				and(
					eq(categoryItem.categoryId, filter.category.id),
					eq(categoryItem.promptHash, promptHash(filter.category.prompt))
				)
			);
	}

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			let closed = false;
			const send = (event: ScoreEvent) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
				} catch {
					closed = true;
				}
			};
			const finish = (event: ScoreEvent) => {
				send(event);
				if (closed) return;
				try {
					controller.close();
				} catch {
					closed = true;
				}
			};

			let scored = 0;
			let total = 0;
			try {
				const provider = await getActiveProvider(locals.db);
				if (!provider) {
					send({ type: 'degraded', code: 'ai_not_configured' });
					finish({ type: 'done', scored, total, degraded: true });
					return;
				}
				const built = await buildModel(locals.db, provider, locals.vaultKey);
				if (!built.ok) {
					send({ type: 'degraded', code: built.code });
					finish({ type: 'done', scored, total, degraded: true });
					return;
				}

				const result = await scoreCategory({
					db: locals.db,
					model: built.model,
					category: filter.category,
					sourceIds: filter.sourceIds,
					from,
					to,
					onProgress: (progress) => {
						scored = progress.scored;
						total = progress.total;
						send({ type: 'progress', ...progress });
					}
				});

				if (!result.ok) send({ type: 'degraded', code: result.code });
				finish({
					type: 'done',
					scored: result.scored,
					total: result.total,
					degraded: !result.ok
				});
			} catch {
				// A failed query must still close the stream; an open SSE
				// connection that never sends `done` leaves the UI stuck.
				send({ type: 'degraded', code: 'ai_failed' });
				finish({ type: 'done', scored, total, degraded: true });
			}
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store'
		}
	});
}
