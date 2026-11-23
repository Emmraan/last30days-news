import { expect, test } from 'vitest';
import { POST as summarize } from '../src/routes/api/items/[id]/summary/+server';
import { encryptSecret } from '#lib/server/auth/secret';
import { seed } from '#lib/server/db/seed';
import { item, summary } from '#lib/server/db/schema';
import { PROVIDERS_KEY, providerKeyName } from '#lib/server/ai/provider';
import { setSetting } from '#lib/server/settings';
import { makeEvent, read } from './events';
import { freshDb } from './helper';

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const KEY = Buffer.alloc(32, 5);
const ID = 'b'.repeat(40);

async function fixture() {
	const handle = await freshDb();
	await seed(handle.db);
	await handle.db.insert(item).values({
		id: ID,
		title: 'Cached story',
		url: 'https://example.com/cached',
		publishedAt: T0,
		publishedEstimated: false,
		fetchedAt: T0,
		excerpt: 'An excerpt.',
		language: 'en',
		category: 'technology',
		sourceCount: 1
	});
	return handle;
}

async function provider(db: Awaited<ReturnType<typeof freshDb>>['db'], withKey = false) {
	await setSetting(db, PROVIDERS_KEY, [{ id: 'openai', enabled: true, model: 'gpt-4o-mini' }]);
	if (withKey) await setSetting(db, providerKeyName('openai'), encryptSecret(KEY, 'sk-live-secret'));
}

const call = (db: never, init: Record<string, unknown> = {}) =>
	summarize(makeEvent({ db, method: 'POST', params: { id: ID }, ...init }).event).then(read);

test('an unknown item is a 404 even when AI is not configured', async () => {
	const { db } = await fixture();
	const res = await summarize(makeEvent({ db, method: 'POST', params: { id: 'f'.repeat(40) } }).event).then(read);
	expect(res.status).toBe(404);
});

test('no configured provider is a 409 ai_not_configured', async () => {
	const { db } = await fixture();
	const res = await call(db as never);
	expect(res.status).toBe(409);
	expect(res.body).toEqual({ error: { code: 'ai_not_configured', message: expect.any(String) } });
});

test('a provider without a key is a 409 ai_not_configured', async () => {
	const { db } = await fixture();
	await provider(db);
	const res = await call(db as never, { vaultKey: KEY });
	expect(res.status).toBe(409);
	expect((res.body!.error as { code: string }).code).toBe('ai_not_configured');
});

test('an encrypted key with no vault cookie is a 409 ai_locked and leaks nothing', async () => {
	const { db } = await fixture();
	await provider(db, true);
	const res = await call(db as never);
	expect(res.status).toBe(409);
	expect(res.body).toEqual({ error: { code: 'ai_locked', message: expect.any(String) } });
	expect(res.raw).not.toContain('sk-live-secret');
	expect(res.raw).not.toContain('AIza');
});

test('a cached summary is returned without a vault key or a model call', async () => {
	const { db } = await fixture();
	await provider(db);
	await db.insert(summary).values({
		itemId: ID,
		model: 'openai:gpt-4o-mini',
		body: 'Cached body.',
		keyPoints: ['One', 'Two'],
		whyItMatters: 'Because it is cached.',
		citations: [{ n: 1, source_id: 'ars', url: 'https://example.com/cached' }],
		createdAt: T0,
		tokensIn: 10,
		tokensOut: 5
	});

	const res = await call(db as never);
	expect(res.status).toBe(200);
	expect(res.body).toEqual({
		summary: {
			model: 'openai:gpt-4o-mini',
			body: 'Cached body.',
			keyPoints: ['One', 'Two'],
			whyItMatters: 'Because it is cached.',
			citations: [{ n: 1, source_id: 'ars', url: 'https://example.com/cached' }],
			createdAt: T0
		}
	});
});

test('a summary cached under another model is not reused', async () => {
	const { db } = await fixture();
	await provider(db, true);
	await db.insert(summary).values({
		itemId: ID,
		model: 'openai:gpt-4o',
		body: 'Wrong model.',
		citations: [],
		createdAt: T0,
		tokensIn: 1,
		tokensOut: 1
	});

	const res = await call(db as never);
	expect(res.status).toBe(409);
	expect((res.body!.error as { code: string }).code).toBe('ai_locked');
});
