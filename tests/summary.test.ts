import { expect, test } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { seed } from '#lib/server/db/seed';
import { item, itemSource, summary } from '#lib/server/db/schema';
import { getCachedSummary, summarizeItem } from '#lib/server/ai/summary';
import { freshDb } from './helper';

type MockResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const valid = {
	summary: 'A chip maker shipped a faster part. The price stays the same.',
	key_points: ['Faster part', 'Same price'],
	why_it_matters: 'Buyers get more for the same money.'
};

function reply(text: string, tokensIn = 11, tokensOut = 7): MockResult {
	return {
		content: [{ type: 'text', text }],
		finishReason: { unified: 'stop', raw: 'stop' },
		usage: {
			inputTokens: { total: tokensIn, noCache: tokensIn, cacheRead: 0, cacheWrite: 0 },
			outputTokens: { total: tokensOut, text: tokensOut, reasoning: 0 }
		},
		warnings: []
	};
}

async function fixture() {
	const handle = await freshDb();
	await seed(handle.db);
	const target = {
		id: 'a'.repeat(40),
		title: 'A new chip ships',
		url: 'https://example.com/chip',
		author: 'Ada',
		publishedAt: T0,
		publishedEstimated: false,
		fetchedAt: T0,
		excerpt: 'The chip is faster and costs the same.',
		language: 'en',
		category: 'technology',
		sourceCount: 2
	};
	await handle.db.insert(item).values(target);
	await handle.db.insert(itemSource).values([
		{ itemId: target.id, sourceId: 'verge', url: 'https://example.com/chip?ref=verge', rawTitle: null },
		{ itemId: target.id, sourceId: 'ars', url: 'https://example.com/chip?ref=ars', rawTitle: null }
	]);
	return { ...handle, target };
}

test('a valid reply is stored with server-built citations and tokens', async () => {
	const { db, target } = await fixture();
	const model = new MockLanguageModelV4({ doGenerate: async () => reply(JSON.stringify(valid)) });

	const result = await summarizeItem({
		db,
		model,
		itemId: target.id,
		cacheKey: 'openai:gpt-4o-mini'
	});
	expect(result.ok).toBe(true);
	if (!result.ok) return;

	const rows = await db.select().from(summary).all();
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({
		itemId: target.id,
		model: 'openai:gpt-4o-mini',
		body: valid.summary,
		keyPoints: valid.key_points,
		whyItMatters: valid.why_it_matters,
		tokensIn: 11,
		tokensOut: 7
	});
	expect(rows[0].citations).toEqual([
		{ n: 1, source_id: 'ars', url: 'https://example.com/chip?ref=ars' },
		{ n: 2, source_id: 'verge', url: 'https://example.com/chip?ref=verge' }
	]);
	expect(await getCachedSummary(db, target.id, 'openai:gpt-4o-mini')).toEqual(result.summary);

	const call = model.doGenerateCalls[0];
	const prompt = JSON.stringify(call.prompt);
	expect(prompt).toContain(target.title);
	expect(prompt).toContain('Ars Technica');
	expect(prompt).toContain('untrusted');
	expect(prompt).not.toContain(target.url);
	expect(call.temperature).toBe(0.2);
	expect(call.maxOutputTokens).toBe(700);
});

test('two invalid replies make one repair and store nothing', async () => {
	const { db, target } = await fixture();
	const model = new MockLanguageModelV4({
		doGenerate: async () => reply(JSON.stringify({ summary: 'too short' }))
	});

	const result = await summarizeItem({ db, model, itemId: target.id, cacheKey: 'openai:gpt-4o-mini' });
	expect(result).toEqual({ ok: false, code: 'ai_invalid_output' });
	expect(model.doGenerateCalls).toHaveLength(2);
	expect(await db.select().from(summary).all()).toHaveLength(0);
});

test('a repaired reply is stored after exactly one retry', async () => {
	const { db, target } = await fixture();
	let calls = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => reply(calls++ === 0 ? 'not json' : JSON.stringify(valid))
	});

	const result = await summarizeItem({ db, model, itemId: target.id, cacheKey: 'openai:gpt-4o-mini' });
	expect(result.ok).toBe(true);
	expect(model.doGenerateCalls).toHaveLength(2);
	expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain('not valid');
	expect(await db.select().from(summary).all()).toHaveLength(1);
});

test('an upstream failure is reported generically and stores nothing', async () => {
	const { db, target } = await fixture();
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			throw new Error('upstream said sk-live-secret');
		}
	});

	const result = await summarizeItem({ db, model, itemId: target.id, cacheKey: 'openai:gpt-4o-mini' });
	expect(result).toEqual({ ok: false, code: 'ai_failed' });
	expect(await db.select().from(summary).all()).toHaveLength(0);
});

test('an unknown item is reported as not found without a model call', async () => {
	const { db } = await fixture();
	const model = new MockLanguageModelV4({ doGenerate: async () => reply(JSON.stringify(valid)) });
	const result = await summarizeItem({ db, model, itemId: 'f'.repeat(40), cacheKey: 'openai:x' });
	expect(result).toEqual({ ok: false, code: 'not_found' });
	expect(model.doGenerateCalls).toHaveLength(0);
});
