import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// All timestamps are integer ms UTC (§S2). No soft deletes, no updated_at.
const ts = (name: string) => integer(name, { mode: 'number' });

export const category = sqliteTable('category', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	builtin: integer('builtin', { mode: 'boolean' }).notNull().default(false),
	matchMode: text('match_mode', { enum: ['keywords', 'ai', 'both'] })
		.notNull()
		.default('keywords'),
	keywords: text('keywords', { mode: 'json' }).$type<string[]>().notNull().default([]),
	prompt: text('prompt'),
	aiThreshold: real('ai_threshold').notNull().default(0.6),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: ts('created_at').notNull()
});

export const source = sqliteTable('source', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	kind: text('kind', { enum: ['rss', 'hn', 'json'] }).notNull(),
	url: text('url').notNull(),
	category: text('category')
		.notNull()
		.references(() => category.id, { onDelete: 'cascade' }),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	fetchIntervalMin: integer('fetch_interval_min').notNull().default(30),
	lastFetchedAt: ts('last_fetched_at'),
	lastStatus: text('last_status'),
	lastError: text('last_error'),
	createdAt: ts('created_at').notNull()
});

export const item = sqliteTable(
	'item',
	{
		// sha1(canonical_url) — see §S7.
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		url: text('url').notNull(),
		author: text('author'),
		publishedAt: ts('published_at').notNull(),
		publishedEstimated: integer('published_estimated', { mode: 'boolean' })
			.notNull()
			.default(false),
		fetchedAt: ts('fetched_at').notNull(),
		excerpt: text('excerpt'),
		language: text('language'),
		category: text('category')
			.notNull()
			.references(() => category.id, { onDelete: 'cascade' }),
		sourceCount: integer('source_count').notNull().default(1)
	},
	(t) => [
		index('item_published_at_idx').on(t.publishedAt),
		index('item_category_published_at_idx').on(t.category, t.publishedAt),
		index('item_fetched_at_idx').on(t.fetchedAt)
	]
);

export const itemSource = sqliteTable(
	'item_source',
	{
		itemId: text('item_id')
			.notNull()
			.references(() => item.id, { onDelete: 'cascade' }),
		sourceId: text('source_id')
			.notNull()
			.references(() => source.id, { onDelete: 'cascade' }),
		url: text('url').notNull(),
		rawTitle: text('raw_title')
	},
	(t) => [primaryKey({ columns: [t.itemId, t.sourceId] })]
);

export const summary = sqliteTable(
	'summary',
	{
		itemId: text('item_id')
			.notNull()
			.references(() => item.id, { onDelete: 'cascade' }),
		model: text('model').notNull(),
		body: text('body').notNull(),
		keyPoints: text('key_points', { mode: 'json' })
			.$type<string[]>()
			.notNull()
			.default([]),
		whyItMatters: text('why_it_matters'),
		citations: text('citations', { mode: 'json' })
			.$type<{ n: number; source_id: string; url: string }[]>()
			.notNull()
			.default([]),
		createdAt: ts('created_at').notNull(),
		tokensIn: integer('tokens_in'),
		tokensOut: integer('tokens_out')
	},
	(t) => [primaryKey({ columns: [t.itemId, t.model] })]
);

export const categorySource = sqliteTable(
	'category_source',
	{
		categoryId: text('category_id')
			.notNull()
			.references(() => category.id, { onDelete: 'cascade' }),
		sourceId: text('source_id')
			.notNull()
			.references(() => source.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.categoryId, t.sourceId] })]
);

export const categoryItem = sqliteTable(
	'category_item',
	{
		categoryId: text('category_id')
			.notNull()
			.references(() => category.id, { onDelete: 'cascade' }),
		itemId: text('item_id')
			.notNull()
			.references(() => item.id, { onDelete: 'cascade' }),
		promptHash: text('prompt_hash').notNull(),
		score: real('score').notNull(),
		reason: text('reason'),
		createdAt: ts('created_at').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.categoryId, t.itemId, t.promptHash] }),
		index('category_item_rank_idx').on(t.categoryId, t.promptHash, t.score),
		index('category_item_item_idx').on(t.itemId)
	]
);

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	createdAt: ts('created_at').notNull(),
	expiresAt: ts('expires_at').notNull(),
	lastSeenAt: ts('last_seen_at').notNull()
});

export const loginAttempt = sqliteTable(
	'login_attempt',
	{
		ip: text('ip').notNull(),
		ts: ts('ts').notNull()
	},
	(t) => [index('login_attempt_ip_ts_idx').on(t.ip, t.ts)]
);

export const setting = sqliteTable('setting', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' })
});
