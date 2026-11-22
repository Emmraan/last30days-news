import { eq, lt } from 'drizzle-orm';
import { RETENTION_DAYS, type Db } from '../db';
import { item, source } from '../db/schema';
import { pruneAttempts } from '../auth/rate';
import { pruneSessions } from '../auth/session';
import { deleteSetting, getSetting, setSetting } from '../settings';
import { insertItems } from '../ingest/insert';
import { fetchHn } from '../sources/hn';
import { fetchJson } from '../sources/json';
import { fetchRss } from '../sources/rss';
import { MAX_ITEMS_PER_SOURCE, type RawItem } from '../sources/raw';
import { log } from '../log';

export const MAX_PER_SOURCE = MAX_ITEMS_PER_SOURCE;
export const CONCURRENCY = 4;
export const TIMEOUT_MS = 10_000;
export const DISABLE_AFTER = 3;

const DAY = 86_400_000;
const strikeKey = (id: string) => `source.strikes.${id}`;

export type PassEvent =
	| { type: 'source'; sourceId: string; ok: boolean; inserted: number; error?: string; disabled?: boolean }
	| { type: 'done'; inserted: number; pruned: number; sources: number };

export type PassDeps = {
	db: Db;
	fetch?: typeof globalThis.fetch;
	now?: number;
	emit?: (event: PassEvent) => void;
	batch?: boolean;
	/** Tests shorten this; production uses 500 ms then 1500 ms, jittered. */
	retryDelays?: number[];
};

type SourceRow = typeof source.$inferSelect;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fetchSource(row: SourceRow, ctx: { fetch: typeof globalThis.fetch; signal: AbortSignal }) {
	if (row.kind === 'hn') return fetchHn(row, ctx);
	if (row.kind === 'json') return fetchJson(row, ctx);
	return fetchRss(row, ctx);
}

/** At most `limit` sources in flight, one failing source never fails the pass. */
async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (next < items.length) await fn(items[next++]);
		})
	);
}

export async function runPass(deps: PassDeps): Promise<PassEvent[]> {
	const {
		db,
		fetch = globalThis.fetch,
		now = Date.now(),
		emit = () => {},
		batch = false,
		retryDelays = [500, 1500]
	} = deps;

	const events: PassEvent[] = [];
	const send = (event: PassEvent) => {
		events.push(event);
		// A closed SSE stream must not abort the pass half-way.
		try {
			emit(event);
		} catch {
			/* the client went away; the remaining sources still need fetching */
		}
	};

	const rows = await db.select().from(source).where(eq(source.enabled, true)).all();
	const due = rows.filter(
		(r) => r.lastFetchedAt === null || r.lastFetchedAt + r.fetchIntervalMin * 60_000 <= now
	);
	// Serverless has one short invocation, so it takes a fixed slice and the
	// client calls again (§S19).
	const picked = batch ? due.slice(0, CONCURRENCY) : due;

	let inserted = 0;

	await eachLimit(picked, CONCURRENCY, async (row) => {
		let items: RawItem[] | null = null;
		let error = '';

		for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
			try {
				items = await fetchSource(row, { fetch, signal: AbortSignal.timeout(TIMEOUT_MS) });
				break;
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
				if (attempt < retryDelays.length) {
					const base = retryDelays[attempt];
					await sleep(base + Math.random() * base * 0.25);
				}
			}
		}

		if (!items) {
			const strikes = ((await getSetting<number>(db, strikeKey(row.id))) ?? 0) + 1;
			await setSetting(db, strikeKey(row.id), strikes);
			const disabled = strikes >= DISABLE_AFTER;
			await db
				.update(source)
				.set({ lastFetchedAt: now, lastStatus: disabled ? 'disabled' : 'error', lastError: error, enabled: !disabled })
				.where(eq(source.id, row.id));
			log('warn', 'fetch.fail', { source: row.id, strikes, error });
			send({ type: 'source', sourceId: row.id, ok: false, inserted: 0, error, disabled });
			return;
		}

		const count = await insertItems(db, row, items.slice(0, MAX_PER_SOURCE), now);
		inserted += count;
		await db
			.update(source)
			.set({ lastFetchedAt: now, lastStatus: 'ok', lastError: null })
			.where(eq(source.id, row.id));
		await deleteSetting(db, strikeKey(row.id));
		log('info', 'fetch.ok', { source: row.id, inserted: count });
		send({ type: 'source', sourceId: row.id, ok: true, inserted: count });
	});

	// §S6: prune after each pass, not on a timer.
	const gone = await db
		.delete(item)
		.where(lt(item.publishedAt, now - RETENTION_DAYS * DAY))
		.returning({ id: item.id });
	await pruneSessions(db, now);
	await pruneAttempts(db, now);

	send({ type: 'done', inserted, pruned: gone.length, sources: picked.length });
	return events;
}
