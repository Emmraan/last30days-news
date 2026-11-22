import { json } from '@sveltejs/kit';
import type { ZodType } from 'zod';

export type ApiError = { error: { code: string; message: string } };

export const apiError = (status: number, code: string, message: string) =>
	json({ error: { code, message } } satisfies ApiError, { status });

/** §S9: one lock response, so every auth route reports the same shape. */
export const locked = (retryAfterMs: number) =>
	json({ error: { code: 'locked', message: 'Too many attempts. Try again later.' } } satisfies ApiError, {
		status: 429,
		headers: { 'retry-after': String(Math.ceil(retryAfterMs / 1000)) }
	});

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

/** §S10: unknown body fields are rejected by zod, not silently dropped. */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<Parsed<T>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return { ok: false, response: apiError(400, 'invalid_json', 'Body must be JSON.') };
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success)
		return { ok: false, response: apiError(400, 'validation', 'Invalid request body.') };
	return { ok: true, data: parsed.data };
}
