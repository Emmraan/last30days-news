import { expect, test } from 'vitest';
import { z } from 'zod';
import { MAX_BODY_BYTES, readJson } from '#lib/server/api';

const schema = z.object({ name: z.string() }).strict();

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
	new Request('http://127.0.0.1:4477/api/settings', {
		method: 'POST',
		body,
		headers: { 'content-type': 'application/json', ...headers }
	});

const status = async (request: Request) => {
	const parsed = await readJson(request, schema);
	return parsed.ok ? 200 : parsed.response.status;
};

test('reads a small strict body', async () => {
	const parsed = await readJson(post(JSON.stringify({ name: 'ok' })), schema);
	expect(parsed).toEqual({ ok: true, data: { name: 'ok' } });
});

test('rejects invalid JSON and unknown fields', async () => {
	expect(await status(post('{'))).toBe(400);
	expect(await status(post(JSON.stringify({ name: 'ok', extra: 1 })))).toBe(400);
	expect(await status(post(''))).toBe(400);
});

test('rejects a body over the cap, including a lying content-length', async () => {
	const oversized = 'x'.repeat(MAX_BODY_BYTES + 1);
	expect(await status(post(oversized))).toBe(413);

	const lying = new Request('http://127.0.0.1:4477/api/settings', {
		method: 'POST',
		body: oversized,
		headers: { 'content-type': 'application/json', 'content-length': '10' }
	});
	expect(await status(lying)).toBe(413);
});

test('rejects a streamed body that crosses the cap without a content-length', async () => {
	const chunk = new TextEncoder().encode('x'.repeat(MAX_BODY_BYTES + 1));
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(chunk);
			controller.close();
		}
	});
	const request = new Request('http://127.0.0.1:4477/api/settings', {
		method: 'POST',
		body,
		headers: { 'content-type': 'application/json' },
		duplex: 'half'
	} as RequestInit);

	expect(await status(request)).toBe(413);
});

test('the error shape is the documented one', async () => {
	const parsed = await readJson(post('x'.repeat(MAX_BODY_BYTES + 1)), schema);
	expect(parsed.ok).toBe(false);
	if (!parsed.ok) {
		expect(parsed.response.status).toBe(413);
		expect(await parsed.response.json()).toEqual({
			error: { code: 'body_too_large', message: expect.any(String) }
		});
	}
});
