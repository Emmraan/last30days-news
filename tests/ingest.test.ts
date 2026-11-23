import { expect, test } from 'vitest';
import { insertItems } from '#lib/server/ingest/insert';
import { seed } from '#lib/server/db/seed';
import { item, itemSource } from '#lib/server/db/schema';
import { freshDb } from './helper';

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);

const ARS = { id: 'ars', category: 'technology' };
const VERGE = { id: 'verge', category: 'technology' };
const MIT = { id: 'mit-tr', category: 'ai' };

async function items(db: Awaited<ReturnType<typeof freshDb>>['db']) {
	return db.select().from(item).all();
}

test('the same URL from two sources is one item with source_count 2', async () => {
	const { db } = await freshDb();
	await seed(db);

	const first = await insertItems(
		db,
		ARS,
		[
			{
				url: 'https://www.example.com/story/?utm_source=rss#top',
				title: 'Original headline',
				publishedAt: T0,
				excerpt: 'first copy'
			}
		],
		T0
	);
	const second = await insertItems(
		db,
		VERGE,
		[
			{
				url: 'https://example.com/story',
				title: 'A different headline',
				publishedAt: T0 + HOUR,
				excerpt: 'second copy'
			}
		],
		T0 + HOUR
	);

	expect([first, second]).toEqual([1, 0]);
	const rows = await items(db);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({
		title: 'Original headline',
		url: 'https://example.com/story',
		category: 'technology',
		sourceCount: 2
	});
	const links = await db.select().from(itemSource).all();
	expect(links.map((l) => l.sourceId).sort()).toEqual(['ars', 'verge']);
});

test('identically normalised titles merge without touching the first row', async () => {
	const { db } = await freshDb();
	await seed(db);

	await insertItems(
		db,
		ARS,
		[{ url: 'https://example.com/a', title: 'AI: The Next Thing?', publishedAt: T0 }],
		T0
	);
	const added = await insertItems(
		db,
		VERGE,
		[{ url: 'https://other.example/b', title: 'AI — The Next Thing', publishedAt: T0 + 2 * HOUR }],
		T0 + 2 * HOUR
	);

	expect(added).toBe(0);
	const rows = await items(db);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({
		title: 'AI: The Next Thing?',
		url: 'https://example.com/a',
		sourceCount: 2
	});
});

test('jaccard at the 0.72 boundary merges, 0.68 does not', async () => {
	const { db } = await freshDb();
	await seed(db);
	const shared = Array.from({ length: 18 }, (_, i) => `shared${i + 1}`);
	const base = shared.join(' ');
	const atThreshold = [...shared, ...Array.from({ length: 7 }, (_, i) => `extra${i + 1}`)].join(
		' '
	);
	const below = [...shared.slice(0, 17), ...Array.from({ length: 7 }, (_, i) => `other${i + 1}`)].join(
		' '
	);

	await insertItems(db, ARS, [{ url: 'https://example.com/base', title: base, publishedAt: T0 }], T0);
	const merged = await insertItems(
		db,
		VERGE,
		[{ url: 'https://example.com/at', title: atThreshold, publishedAt: T0 + HOUR }],
		T0 + HOUR
	);
	expect(merged).toBe(0);
	expect(await items(db)).toHaveLength(1);

	const added = await insertItems(
		db,
		VERGE,
		[{ url: 'https://example.com/below', title: below, publishedAt: T0 + HOUR }],
		T0 + HOUR
	);
	expect(added).toBe(1);
	expect(await items(db)).toHaveLength(2);
});

test('the jaccard window is 48h', async () => {
	const { db } = await freshDb();
	await seed(db);
	const shared = Array.from({ length: 18 }, (_, i) => `shared${i + 1}`);
	const title = shared.join(' ');
	const similar = [...shared, ...Array.from({ length: 7 }, (_, i) => `extra${i + 1}`)].join(' ');

	await insertItems(db, ARS, [{ url: 'https://example.com/base', title, publishedAt: T0 }], T0);
	const inside = await insertItems(
		db,
		VERGE,
		[{ url: 'https://example.com/inside', title: similar, publishedAt: T0 + 48 * HOUR }],
		T0 + 48 * HOUR
	);
	expect(inside).toBe(0);

	const outside = await insertItems(
		db,
		VERGE,
		[{ url: 'https://example.com/outside', title: similar, publishedAt: T0 + 49 * HOUR }],
		T0 + 49 * HOUR
	);
	expect(outside).toBe(1);
	expect(await items(db)).toHaveLength(2);
});

test('cross-category duplicates are never merged', async () => {
	const { db } = await freshDb();
	await seed(db);

	await insertItems(
		db,
		ARS,
		[{ url: 'https://example.com/x', title: 'Shared story', publishedAt: T0 }],
		T0
	);
	const added = await insertItems(
		db,
		MIT,
		[{ url: 'https://example.com/x', title: 'Shared story', publishedAt: T0 }],
		T0
	);

	expect(added).toBe(0);
	const rows = await items(db);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ category: 'technology', sourceCount: 1 });
	expect(await db.select().from(itemSource).all()).toHaveLength(1);

	// The same title behind a different URL is a separate item in the other category.
	await insertItems(
		db,
		MIT,
		[{ url: 'https://example.com/y', title: 'Shared story', publishedAt: T0 }],
		T0
	);
	expect(await items(db)).toHaveLength(2);
});

test('excerpt is stripped and capped, language is best effort, missing dates are estimated', async () => {
	const { db } = await freshDb();
	await seed(db);

	await insertItems(
		db,
		MIT,
		[{ url: 'https://example.com/ru', title: 'Привет мир', excerpt: `<p>${'x'.repeat(1200)}</p>` }],
		T0
	);
	await insertItems(
		db,
		ARS,
		[
			{
				url: 'https://example.com/en',
				title: 'Hello world',
				excerpt: '<b>plain</b> text',
				publishedAt: T0 - HOUR
			}
		],
		T0
	);

	const rows = await items(db);
	const ru = rows.find((r) => r.url === 'https://example.com/ru')!;
	const en = rows.find((r) => r.url === 'https://example.com/en')!;

	expect(ru.excerpt).toBe('x'.repeat(800));
	expect(ru.language).toBe('ru');
	expect(ru.publishedAt).toBe(T0);
	expect(ru.publishedEstimated).toBe(true);

	expect(en.excerpt).toBe('plain text');
	expect(en.language).toBe('en');
	expect(en.publishedEstimated).toBe(false);
});

test('non-http links never become items', async () => {
	const { db } = await freshDb();
	await seed(db);

	const added = await insertItems(
		db,
		ARS,
		[
			{ url: 'file:///etc/passwd', title: 'File' },
			{ url: 'javascript:alert(1)', title: 'Script' },
			{ url: 'ftp://example.com/a', title: 'FTP' },
			{ url: 'not a url', title: 'Bad' }
		],
		T0
	);

	expect(added).toBe(0);
	expect(await items(db)).toHaveLength(0);
});

test('duplicates inside one batch collapse to one item and one link', async () => {
	const { db } = await freshDb();
	await seed(db);

	const added = await insertItems(
		db,
		ARS,
		[
			{ url: 'https://example.com/a?utm_source=x', title: 'Story', publishedAt: T0 },
			{ url: 'https://example.com/a', title: 'Story copy', publishedAt: T0 }
		],
		T0
	);

	expect(added).toBe(1);
	const rows = await items(db);
	expect(rows).toHaveLength(1);
	expect(rows[0].sourceCount).toBe(1);
	expect(await db.select().from(itemSource).all()).toHaveLength(1);
});
