import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { createDb, RETENTION_DAYS } from '#lib/server/db';
import { seed } from '#lib/server/db/seed';

const dirs: string[] = [];

function tempDir() {
	const dir = mkdtempSync(join(tmpdir(), 'l30-db-'));
	dirs.push(dir);
	return dir;
}

afterEach(() => {
	// Windows keeps the WAL handle briefly after close; retry, then ignore.
	while (dirs.length)
		try {
			rmSync(dirs.pop()!, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
		} catch {
			/* temp dir, OS cleans up */
		}
});

function counts(client: Awaited<ReturnType<typeof createDb>>["client"]) {
	const one = (sql: string) => client.execute(sql).then((r) => Number(r.rows[0][0]));
	const pragma = (sql: string) => client.execute(sql).then((r) => r.rows[0][0]);
	return Promise.all([
		one('select count(*) from category'),
		one('select count(*) from source'),
		one('select count(*) from item'),
		one("select count(*) from sqlite_master where name = 'item_fts'"),
		one("select count(*) from sqlite_master where type = 'trigger'"),
		pragma('PRAGMA journal_mode'),
		pragma('PRAGMA foreign_keys')
	]).then(([categories, sources, items, fts, triggers, journal, fk]) => ({
		categories,
		sources,
		items,
		fts,
		triggers,
		journal: String(journal),
		fk: Number(fk)
	}));
}

test('retention is 30 days in one place', () => {
	expect(RETENTION_DAYS).toBe(30);
});

test('fresh boot creates the schema and seeds 2 categories + 6 sources', async () => {
	const { db, client, close } = await createDb({ dataDir: tempDir() });
	await seed(db);

	const c = await counts(client);
	expect(c).toMatchObject({ categories: 2, sources: 6, items: 0, fts: 1, triggers: 3, fk: 1 });
	expect(c.journal).toBe('wal');
	// Order must be byte order, not the host's collation.
	const applied = (await client.execute('select name from __migration order by applied_at')).rows.map(
		(r) => String(r[0])
	);
	expect(applied).toEqual([...applied].sort());
	await close();
});

test('second boot changes nothing', async () => {
	const dir = tempDir();
	const first = await createDb({ dataDir: dir });
	await seed(first.db);
	const before = await first.client.execute('select id, created_at from source order by id');
	await first.close();

	const second = await createDb({ dataDir: dir });
	await seed(second.db);
	const after = await second.client.execute('select id, created_at from source order by id');
	await second.close();

	expect(after.rows).toEqual(before.rows);
	expect(after.rows).toHaveLength(6);
});

test('reopens the same file without losing data', async () => {
	const dir = tempDir();
	const first = await createDb({ dataDir: dir });
	await seed(first.db);
	await first.close();

	const second = await createDb({ dataDir: dir });
	const c = await counts(second.client);
	await second.close();

	expect(c).toMatchObject({ categories: 2, sources: 6 });
});

test('seed does not clobber an edited row', async () => {
	const { db, client, close } = await createDb({ dataDir: tempDir() });
	await seed(db);
	await client.execute("update source set name = 'renamed' where id = 'ars'");
	await seed(db);
	const row = await client.execute("select name from source where id = 'ars'");
	expect(row.rows[0][0]).toBe('renamed');
	await close();
});

test('deletes cascade from item and category', async () => {
	const { db, client, close } = await createDb({ dataDir: tempDir() });
	await seed(db);
	const now = Date.now();
	await client.executeMultiple(`
		insert into item (id, title, url, published_at, fetched_at, category)
		values ('i1', 't', 'https://e.com/a', ${now}, ${now}, 'ai');
		insert into item_source (item_id, source_id, url) values ('i1', 'hf-blog', 'https://e.com/a');
		insert into summary (item_id, model, body, citations, created_at)
		values ('i1', 'm', 'b', '[]', ${now});
		delete from item where id = 'i1';
	`);
	const left = await client.execute(
		'select (select count(*) from item_source) + (select count(*) from summary)'
	);
	expect(Number(left.rows[0][0])).toBe(0);
	await close();
});

test('fts stays in sync through insert, update and delete', async () => {
	const { db, client, close } = await createDb({ dataDir: tempDir() });
	await seed(db);
	const now = Date.now();
	const match = async (q: string) => {
		const r = await client.execute({
			sql: 'select count(*) from item_fts where item_fts match ?',
			args: [q]
		});
		return Number(r.rows[0][0]);
	};

	await client.executeMultiple(`
		insert into item (id, title, url, published_at, fetched_at, excerpt, category)
		values ('i1', 'Quantum widgets', 'https://e.com/a', ${now}, ${now}, 'nothing here', 'ai');
	`);
	expect(await match('quantum')).toBe(1);

	await client.execute("update item set title = 'Ordinary gadgets' where id = 'i1'");
	expect(await match('quantum')).toBe(0);
	expect(await match('gadgets')).toBe(1);

	await client.execute("delete from item where id = 'i1'");
	expect(await match('gadgets')).toBe(0);
	await close();
});
