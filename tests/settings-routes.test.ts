import { expect, test } from 'vitest';
import { GET as getSettings, PATCH as patchSettings } from '../src/routes/api/settings/+server';
import { deriveKey, encryptSecret, newSalt } from '#lib/server/auth/secret';
import { PROVIDERS_KEY, providerKeyName } from '#lib/server/ai/provider';
import { getSetting, setSetting } from '#lib/server/settings';
import { THEME_COOKIE } from '#lib/theme';
import { makeEvent, read } from './events';
import { freshDb } from './helper';

const URL_SETTINGS = 'http://127.0.0.1:4477/api/settings';
const vaultKey = deriveKey('correct horse', newSalt());
const SESSION = 'a'.repeat(64);

const get = (db: never, extra: Record<string, unknown> = {}) =>
	getSettings(
		makeEvent({ db, url: URL_SETTINGS, sessionId: SESSION, ...extra }).event as never
	).then(read);

const patch = (db: never, body: unknown, extra: Record<string, unknown> = {}) =>
	patchSettings(
		makeEvent({
			db,
			url: URL_SETTINGS,
			method: 'PATCH',
			sessionId: SESSION,
			...extra,
			body
		}).event as never
	).then(read);

test('GET without a session is a 401', async () => {
	const { db } = await freshDb();
	const { event } = makeEvent({ db, url: URL_SETTINGS });
	const res = await read(await getSettings(event as never));
	expect(res.status).toBe(401);
});

test('PATCH without a session is a 401 and writes nothing', async () => {
	const { db } = await freshDb();
	const { event } = makeEvent({ db, url: URL_SETTINGS, method: 'PATCH', body: { theme: 'light' } });
	const res = await read(await patchSettings(event as never));
	expect(res.status).toBe(401);
	expect(await getSetting(db, PROVIDERS_KEY)).toBeNull();
});

test('GET reports the cookie theme and no providers on a fresh install', async () => {
	const { db } = await freshDb();
	const res = await get(db as never);
	expect(res.status).toBe(200);
	expect(res.body!.theme).toBeNull();
	expect(res.body!.providers).toEqual([]);
	expect(Array.isArray(res.body!.ids)).toBe(true);
});

test('GET never returns key material, only a configured flag', async () => {
	const { db } = await freshDb();
	await setSetting(db, PROVIDERS_KEY, [{ id: 'openai', enabled: true, model: 'gpt-4o-mini' }]);
	await setSetting(db, providerKeyName('openai'), encryptSecret(vaultKey, 'sk-raw-secret'));

	const res = await get(db as never);
	expect(res.status).toBe(200);
	expect(res.raw).not.toContain('sk-raw-secret');
	const provider = (res.body!.providers as Record<string, unknown>[])[0];
	expect(provider).toMatchObject({
		id: 'openai',
		enabled: true,
		model: 'gpt-4o-mini',
		baseUrl: 'https://api.openai.com/v1',
		requiresKey: true,
		keyConfigured: true
	});
	expect(provider).not.toHaveProperty('key');
	expect(provider).not.toHaveProperty('apiKey');
});

test('PATCH theme sets the cookie and the next GET reads it back', async () => {
	const { db } = await freshDb();
	const { event, jar } = makeEvent({
		db,
		url: URL_SETTINGS,
		method: 'PATCH',
		sessionId: SESSION,
		body: { theme: 'light' }
	});
	const res = await read(await patchSettings(event as never));
	expect(res.status).toBe(200);
	expect(jar.jar.get(THEME_COOKIE)).toBe('light');
	expect((jar.opts.get(THEME_COOKIE) as Record<string, unknown>).httpOnly).toBeFalsy();

	const after = await get(db as never, { cookies: jar });
	expect(after.body!.theme).toBe('light');
});

test('PATCH saves a provider without a key and GET reflects it', async () => {
	const { db } = await freshDb();
	const res = await patch(db as never, {
		providers: [{ id: 'groq', model: 'llama-3.3-70b' }]
	});
	expect(res.status).toBe(200);

	const after = await get(db as never);
	expect((after.body!.providers as Record<string, unknown>[])[0]).toMatchObject({
		id: 'groq',
		model: 'llama-3.3-70b',
		enabled: true,
		keyConfigured: false
	});
});

