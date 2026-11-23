import { asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { category } from '#lib/server/db/schema';
import { categoryViews } from '#lib/server/categories/store';
import { DEFAULT_LIMIT, queryFeed } from '#lib/server/feed/query';
import { presetRange } from '#lib/util/time';

export const load: PageServerLoad = async ({ locals }) => {
	const now = Date.now();
	const rows = await locals.db
		.select()
		.from(category)
		.orderBy(asc(category.sortOrder), asc(category.id))
		.all();
	const [feed, categories] = await Promise.all([
		queryFeed(locals.db, { ...presetRange('24h', now), limit: DEFAULT_LIMIT }),
		categoryViews(locals.db, rows)
	]);

	return { feed, categories, now, mustChangePassword: locals.mustChangePassword };
};
