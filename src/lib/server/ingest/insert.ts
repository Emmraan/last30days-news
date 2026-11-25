import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { item, itemSource } from '../db/schema';
import { canonicalUrl, itemId } from '#lib/util/url';
import { jaccard, titleKey } from '#lib/util/dedup';
import { toText, type RawItem } from '../sources/raw';

export const EXCERPT_MAX = 800;

/** S7: fuzzy title matches only count within 48 hours of publication. */
export const DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;

/** S7: `token Jaccard ≥ 0.72`. */
export const JACCARD_THRESHOLD = 0.72;

type Owner = { id: string; category: string };

type Candidate = {
	id: string;
	title: string;
	publishedAt: number;
	category: string;
	key: string;
};

const SCRIPTS: [RegExp, string][] = [
	[/\p{Script=Hiragana}|\p{Script=Katakana}/u, 'ja'],
	[/\p{Script=Hangul}/u, 'ko'],
	[/\p{Script=Han}/u, 'zh'],
	[/\p{Script=Cyrillic}/u, 'ru'],
	[/\p{Script=Arabic}/u, 'ar'],
	[/\p{Script=Hebrew}/u, 'he'],
	[/\p{Script=Greek}/u, 'el'],
	[/\p{Script=Thai}/u, 'th'],
	[/\p{Script=Devanagari}/u, 'hi']
];

/**
 * S20: best effort only, used to label a non-English source. Detecting the
 * script is cheap and honest; telling French from English is not attempted.
 */
function guessLanguage(title: string, excerpt: string | null): string {
	const sample = `${title} ${excerpt ?? ''}`.slice(0, 400);
	for (const [script, language] of SCRIPTS) if (script.test(sample)) return language;
	return 'en';
}

function usablePublished(value: RawItem['publishedAt']): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * S7. Canonicalises and dedups one source's items against the category's
 * existing rows: identical URL, identical normalised title, or Jaccard ≥ 0.72
 * within 48h. A match keeps the old row and only adds a source link.
 */
export async function insertItems(
	db: Db,
	owner: Owner,
	raw: RawItem[],
	now = Date.now()
): Promise<number> {
	// One read per source rather than one query per item: a remote Turso round
	// trip per candidate would make a 200-item pass unusably slow.
	const rows = await db
		.select({
			id: item.id,
			title: item.title,
			publishedAt: item.publishedAt,
			category: item.category
		})
		.from(item)
		.where(eq(item.category, owner.category))
		.all();

	const candidates: Candidate[] = rows.map((r) => ({ ...r, key: titleKey(r.title) }));
	const byId = new Map<string, Candidate>();
	const byTitle = new Map<string, Candidate>();
	const remember = (candidate: Candidate) => {
		candidates.push(candidate);
		byId.set(candidate.id, candidate);
		if (!byTitle.has(candidate.key)) byTitle.set(candidate.key, candidate);
	};
	for (const candidate of candidates) {
		byId.set(candidate.id, candidate);
		if (!byTitle.has(candidate.key)) byTitle.set(candidate.key, candidate);
	}

	const findMatch = (id: string, key: string, publishedAt: number) => {
		const canonical = byId.get(id);
		if (canonical) return canonical;
		if (!key) return undefined;

		const titled = byTitle.get(key);
		if (titled) return titled;

		let best: Candidate | undefined;
		let bestScore = 0;
		for (const candidate of candidates) {
			if (Math.abs(candidate.publishedAt - publishedAt) > DEDUP_WINDOW_MS) continue;
			const score = jaccard(key, candidate.key);
			if (score >= JACCARD_THRESHOLD && score > bestScore) {
				best = candidate;
				bestScore = score;
			}
		}
		return best;
	};

	// Only a link that did not exist before adds a source; re-reading the same
	// feed must not inflate the badge.
	const link = async (target: string, url: string, rawTitle: string, bump: boolean) => {
		const added = await db
			.insert(itemSource)
			.values({ itemId: target, sourceId: owner.id, url, rawTitle })
			.onConflictDoNothing()
			.returning({ itemId: itemSource.itemId });
		if (added.length && bump)
			await db
				.update(item)
				.set({ sourceCount: sql`${item.sourceCount} + 1` })
				.where(eq(item.id, target));
	};

	let inserted = 0;

	for (const entry of raw) {
		const url = canonicalUrl(entry.url);
		if (!url) continue;

		const id = itemId(url);
		const title = entry.title;
		const publishedAt = usablePublished(entry.publishedAt) ? entry.publishedAt : now;
		const key = titleKey(title);

		const match = findMatch(id, key, publishedAt);
		if (match) {
			await link(match.id, entry.url, title, true);
			continue;
		}

		const excerpt = toText(entry.excerpt)?.slice(0, EXCERPT_MAX) ?? null;
		const fresh = await db
			.insert(item)
			.values({
				id,
				title,
				url,
				author: entry.author ?? null,
				publishedAt,
				publishedEstimated: !usablePublished(entry.publishedAt),
				fetchedAt: now,
				excerpt,
				language: guessLanguage(title, excerpt),
				category: owner.category
			})
			.onConflictDoNothing()
			.returning({ id: item.id });

		if (fresh.length) {
			inserted++;
			await link(id, entry.url, title, false);
			remember({ id, title, publishedAt, category: owner.category, key });
			continue;
		}

		// The canonical id already exists: another category owns the row (never
		// merged), or a concurrent same-category insert beat this preload.
		const [existing] = await db
			.select({
				id: item.id,
				title: item.title,
				publishedAt: item.publishedAt,
				category: item.category
			})
			.from(item)
			.where(eq(item.id, id))
			.all();
		if (!existing || existing.category !== owner.category) continue;

		const candidate: Candidate = { ...existing, key: titleKey(existing.title) };
		if (!byId.has(candidate.id)) remember(candidate);
		await link(candidate.id, entry.url, title, true);
	}

	return inserted;
}