test('PATCH stores a key encrypted, and the raw value is nowhere in the row', async () => {
	const { db } = await freshDb();
	await patch(db as never, { providers: [{ id: 'openai', model: 'gpt-4o-mini' }] });
	const res = await patch(db as never, { keys: [{ id: 'openai', key: 'sk-raw-secret' }] }, { vaultKey });
	expect(res.status).toBe(200);
	expect(res.raw).not.toContain('sk-raw-secret');

	const stored = await getSetting<string>(db, providerKeyName('openai'));
	expect(stored).toBeTruthy();
	expect(String(stored)).not.toContain('sk-raw-secret');
	expect(await getSetting<string>(db, providerKeyName('openai') + '.hint')).toBeNull();

	const after = await get(db as never);
	expect((after.body!.providers as Record<string, unknown>[])[0].keyConfigured).toBe(true);
});

test('PATCH a key with no vault key is a 409 ai_locked and stores nothing', async () => {
	const { db } = await freshDb();
	await patch(db as never, { providers: [{ id: 'openai', model: 'gpt-4o-mini' }] });
	const res = await patch(db as never, { keys: [{ id: 'openai', key: 'sk-raw-secret' }] });
	expect(res.status).toBe(409);
	expect((res.body!.error as { code: string }).code).toBe('ai_locked');
	expect(await getSetting(db, providerKeyName('openai'))).toBeNull();
	expect(res.raw).not.toContain('sk-raw-secret');
});

test('PATCH null clears a stored key', async () => {
	const { db } = await freshDb();
	await patch(db as never, { providers: [{ id: 'openai', model: 'gpt-4o-mini' }] });
	await patch(db as never, { keys: [{ id: 'openai', key: 'sk-raw-secret' }] }, { vaultKey });

	const res = await patch(db as never, { keys: [{ id: 'openai', key: null }] });
	expect(res.status).toBe(200);
	expect(await getSetting(db, providerKeyName('openai'))).toBeNull();
	const after = await get(db as never);
	expect((after.body!.providers as Record<string, unknown>[])[0].keyConfigured).toBe(false);
});

test('PATCH writes no key when a provider entry in the same body is invalid', async () => {
	const { db } = await freshDb();
	const res = await patch(
		db as never,
		{
			providers: [{ id: 'custom', model: 'm' }],
			keys: [{ id: 'custom', key: 'sk-raw-secret' }]
		},
		{ vaultKey }
	);
	expect(res.status).toBe(400);
	expect(await getSetting(db, providerKeyName('custom'))).toBeNull();
	expect(await getSetting(db, PROVIDERS_KEY)).toBeNull();
	expect(res.raw).not.toContain('sk-raw-secret');
});

test('PATCH refuses a non-http base URL and an unknown field', async () => {
	const { db } = await freshDb();
	expect(
		(await patch(db as never, { providers: [{ id: 'openai', model: 'm', baseUrl: 'file:///etc/passwd' }] }))
			.status
	).toBe(400);
	expect((await patch(db as never, { theme: 'dark', admin: true })).status).toBe(400);
	expect((await patch(db as never, { theme: 'blue' })).status).toBe(400);
});

test('PATCH refuses a duplicate provider id', async () => {
	const { db } = await freshDb();
	const res = await patch(db as never, {
		providers: [
			{ id: 'openai', model: 'a' },
			{ id: 'openai', model: 'b' }
		]
	});
	expect(res.status).toBe(400);
	expect(await getSetting(db, PROVIDERS_KEY)).toBeNull();
});

test('a password change keeps a stored key usable', async () => {
	const salt = newSalt();
	const { db } = await freshDb();
	await setSetting(db, 'crypto.salt', salt.toString('base64'));
	await patch(db as never, { providers: [{ id: 'openai', model: 'gpt-4o-mini' }] });
	await patch(
		db as never,
		{ keys: [{ id: 'openai', key: 'sk-raw-secret' }] },
		{ vaultKey: deriveKey('old password', salt) }
	);

	const { POST: changePassword } = await import('../src/routes/api/auth/password/+server');
	const { hashPassword } = await import('#lib/server/auth/password');
	await setSetting(db, 'auth.password', await hashPassword('old password'));

	const res = await read(
		await changePassword(
			makeEvent({
				db,
				url: 'http://127.0.0.1:4477/api/auth/password',
				sessionId: SESSION,
				body: { current: 'old password', next: 'brand-new-pass' }
			}).event as never
		)
	);
	expect(res.status).toBe(200);

	const after = await get(db as never);
	expect((after.body!.providers as Record<string, unknown>[])[0].keyConfigured).toBe(true);

	const { decryptSecret } = await import('#lib/server/auth/secret');
	const { getSalt } = await import('#lib/server/auth/vault');
	const row = await getSetting<string>(db, providerKeyName('openai'));
	expect(decryptSecret(deriveKey('brand-new-pass', (await getSalt(db))!), String(row))).toBe(
		'sk-raw-secret'
	);
});
