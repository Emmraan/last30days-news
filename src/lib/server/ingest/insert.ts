import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { item, itemSource } from '../db/schema';
import type { RawItem } from '../sources/raw';
import { canonicalUrl, itemId } from '#lib/util/url';

export const EXCERPT_MAX = 800;

/**
 * P3 insert: one row per canonical URL, one `item_source` link per source.
 * Title-level dedup and the 48h Jaccard merge land in P4.
 */
export async function insertItems(
	db: Db,
	owner: { id: string; category: string },
	raw: RawItem[],
	now = Date.now()
): Promise<number> {
	let inserted = 0;

	for (const r of raw) {
		const url = canonicalUrl(r.url);
		if (!url) continue;
		const id = itemId(url);

		const fresh = await db
			.insert(item)
			.values({
				id,
				title: r.title,
				url,
				author: r.author ?? null,
				publishedAt: r.publishedAt ?? now,
				publishedEstimated: !r.publishedAt,
				fetchedAt: now,
				excerpt: r.excerpt ? r.excerpt.slice(0, EXCERPT_MAX) : null,
				category: owner.category
			})
			.onConflictDoNothing()
			.returning({ id: item.id });
		if (fresh.length) inserted++;

		const link = await db
			.insert(itemSource)
			.values({ itemId: id, sourceId: owner.id, url: r.url, rawTitle: r.title })
			.onConflictDoNothing()
			.returning({ itemId: itemSource.itemId });

		// A second source on an existing item is the only thing that bumps the
		// badge; re-reading the same feed must not.
		if (link.length && !fresh.length)
			await db
				.update(item)
				.set({ sourceCount: sql`${item.sourceCount} + 1` })
				.where(eq(item.id, id));
	}

	return inserted;
}
