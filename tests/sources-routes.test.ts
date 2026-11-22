import { expect, test } from 'vitest';
import { GET as listSources } from '../src/routes/api/sources/+server';
import { PATCH as patchSource } from '../src/routes/api/sources/[id]/+server';
import { seed } from '#lib/server/db/seed';
import { makeEvent, read } from './events';
import { freshDb } from './helper';

test('GET /api/sources lists every seeded source with its status', async () => {
	const { db } = await freshDb();
	await seed(db);
	const { event } = makeEvent({ db, url: 'http://127.0.0.1:4477/api/sources' });

	const res = await read(await listSources(event));

	expect(res.status).toBe(200);
	const sources = res.body!.sources as { id: string; enabled: boolean }[];
	expect(sources).toHaveLength(6);
	expect(sources.find((s) => s.id === 'ars')).toMatchObject({ enabled: true });
});

test('PATCH /api/sources/[id] toggles enabled and nothing else', async () => {
	const { db } = await freshDb();
	await seed(db);
	const { event } = makeEvent({
		db,
		method: 'PATCH',
		url: 'http://127.0.0.1:4477/api/sources/ars',
		params: { id: 'ars' },
		body: { enabled: false }
	});

	const res = await read(await patchSource(event));

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ id: 'ars', enabled: false });
});

test('PATCH rejects unknown fields instead of ignoring them', async () => {
	const { db } = await freshDb();
	await seed(db);
	const { event } = makeEvent({
		db,
		method: 'PATCH',
		url: 'http://127.0.0.1:4477/api/sources/ars',
		params: { id: 'ars' },
		body: { enabled: false, url: 'http://127.0.0.1:9' }
	});

	expect((await patchSource(event)).status).toBe(400);
});

test('PATCH on a missing source is a 404', async () => {
	const { db } = await freshDb();
	const { event } = makeEvent({
		db,
		method: 'PATCH',
		url: 'http://127.0.0.1:4477/api/sources/nope',
		params: { id: 'nope' },
		body: { enabled: false }
	});

	expect((await patchSource(event)).status).toBe(404);
});
