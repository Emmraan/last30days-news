import { mapLimit, readText, safeFetch, toText, type FetchCtx, type RawItem } from './raw';

const FIRST = 100;
const ITEM_CONCURRENCY = 8;

type HnItem = {
	type?: string;
	title?: string;
	url?: string;
	by?: string;
	time?: number;
	text?: string;
	dead?: boolean;
	deleted?: boolean;
};

export function mapHnItem(raw: HnItem | null, id: number): RawItem | null {
	// Only stories: `job`, `poll` and `comment` would fill the feed with noise.
	if (!raw || raw.type !== 'story' || raw.dead || raw.deleted || !raw.title) return null;
	const title = raw.title.trim();
	return {
		url: raw.url ?? `https://news.ycombinator.com/item?id=${id}`,
		title,
		author: raw.by ?? null,
		publishedAt: raw.time ? raw.time * 1000 : null,
		excerpt: toText(raw.text) ?? title
	};
}

export async function fetchHn({ url }: { url: string }, ctx: FetchCtx): Promise<RawItem[]> {
	const base = url.replace(/\/+$/, '');
	const top = await safeFetch(`${base}/topstories.json`, ctx);
	if (!top.ok) throw new Error(`${base}/topstories.json returned ${top.status}`);
	const ids = (JSON.parse(await readText(top)) as number[]).slice(0, FIRST);

	const items = await mapLimit(ids, ITEM_CONCURRENCY, async (id) => {
		const res = await safeFetch(`${base}/item/${id}.json`, ctx);
		if (!res.ok) return null;
		return mapHnItem(JSON.parse(await readText(res)) as HnItem, id);
	});
	return items.filter((i): i is RawItem => i !== null);
}
