import { expect, test } from 'vitest';
import type { LanguageModel } from 'ai';
import { deriveKey, encryptSecret, newSalt } from '#lib/server/auth/secret';
import { setSetting } from '#lib/server/settings';
import { PROVIDERS_KEY, buildModel, getActiveProvider, parseProviderEntry, providerKeyName } from '#lib/server/ai/provider';
import { freshDb } from './helper';

const salt = newSalt();
const vaultKey = deriveKey('correct horse', salt);

/** `LanguageModel` may also be a bare model id, so read both shapes. */
const modelId = (model: LanguageModel) => (typeof model === 'string' ? model : model.modelId);

async function keyed(db: Awaited<ReturnType<typeof freshDb>>['db'], plain: string) {
	await setSetting(db, providerKeyName('openai'), encryptSecret(vaultKey, plain));
}

test('no provider setting means no active provider', async () => {
	const { db } = await freshDb();
	expect(await getActiveProvider(db)).toBeNull();
});

test('a malformed provider setting is ignored instead of crashing', async () => {
	const { db } = await freshDb();
	await setSetting(db, PROVIDERS_KEY, 'not an array');
	expect(await getActiveProvider(db)).toBeNull();
	await setSetting(db, PROVIDERS_KEY, [{ id: 'bogus', enabled: true, model: 'm' }, null]);
	expect(await getActiveProvider(db)).toBeNull();
});

test('the first enabled valid provider wins and disabled entries are skipped', async () => {
	const { db } = await freshDb();
	await setSetting(db, PROVIDERS_KEY, [
		{ id: 'openai', enabled: false, model: 'gpt-4o-mini' },
		{ id: 'bogus', enabled: true, model: 'nope' },
		{ id: 'groq', enabled: true, model: 'llama-3.3-70b' },
		{ id: 'ollama', enabled: true, model: 'llama3' }
	]);
	const provider = await getActiveProvider(db);
	expect(provider).toMatchObject({
		id: 'groq',
		model: 'llama-3.3-70b',
		baseUrl: 'https://api.groq.com/openai/v1',
		cacheKey: 'groq:llama-3.3-70b'
	});
});

test('a provider without a key is not configured', async () => {
	const { db } = await freshDb();
	const provider = parseProviderEntry({ id: 'openai', model: 'gpt-4o-mini' })!;
	expect(await buildModel(db, provider)).toEqual({ ok: false, code: 'ai_not_configured' });
});

test('an encrypted key without a vault key is locked', async () => {
	const { db } = await freshDb();
	await keyed(db, 'sk-live-secret');
	const provider = parseProviderEntry({ id: 'openai', model: 'gpt-4o-mini' })!;
	expect(await buildModel(db, provider)).toEqual({ ok: false, code: 'ai_locked' });
	expect(await buildModel(db, provider, Buffer.alloc(32, 9))).toEqual({
		ok: false,
		code: 'ai_locked'
	});
});

test('the right vault key builds the configured model', async () => {
	const { db } = await freshDb();
	await keyed(db, 'sk-live-secret');
	const provider = parseProviderEntry({ id: 'openai', model: 'gpt-4o-mini' })!;
	const built = await buildModel(db, provider, vaultKey);
	expect(built.ok).toBe(true);
	if (built.ok) expect(modelId(built.model)).toBe('gpt-4o-mini');
});

test('a local provider needs no key and no vault', async () => {
	const { db } = await freshDb();
	for (const id of ['ollama', 'lmstudio'] as const) {
		const provider = parseProviderEntry({ id, model: 'local-model' })!;
		const built = await buildModel(db, provider);
		expect(built.ok).toBe(true);
		if (built.ok) expect(modelId(built.model)).toBe('local-model');
	}
});

test('a custom provider without a key still builds', async () => {
	const { db } = await freshDb();
	const provider = parseProviderEntry({
		id: 'custom',
		model: 'local-model',
		baseUrl: 'http://127.0.0.1:8000/v1'
	})!;
	const built = await buildModel(db, provider);
	expect(built.ok).toBe(true);
});

test('an explicit key overrides the stored key and needs no vault', async () => {
	const { db } = await freshDb();
	await keyed(db, 'sk-stored');
	const provider = parseProviderEntry({ id: 'openai', model: 'gpt-4o-mini' })!;
	const built = await buildModel(db, provider, undefined, 'sk-from-request');
	expect(built.ok).toBe(true);
});
