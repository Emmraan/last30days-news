import Parser from 'rss-parser';
import {
	MAX_ITEMS_PER_SOURCE,
	readText,
	safeFetch,
	toText,
	type FetchCtx,
	type RawItem
} from './raw';

const parser = new Parser();

/** RSS 2.0 and Atom both land on rss-parser's `items`. */
export async function fetchRss({ url }: { url: string }, ctx: FetchCtx): Promise<RawItem[]> {
	const res = await safeFetch(url, ctx);
	if (!res.ok) throw new Error(`${url} returned ${res.status}`);
	const feed = await parser.parseString(await readText(res));

	// Slice before mapping: a 50k-item feed must not allocate 50k objects.
	return feed.items.slice(0, MAX_ITEMS_PER_SOURCE).flatMap((item) => {
		const link = item.link?.trim();
		const title = item.title?.trim();
		if (!link || !title) return [];
		return [
			{
				url: link,
				title,
				author: item.creator ?? null,
				publishedAt: item.isoDate ? Date.parse(item.isoDate) : null,
				excerpt: toText(item.content ?? item.summary ?? null)
			}
		];
	});
}
