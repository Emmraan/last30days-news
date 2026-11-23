import { expect, test } from 'vitest';
import { load } from '../src/routes/app/+page.server';
import { item, itemSource } from '#lib/server/db/schema';
import { seed } from '#lib/server/db/seed';
import type { FeedCategory, FeedPage } from '#lib/types';
import { freshDb } from './helper';

const HOUR = 60 * 60 * 1000;
const idFor = (i: number) => i.toString(16).padStart(40, '0');

function row(i: number, publishedAt: number) {
	return {
		id: idFor(i),
		title: `Story ${i}`,
		url: `https://example.com/${i}`,
		publishedAt,
		publishedEstimated: false,
		fetchedAt: publishedAt,
		excerpt: `Excerpt ${i}`,
		language: 'en',
		category: 'technology',
		sourceCount: 1
	};
}

type LoadData = { feed: FeedPage; categories: FeedCategory[]; now: number };

test('the app load returns the last 24 hours and the category list', async () => {
	const { db } = await freshDb();
	await seed(db);
	const now = Date.now();
	const recent = row(0, now - HOUR);
	const old = row(1, now - 48 * HOUR);
	await db.insert(item).values([recent, old]);
	await db.insert(itemSource).values({
		itemId: recent.id,
		sourceId: 'ars',
		url: recent.url,
		rawTitle: null
	});

	const data = (await load({ locals: { db } } as never)) as LoadData;

	expect(data.feed.items.map((entry) => entry.id)).toEqual([recent.id]);
	expect(data.feed.items[0].sourceName).toBe('Ars Technica');
	expect(data.feed.nextCursor).toBeNull();
	expect(data.categories).toEqual([
		{ id: 'technology', name: 'Technology', builtin: true },
		{ id: 'ai', name: 'AI', builtin: true }
	]);
	expect(data.now).toBeGreaterThanOrEqual(now);
});
