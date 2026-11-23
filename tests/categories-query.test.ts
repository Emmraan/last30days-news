import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { seed } from '#lib/server/db/seed';
import { category, categoryItem, categorySource, item, itemSource } from '#lib/server/db/schema';
import { queryFeed } from '#lib/server/feed/query';
import { freshDb } from './helper';

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const sha1 = (value: string) => createHash('sha1').update(value).digest('hex');

const row = (id: string, title: string, categoryId: string, publishedAt = T0) => ({
	id,
	title,
	url: `https://example.com/${id}`,
	author: null,
	publishedAt,
	publishedEstimated: false,
	fetchedAt: publishedAt,
	excerpt: `${title} excerpt`,
	language: 'en',
	category: categoryId,
	sourceCount: 1
});

async function fixture() {
	const handle = await freshDb();
	await seed(handle.db);
	const now = Date.now();
	await handle.db.insert(category).values([
		{
			id: 'usr-gpt',
			name: 'GPT',
			builtin: false,
			matchMode: 'keywords',
			keywords: ['gpt-5'],
			prompt: null,
			aiThreshold: 0.6,
			sortOrder: 2,
			createdAt: now
		},
		{
			id: 'usr-chips',
			name: 'Chips',
			builtin: false,
			matchMode: 'both',
			keywords: ['gpt-5'],
			prompt: 'chip news',
			aiThreshold: 0.6,
			sortOrder: 3,
			createdAt: now
		},
		{
			id: 'usr-ai',
			name: 'AI only',
			builtin: false,
			matchMode: 'ai',
			keywords: [],
			prompt: 'chip news',
			aiThreshold: 0.75,
			sortOrder: 4,
			createdAt: now
		}
	]);
	await handle.db.insert(categorySource).values([
		{ categoryId: 'usr-gpt', sourceId: 'mit-tr' },
		{ categoryId: 'usr-chips', sourceId: 'mit-tr' },
		{ categoryId: 'usr-ai', sourceId: 'mit-tr' }
	]);
	const items = [
		row('a'.repeat(40), 'New GPT-5 model', 'technology'),
		row('b'.repeat(40), 'GPT-5x ships later', 'technology'),
		row('c'.repeat(40), 'A model release', 'technology'),
		row('d'.repeat(40), 'GPU news', 'technology'),
		row('e'.repeat(40), 'Chips from the lab', 'ai')
	];
	await handle.db.insert(item).values(items);
	await handle.db.insert(itemSource).values([
		{ itemId: items[0].id, sourceId: 'mit-tr', url: items[0].url },
		{ itemId: items[1].id, sourceId: 'mit-tr', url: items[1].url },
		{ itemId: items[2].id, sourceId: 'mit-tr', url: items[2].url },
		{ itemId: items[3].id, sourceId: 'ars', url: items[3].url },
		{ itemId: items[4].id, sourceId: 'hf-blog', url: items[4].url }
	]);
	return { ...handle, items };
}

test('a keywords-only category filters on a word boundary without an AI key', async () => {
	const { db, items } = await fixture();
	const page = await queryFeed(db, { category: 'usr-gpt', limit: 50 });
	expect(page.items.map((i) => i.id)).toEqual([items[0].id]);
});

test('a sources-only category uses only its pinned source pool', async () => {
	const { db, items } = await fixture();
	const page = await queryFeed(db, { category: 'usr-ai', limit: 50 });
	expect(page.items).toEqual([]);

	await db.insert(categoryItem).values({
		categoryId: 'usr-ai',
		itemId: items[0].id,
		promptHash: sha1('chip news'),
		score: 0.9,
		reason: 'A chip story',
		createdAt: T0
	});
	const scored = await queryFeed(db, { category: 'usr-ai', limit: 50 });
	expect(scored.items.map((i) => i.id)).toEqual([items[0].id]);
});

