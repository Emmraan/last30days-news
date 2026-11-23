import { expect, test } from 'vitest';
import {
	DEFAULT_BASE_URLS,
	PROVIDER_IDS,
	cacheKeyFor,
	parseProviderEntry,
	providerKeyName
} from './provider';

const defaults = [
	['openai', 'https://api.openai.com/v1', true],
	['anthropic', 'https://api.anthropic.com/v1', true],
	['google', 'https://generativelanguage.googleapis.com/v1beta', true],
	['openrouter', 'https://openrouter.ai/api/v1', true],
	['groq', 'https://api.groq.com/openai/v1', true],
	['deepseek', 'https://api.deepseek.com/v1', true],
	['ollama', 'http://127.0.0.1:11434/v1', false],
	['lmstudio', 'http://127.0.0.1:1234/v1', false]
] as const;

test('the provider list covers the nine documented providers', () => {
	expect(PROVIDER_IDS).toEqual([
		'openai',
		'anthropic',
		'google',
		'openrouter',
		'groq',
		'deepseek',
		'ollama',
		'lmstudio',
		'custom'
	]);
	expect(Object.keys(DEFAULT_BASE_URLS).sort()).toEqual(
		PROVIDER_IDS.filter((id) => id !== 'custom').sort()
	);
});

test.each(defaults)('%s resolves its default base URL', (id, baseUrl, requiresKey) => {
	const provider = parseProviderEntry({ id, model: 'a-model' });
	expect(provider).toMatchObject({
		id,
		enabled: true,
		baseUrl,
		requiresKey,
		cacheKey: `${id}:a-model`
	});
	expect(provider!.cacheKey).toBe(cacheKeyFor(id, 'a-model'));
});

test('a custom provider needs an explicit http(s) base URL', () => {
	expect(parseProviderEntry({ id: 'custom', model: 'local' })).toBeNull();
	expect(parseProviderEntry({ id: 'custom', model: 'local', baseUrl: '' })).toBeNull();
	expect(parseProviderEntry({ id: 'custom', model: 'local', baseUrl: 'file:///etc/passwd' })).toBeNull();
	expect(parseProviderEntry({ id: 'custom', model: 'local', baseUrl: 'not a url' })).toBeNull();
	expect(
		parseProviderEntry({ id: 'custom', model: 'local', baseUrl: 'http://127.0.0.1:8000/v1' })
	).toMatchObject({ requiresKey: false, baseUrl: 'http://127.0.0.1:8000/v1' });
});

test('a built-in provider may override its base URL only with http(s)', () => {
	expect(
		parseProviderEntry({ id: 'openai', model: 'm', baseUrl: 'https://proxy.example/v1' })
	).toMatchObject({ baseUrl: 'https://proxy.example/v1' });
	expect(parseProviderEntry({ id: 'openai', model: 'm', baseUrl: 'ftp://proxy.example' })).toBeNull();
	expect(parseProviderEntry({ id: 'openai', model: 'm', baseUrl: 'javascript:alert(1)' })).toBeNull();
	expect(
		parseProviderEntry({ id: 'openai', model: 'm', baseUrl: 'https://user:pass@proxy.example/v1' })
	).toBeNull();
});

test('unknown, empty or oversized entries are refused', () => {
	expect(parseProviderEntry(null)).toBeNull();
	expect(parseProviderEntry('openai')).toBeNull();
	expect(parseProviderEntry({ id: 'bogus', model: 'm' })).toBeNull();
	expect(parseProviderEntry({ id: 'openai', model: '' })).toBeNull();
	expect(parseProviderEntry({ id: 'openai', model: 'x'.repeat(201) })).toBeNull();
	expect(parseProviderEntry({ id: 'openai', model: 'm', baseUrl: `https://x/${'a'.repeat(2048)}` })).toBeNull();
	expect(parseProviderEntry({ id: 'openai', model: 'm', extra: true })).toBeNull();
});

test('a disabled entry is still parsed but reports enabled=false', () => {
	expect(parseProviderEntry({ id: 'groq', model: 'm', enabled: false })).toMatchObject({
		enabled: false
	});
});

test('the key name is namespaced per provider', () => {
	expect(providerKeyName('openai')).toBe('secret.ai.openai.key');
	expect(providerKeyName('custom')).toBe('secret.ai.custom.key');
});
