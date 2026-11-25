import { json } from '@sveltejs/kit';
import type { ZodType } from 'zod';

export type ApiError = { error: { code: string; message: string } };

export const apiError = (status: number, code: string, message: string) =>
	json({ error: { code, message } } satisfies ApiError, { status });

/** S9: one lock response, so every auth route reports the same shape. */
export const locked = (retryAfterMs: number) =>
	json({ error: { code: 'locked', message: 'Too many attempts. Try again later.' } } satisfies ApiError, {
		status: 429,
		headers: { 'retry-after': String(Math.ceil(retryAfterMs / 1000)) }
	});

/**
 * S10 bodies are small JSON documents. The cap is enforced while reading, not
 * from Content-Length alone: a liar or a chunked body must not allocate freely.
 */
export const MAX_BODY_BYTES = 256 * 1024;

async function readCapped(request: Request): Promise<string | null> {
	const declared = request.headers.get('content-length');
	if (declared !== null && /^\d+$/.test(declared) && Number(declared) > MAX_BODY_BYTES) return null;
	if (!request.body) return '';

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > MAX_BODY_BYTES) {
				await reader.cancel();
				return null;
			}
			chunks.push(value);
		}
	} catch {
		return null;
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

/** S10: unknown body fields are rejected by zod, not silently dropped. */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<Parsed<T>> {
	const text = await readCapped(request);
	if (text === null)
		return {
			ok: false,
			response: apiError(413, 'body_too_large', 'Body is too large.')
		};

	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, response: apiError(400, 'invalid_json', 'Body must be JSON.') };
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success)
		return { ok: false, response: apiError(400, 'validation', 'Invalid request body.') };
	return { ok: true, data: parsed.data };
}

/** A POST action with no parameters still accepts an empty body. */
export async function readOptionalJson<T>(
	request: Request,
	schema: ZodType<T>
): Promise<Parsed<T | undefined>> {
	const text = await readCapped(request);
	if (text === null)
		return {
			ok: false,
			response: apiError(413, 'body_too_large', 'Body is too large.')
		};
	if (text.trim() === '') return { ok: true, data: undefined };

	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, response: apiError(400, 'invalid_json', 'Body must be JSON.') };
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success)
		return { ok: false, response: apiError(400, 'validation', 'Invalid request body.') };
	return { ok: true, data: parsed.data };
}
