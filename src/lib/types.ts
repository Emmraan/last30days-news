/** Shared wire shapes. Timestamps cross the wire as integer ms (§S10). */
export type Item = {
	id: string;
	title: string;
	url: string;
	author: string | null;
	publishedAt: number;
	publishedEstimated: boolean;
	fetchedAt: number;
	excerpt: string | null;
	language: string | null;
	category: string;
	sourceCount: number;
	/** Feed rows only: the attribution label shown beside the row. */
	sourceName?: string | null;
	/** Present only when the request filtered by a scored category (§S8). */
	score?: number | null;
	reason?: string | null;
};

export type Summary = {
	model: string;
	body: string;
	keyPoints: string[];
	whyItMatters: string | null;
	citations: { n: number; source_id: string; url: string }[];
	createdAt: number;
};

export type FeedPage = {
	items: Item[];
	nextCursor: string | null;
};

export type ItemSource = {
	id: string;
	name: string;
	url: string;
	rawTitle: string | null;
};

export type ItemDetail = {
	item: Omit<Item, 'sourceName'>;
	sources: ItemSource[];
	summary: Summary | null;
};

export type FeedCategory = {
	id: string;
	name: string;
	builtin: boolean;
};
