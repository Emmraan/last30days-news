import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export const RETENTION_DAYS = 30;

const MIGRATIONS = import.meta.glob('../../../../drizzle/*.sql', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

/** §S19: one data dir per platform, `L30_DATA_DIR` wins. */
export function resolveDataDir(): string {
	if (process.env.L30_DATA_DIR) return process.env.L30_DATA_DIR;
	if (process.env.APPDATA) return join(process.env.APPDATA, 'last30days-news');
	if (process.platform === 'darwin')
		return join(homedir(), 'Library', 'Application Support', 'last30days-news');
	return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'last30days-news');
}

async function supportsFts5(client: Client): Promise<boolean> {
	try {
		const { rows } = await client.execute(
			"select count(*) as n from pragma_module_list where name = 'fts5'"
		);
		return Number(rows[0]?.n ?? 0) > 0;
	} catch {
		// An engine that cannot list modules may still build FTS5; let the
		// migration try rather than silently downgrading search.
		return true;
	}
}

async function applyMigrations(client: Client) {
	await client.execute(
		'create table if not exists __migration (name text primary key, applied_at integer not null)'
	);
	const { rows } = await client.execute('select name from __migration');
	const applied = new Set(rows.map((r) => String(r.name)));
	const fts5 = await supportsFts5(client);

	// Byte order, not localeCompare: migration order must not depend on the
	// machine's collation, or two hosts apply the same files in two orders.
	const pending = Object.entries(MIGRATIONS).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	for (const [path, sql] of pending) {
		const name = path.slice(path.lastIndexOf('/') + 1);
		if (applied.has(name)) continue;
		// §S13: a build without FTS5 still boots; search uses the LIKE fallback.
		if (!fts5 && /using\s+fts5/i.test(sql)) {
			await client.execute({
				sql: 'insert into __migration (name, applied_at) values (?, ?)',
				args: [name, Date.now()]
			});
			continue;
		}
		// One transaction per file: a crash mid-migration must not leave the
		// DDL applied but unrecorded, or the next boot replays it and fails.
		const tx = await client.transaction('write');
		try {
			// executeMultiple keeps trigger bodies (`;` inside BEGIN…END) intact.
			await tx.executeMultiple(sql);
			await tx.execute({
				sql: 'insert into __migration (name, applied_at) values (?, ?)',
				args: [name, Date.now()]
			});
			await tx.commit();
		} catch (err) {
			await tx.rollback();
			throw err;
		}
	}
}

export type Db = LibSQLDatabase<typeof schema>;

export async function createDb(opts: { dataDir?: string } = {}) {
	const remote = process.env.TURSO_DATABASE_URL;
	const dataDir = opts.dataDir ?? resolveDataDir();
	const url = remote ?? `file:${join(dataDir, 'db.sqlite')}`;

	if (!remote) mkdirSync(dataDir, { recursive: true, mode: 0o700 });

	const client = createClient({
		url,
		authToken: remote ? process.env.TURSO_AUTH_TOKEN : undefined
	});

	// A remote replica manages its own pragmas (§S2).
	if (!remote) {
		await client.execute('PRAGMA journal_mode=WAL');
		await client.execute('PRAGMA synchronous=NORMAL');
		await client.execute('PRAGMA foreign_keys=ON');
	}

	await applyMigrations(client);

	return {
		db: drizzle(client, { schema }) as LibSQLDatabase<typeof schema>,
		client,
		close: () => client.close()
	};
}
