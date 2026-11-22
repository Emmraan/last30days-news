import { readText, safeFetch, toText, type FetchCtx, type RawItem } from './raw';

type JsonFeedItem = {
	url?: string;
	external_url?: string;
	title?: string;
	summary?: string;
	content_text?: string;
	content_html?: string;
	date_published?: string;
	authors?: { name?: string }[];
	author?: { name?: string };
};

type JsonFeed = { items?: JsonFeedItem[] };

/** JSON Feed 1.1 — the shape a user gets when they paste a non-RSS JSON feed. */
export async function fetchJson({ url }: { url: string }, ctx: FetchCtx): Promise<RawItem[]> {
	const res = await safeFetch(url, ctx);
	if (!res.ok) throw new Error(`${url} returned ${res.status}`);
	const feed = JSON.parse(await readText(res)) as JsonFeed;

	return (feed.items ?? []).flatMap((item) => {
		const link = item.url ?? item.external_url;
		const title = item.title?.trim();
		if (!link || !title) return [];
		const published = item.date_published ? Date.parse(item.date_published) : NaN;
		return [
			{
				url: link,
				title,
				author: item.authors?.[0]?.name ?? item.author?.name ?? null,
				publishedAt: Number.isNaN(published) ? null : published,
				excerpt: toText(item.summary ?? item.content_text ?? item.content_html ?? null)
			}
		];
	});
}
