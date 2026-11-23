import { and, eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { category, categoryItem, categorySource, item, itemSource } from '#lib/server/db/schema';
import { seed } from '#lib/server/db/seed';
import { promptHash, type CategoryRow } from '#lib/server/categories/filter';
import { scoreCategory, SCORE_BATCH_SIZE, SCORE_MAX_ITEMS } from '#lib/server/ai/score';
import { freshDb } from './helper';

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const idFor = (i: number) => i.toString(16).padStart(40, '0');

type MockResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;

function reply(text: string, tokensIn = 12, tokensOut = 6): MockResult {
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

function idsFrom(options: { prompt: unknown }): string[] {
	const messages = options.prompt as { content?: unknown }[];
	const text = Array.isArray(messages)
		? messages.map((message) => String(message.content ?? '')).join('\n')
		: JSON.stringify(options.prompt);
	return [...text.matchAll(/"id":"([0-9a-f]{40})"/g)].map((match) => match[1]);
}

const goodModel = () =>
	new MockLanguageModelV4({
		doGenerate: async (options) => {
			const ids = idsFrom(options as { prompt: unknown });
			return reply(
				JSON.stringify({
					scores: ids.map((id, index) => ({
						id,
						score: 0.9 - index * 0.01,
						reason: 'Relevant to the intent'
					}))
				})
			);
		}
	});

async function fixture(categoryValues: Partial<CategoryRow>, sourceIds: string[] = []) {
	const handle = await freshDb();
	await seed(handle.db);
	const row: CategoryRow = {
		id: 'usr-test',
		name: 'Test',
		builtin: false,
		matchMode: 'ai',
		keywords: [],
		prompt: 'chip news',
		aiThreshold: 0.6,
		sortOrder: 2,
		createdAt: T0,
		...categoryValues
	};
	await handle.db.insert(category).values(row);
	if (sourceIds.length)
		await handle.db
			.insert(categorySource)
			.values(sourceIds.map((sourceId) => ({ categoryId: row.id, sourceId })));
	return { ...handle, row };
}

async function addItems(
	db: Awaited<ReturnType<typeof freshDb>>['db'],
	count: number,
	options: {
		category?: string;
		sourceId?: string;
		title?: (i: number) => string;
		start?: number;
	} = {}
) {
	const start = options.start ?? 0;
	const rows = Array.from({ length: count }, (_, i) => ({
		id: idFor(start + i),
		title: options.title?.(i) ?? `Chip story ${i}`,
		url: `https://example.com/${start + i}`,
		author: null,
		publishedAt: T0 - (start + i) * 1000,
		publishedEstimated: false,
		fetchedAt: T0 - (start + i) * 1000,
		excerpt: `Excerpt ${i}`,
		language: 'en',
		category: options.category ?? 'technology',
		sourceCount: 1
	}));
	for (let i = 0; i < rows.length; i += 500) await db.insert(item).values(rows.slice(i, i + 500));
	if (options.sourceId)
		await db
			.insert(itemSource)
			.values(rows.map((row) => ({ itemId: row.id, sourceId: options.sourceId!, url: row.url })));
	return rows;
}

test('a category is scored in batches of 20 and a re-open makes no calls', async () => {
	const { db, row } = await fixture({});
	await addItems(db, 25, { sourceId: 'mit-tr' });
	const model = goodModel();

	const first = await scoreCategory({ db, model, category: row, sourceIds: [] });
	expect(first).toMatchObject({ ok: true, scored: 25, total: 25 });
	expect(model.doGenerateCalls).toHaveLength(2);
	const call = model.doGenerateCalls[0];
	expect(call.temperature).toBe(0);
	expect(call.maxOutputTokens).toBe(900);
	expect(JSON.stringify(call.prompt)).toContain('untrusted');
	expect(await db.select().from(categoryItem).all()).toHaveLength(25);

	const second = await scoreCategory({ db, model, category: row, sourceIds: [] });
	expect(second).toMatchObject({ ok: true, scored: 0, total: 0 });
	expect(model.doGenerateCalls).toHaveLength(2);
});

test('both does not send an item that already matched a keyword', async () => {
	const { db, row } = await fixture({
		matchMode: 'both',
		keywords: ['gpt-5']
	});
	const rows = await addItems(db, 3, {
		title: (i) => (i === 0 ? 'GPT-5 launches' : i === 1 ? 'GPT-5x ships' : 'A chip story')
	});
	const model = goodModel();

	const result = await scoreCategory({ db, model, category: row, sourceIds: [] });
	expect(result).toMatchObject({ ok: true, scored: 2, total: 2 });
	expect(model.doGenerateCalls).toHaveLength(1);
	const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
	expect(prompt).not.toContain(rows[0].id);
	expect(prompt).toContain(rows[1].id);
	expect(prompt).toContain(rows[2].id);
	const scored = await db.select().from(categoryItem).all();
	expect(scored.map((s) => s.itemId).sort()).toEqual([rows[1].id, rows[2].id].sort());
});

test('only the top 200 candidates per open are scored', async () => {
	const { db, row } = await fixture({});
	await addItems(db, SCORE_MAX_ITEMS + 25);
	const model = goodModel();

	const result = await scoreCategory({ db, model, category: row, sourceIds: [] });
	expect(result).toMatchObject({ ok: true, scored: SCORE_MAX_ITEMS, total: SCORE_MAX_ITEMS });
	expect(model.doGenerateCalls).toHaveLength(SCORE_MAX_ITEMS / SCORE_BATCH_SIZE);
	expect(await db.select().from(categoryItem).all()).toHaveLength(SCORE_MAX_ITEMS);
}, 30_000);

test('a missing id is stored as zero and never retried', async () => {
	const { db, row } = await fixture({});
	const rows = await addItems(db, 2);
	const model = new MockLanguageModelV4({
		doGenerate: async () =>
			reply(JSON.stringify({ scores: [{ id: rows[0].id, score: 0.8, reason: 'Yes' }] }))
	});

	const result = await scoreCategory({ db, model, category: row, sourceIds: [] });
	expect(result).toMatchObject({ ok: true, scored: 2, total: 2 });
	expect(model.doGenerateCalls).toHaveLength(1);
	const stored = await db.select().from(categoryItem).all();
	expect(stored).toHaveLength(2);
	expect(stored.find((s) => s.itemId === rows[1].id)?.score).toBe(0);
});

test('two invalid replies make one repair and store nothing', async () => {
	const { db, row } = await fixture({});
	await addItems(db, 2);
	const model = new MockLanguageModelV4({
		doGenerate: async () => reply(JSON.stringify({ scores: [{ id: 'x', score: 4 }] }))
	});

	const result = await scoreCategory({ db, model, category: row, sourceIds: [] });
	expect(result).toMatchObject({ ok: false, code: 'ai_invalid_output', scored: 0 });
	expect(model.doGenerateCalls).toHaveLength(2);
	expect(await db.select().from(categoryItem).all()).toHaveLength(0);
});

test('the candidate pool is the category sources when it has any', async () => {
	const { db, row } = await fixture({}, ['mit-tr']);
	await addItems(db, 2, { sourceId: 'mit-tr' });
	await addItems(db, 2, { sourceId: 'ars', start: 2 });
	const model = goodModel();

	const result = await scoreCategory({ db, model, category: row, sourceIds: ['mit-tr'] });
	expect(result).toMatchObject({ ok: true, scored: 2, total: 2 });
	expect(await db.select().from(categoryItem).all()).toHaveLength(2);
});

test('changing one prompt leaves the other category scores intact', async () => {
	const { db, row } = await fixture({});
	const other = { ...row, id: 'usr-other', name: 'Other', prompt: 'other intent' };
	await db.insert(category).values(other);
	await addItems(db, 3);
	const model = goodModel();

	await scoreCategory({ db, model, category: row, sourceIds: [] });
	await scoreCategory({ db, model, category: other, sourceIds: [] });
	expect(model.doGenerateCalls).toHaveLength(2);

	const edited = { ...row, prompt: 'different intent' };
	await scoreCategory({ db, model, category: edited, sourceIds: [] });
	expect(model.doGenerateCalls).toHaveLength(3);

	const oldRows = await db
		.select()
		.from(categoryItem)
		.where(and(eq(categoryItem.categoryId, row.id), eq(categoryItem.promptHash, promptHash(row.prompt!))))
		.all();
	const otherRows = await db
		.select()
		.from(categoryItem)
		.where(
			and(eq(categoryItem.categoryId, other.id), eq(categoryItem.promptHash, promptHash(other.prompt!)))
		)
		.all();
	expect(oldRows).toHaveLength(3);
	expect(otherRows).toHaveLength(3);
});

test('both spends its 200-item cap on items that need a score', async () => {
	const { db, row } = await fixture({ matchMode: 'both', keywords: ['gpt-5'] });
	await addItems(db, 200, { title: (i) => `GPT-5 launch ${i}` });
	await addItems(db, 1, { title: () => 'A chip story', start: 200 });
	const model = goodModel();

	const result = await scoreCategory({ db, model, category: row, sourceIds: [] });
	expect(result).toMatchObject({ ok: true, scored: 1, total: 1 });
	expect(model.doGenerateCalls).toHaveLength(1);
	expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain(idFor(200));
});
