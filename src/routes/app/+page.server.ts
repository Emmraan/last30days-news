import { asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { category } from '#lib/server/db/schema';
import { DEFAULT_LIMIT, queryFeed } from '#lib/server/feed/query';
import { presetRange } from '#lib/util/time';

export const load: PageServerLoad = async ({ locals }) => {
	const now = Date.now();
	const [feed, categories] = await Promise.all([
		queryFeed(locals.db, { ...presetRange('24h', now), limit: DEFAULT_LIMIT }),
		locals.db
			.select({ id: category.id, name: category.name, builtin: category.builtin })
			.from(category)
			.orderBy(asc(category.sortOrder), asc(category.id))
			.all()
	]);

	return { feed, categories, now };
};
