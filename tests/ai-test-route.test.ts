import { expect, test } from 'vitest';
import { POST as testProvider } from '../src/routes/api/settings/ai/test/+server';
import { encryptSecret } from '#lib/server/auth/secret';
import { PROVIDERS_KEY, providerKeyName } from '#lib/server/ai/provider';
import { setSetting } from '#lib/server/settings';
import { makeEvent, read } from './events';
import { freshDb } from './helper';

const call = (db: never, body: unknown) =>
	testProvider(makeEvent({ db, body }).event).then(read);

test('an unknown provider id is a 400 validation error', async () => {
	const { db } = await freshDb();
	const res = await call(db as never, { provider: 'bogus', model: 'm' });
	expect(res.status).toBe(400);
	expect((res.body!.error as { code: string }).code).toBe('validation');
});

test('a model is required', async () => {
	const { db } = await freshDb();
	expect((await call(db as never, { provider: 'openai' })).status).toBe(400);
});

test('a custom provider needs an http(s) base URL', async () => {
	const { db } = await freshDb();
	expect((await call(db as never, { provider: 'custom', model: 'm' })).status).toBe(400);
	expect(
		(await call(db as never, { provider: 'custom', model: 'm', baseUrl: 'file:///etc/passwd' })).status
	).toBe(400);
});

test('unknown body fields are refused and the key is not echoed', async () => {
	const { db } = await freshDb();
	const res = await call(db as never, {
		provider: 'openai',
		model: 'gpt-4o-mini',
		apiKey: 'sk-very-secret',
		admin: true
	});
	expect(res.status).toBe(400);
	expect(res.raw).not.toContain('sk-very-secret');
});

test('a provider without a stored key is a 409 ai_not_configured', async () => {
	const { db } = await freshDb();
	const res = await call(db as never, { provider: 'openai', model: 'gpt-4o-mini' });
	expect(res.status).toBe(409);
	expect((res.body!.error as { code: string }).code).toBe('ai_not_configured');
});

test('a stored key without a vault key is a 409 ai_locked and leaks nothing', async () => {
	const { db } = await freshDb();
	await setSetting(db, providerKeyName('openai'), encryptSecret(Buffer.alloc(32, 3), 'sk-stored-secret'));
	const res = await call(db as never, { provider: 'openai', model: 'gpt-4o-mini' });
	expect(res.status).toBe(409);
	expect((res.body!.error as { code: string }).code).toBe('ai_locked');
	expect(res.raw).not.toContain('sk-stored-secret');
});

test('a stored key is not sent to a different endpoint', async () => {
	const { db } = await freshDb();
	await setSetting(db, PROVIDERS_KEY, [
		{ id: 'openai', enabled: true, model: 'gpt-4o-mini' }
	]);
	await setSetting(db, providerKeyName('openai'), encryptSecret(Buffer.alloc(32, 4), 'sk-stored-secret'));
	const res = await call(db as never, {
		provider: 'openai',
		model: 'gpt-4o-mini',
		baseUrl: 'https://evil.example/v1'
	});
	expect(res.status).toBe(400);
	expect(res.raw).not.toContain('sk-stored-secret');
});

test('an omitted base URL falls back to the configured endpoint', async () => {
	const { db } = await freshDb();
	await setSetting(db, PROVIDERS_KEY, [
		{ id: 'custom', enabled: true, model: 'local', baseUrl: 'http://127.0.0.1:9999/v1' }
	]);
	await setSetting(db, providerKeyName('custom'), encryptSecret(Buffer.alloc(32, 6), 'sk-custom-secret'));
	const res = await call(db as never, { provider: 'custom', model: 'local' });
	expect(res.status).toBe(409);
	expect((res.body!.error as { code: string }).code).toBe('ai_locked');
	expect(res.raw).not.toContain('sk-custom-secret');
});