test('both is the union of keyword hits and cached scores, with the reason attached', async () => {
	const { db, items } = await fixture();
	await db.insert(categoryItem).values([
		{
			categoryId: 'usr-chips',
			itemId: items[2].id,
			promptHash: sha1('chip news'),
			score: 0.8,
			reason: 'A model release',
			createdAt: T0
		},
		{
			categoryId: 'usr-chips',
			itemId: items[4].id,
			promptHash: sha1('chip news'),
			score: 0.9,
			reason: 'High score outside the source pool',
			createdAt: T0
		}
	]);

	const page = await queryFeed(db, { category: 'usr-chips', limit: 50 });
	expect(page.items.map((i) => i.id).sort()).toEqual([items[0].id, items[2].id].sort());
	const modelHit = page.items.find((i) => i.id === items[2].id)!;
	expect(modelHit.score).toBeCloseTo(0.8);
	expect(modelHit.reason).toBe('A model release');
	const keywordHit = page.items.find((i) => i.id === items[0].id)!;
	expect(keywordHit.score ?? null).toBeNull();
	expect(page.items.some((i) => i.id === items[4].id)).toBe(false);
});

test('an AI-only category applies its threshold and returns the cached reason', async () => {
	const { db, items } = await fixture();
	await db.insert(categoryItem).values([
		{
			categoryId: 'usr-ai',
			itemId: items[0].id,
			promptHash: sha1('chip news'),
			score: 0.8,
			reason: 'Chip launch',
			createdAt: T0
		},
		{
			categoryId: 'usr-ai',
			itemId: items[2].id,
			promptHash: sha1('chip news'),
			score: 0.5,
			reason: 'Not enough',
			createdAt: T0
		}
	]);

	const page = await queryFeed(db, { category: 'usr-ai', limit: 50 });
	expect(page.items.map((i) => i.id)).toEqual([items[0].id]);
	expect(page.items[0]).toMatchObject({ score: 0.8, reason: 'Chip launch' });
});

test('an unknown category stays an empty page', async () => {
	const { db } = await fixture();
	const page = await queryFeed(db, { category: 'nope', limit: 50 });
	expect(page).toEqual({ items: [], nextCursor: null });
});

test('SQL wildcards and quotes in a keyword stay literal', async () => {
	const { db } = await fixture();
	await db.insert(category).values({
		id: 'usr-wild',
		name: 'Wildcards',
		builtin: false,
		matchMode: 'keywords',
		keywords: ['100%', 'a_b', 'x*y', '[tag]', "' OR 1=1 --"],
		prompt: null,
		aiThreshold: 0.6,
		sortOrder: 8,
		createdAt: T0
	});
	const titles = [
		'100% sure',
		'1000 percent',
		'a_b works',
		'axb is different',
		'x*y literal',
		'xZZy different',
		'[tag] literal',
		"' OR 1=1 -- literal",
		'an ordinary story'
	];
	const rows = titles.map((title, index) =>
		row((index + 10).toString(16).padStart(40, '0'), title, 'technology')
	);
	await db.insert(item).values(rows);

	const page = await queryFeed(db, { category: 'usr-wild', limit: 50 });
	expect(page.items.map((item) => item.title).sort()).toEqual(
		['100% sure', 'a_b works', 'x*y literal', '[tag] literal', "' OR 1=1 -- literal"].sort()
	);
});

test('10k keywords do not crash the feed query', async () => {
	const { db } = await fixture();
	await db.insert(category).values({
		id: 'usr-many',
		name: 'Many keywords',
		builtin: false,
		matchMode: 'keywords',
		keywords: Array.from({ length: 10_000 }, (_, i) => `kw-${i}`),
		prompt: null,
		aiThreshold: 0.6,
		sortOrder: 9,
		createdAt: T0
	});
	const rows = Array.from({ length: 20 }, (_, index) =>
		row(
			(index + 100).toString(16).padStart(40, '0'),
			index === 19 ? 'The kw-9999 story' : `Ordinary story ${index}`,
			'technology'
		)
	);
	await db.insert(item).values(rows);

	const page = await queryFeed(db, { category: 'usr-many', limit: 50 });
	expect(page.items.map((item) => item.title)).toEqual(['The kw-9999 story']);
}, 30_000);

