export type Rankable = { sourceCount: number; publishedAt: number; id: string };

/** §S7 MVP rank: source_count desc, published_at desc, id asc. */
export function compareRank(a: Rankable, b: Rankable): number {
	if (a.sourceCount !== b.sourceCount) return b.sourceCount - a.sourceCount;
	if (a.publishedAt !== b.publishedAt) return b.publishedAt - a.publishedAt;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
