import { category, categorySource, source } from './schema';
import type { Db } from './index';

// §S4 builtin categories and §S5 seeded sources. Insert-or-ignore so every
// boot is a no-op once seeded, and a user rename is never clobbered.
const CATEGORIES = [
	{ id: 'technology', name: 'Technology', matchMode: 'keywords' as const, sortOrder: 0 },
	{ id: 'ai', name: 'AI', matchMode: 'keywords' as const, sortOrder: 1 }
];

const SOURCES = [
	{
		id: 'hn-top',
		name: 'Hacker News',
		kind: 'hn' as const,
		url: 'https://hacker-news.firebaseio.com/v0',
		category: 'technology',
		fetchIntervalMin: 30
	},
	{
		id: 'ars',
		name: 'Ars Technica',
		kind: 'rss' as const,
		url: 'https://feeds.arstechnica.com/arstechnica/index',
		category: 'technology',
		fetchIntervalMin: 30
	},
	{
		id: 'verge',
		name: 'The Verge',
		kind: 'rss' as const,
		url: 'https://www.theverge.com/rss/index.xml',
		category: 'technology',
		fetchIntervalMin: 30
	},
	{
		id: 'mit-tr',
		name: 'MIT Technology Review',
		kind: 'rss' as const,
		url: 'https://www.technologyreview.com/feed/',
		category: 'ai',
		fetchIntervalMin: 60
	},
	{
		id: 'tc-ai',
		name: 'TechCrunch AI',
		kind: 'rss' as const,
		url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
		category: 'ai',
		fetchIntervalMin: 60
	},
	{
		id: 'hf-blog',
		name: 'Hugging Face Blog',
		kind: 'rss' as const,
		url: 'https://huggingface.co/blog/feed.xml',
		category: 'ai',
		fetchIntervalMin: 120
	}
];

export async function seed(db: Db) {
	const now = Date.now();
	await db
		.insert(category)
		.values(
			CATEGORIES.map((c) => ({ ...c, builtin: true, keywords: [], createdAt: now }))
		)
		.onConflictDoNothing();
	await db
		.insert(source)
		.values(SOURCES.map((s) => ({ ...s, enabled: true, createdAt: now })))
		.onConflictDoNothing();
	await db
		.insert(categorySource)
		.values(SOURCES.map((s) => ({ categoryId: s.category, sourceId: s.id })))
		.onConflictDoNothing();
}
