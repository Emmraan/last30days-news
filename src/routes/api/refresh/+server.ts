import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { runPass, type PassEvent } from '#lib/server/fetch/pass';

export const prerender = false;

/**
 * §S10/§S19: local installs stream one SSE event per source as it lands;
 * a serverless call cannot hold the stream, so it runs one batch and returns.
 */
export async function POST({ request, locals }: RequestEvent) {
	let batch = false;
	try {
		const body = (await request.json()) as { batch?: unknown } | null;
		batch = body?.batch === true;
	} catch {
		// An empty body means a local streaming pass.
	}

	if (batch) {
		const events = await runPass({ db: locals.db, batch: true });
		return json({ events });
	}

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: PassEvent) =>
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			try {
				await runPass({ db: locals.db, emit: send });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store',
			connection: 'keep-alive'
		}
	});
}
