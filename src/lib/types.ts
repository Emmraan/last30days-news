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
};

export type Summary = {
	model: string;
	body: string;
	citations: { n: number; source_id: string; url: string }[];
	createdAt: number;
};
