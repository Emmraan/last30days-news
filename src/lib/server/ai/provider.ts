import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type { Db } from '../db';
import { decryptSecret } from '../auth/secret';
import { getSetting } from '../settings';

export const PROVIDERS_KEY = 'ai.providers';

export const PROVIDER_IDS = [
	'openai',
	'anthropic',
	'google',
	'openrouter',
	'groq',
	'deepseek',
	'ollama',
	'lmstudio',
	'custom'
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const DEFAULT_BASE_URLS: Record<Exclude<ProviderId, 'custom'>, string> = {
	openai: 'https://api.openai.com/v1',
	anthropic: 'https://api.anthropic.com/v1',
	google: 'https://generativelanguage.googleapis.com/v1beta',
	openrouter: 'https://openrouter.ai/api/v1',
	groq: 'https://api.groq.com/openai/v1',
	deepseek: 'https://api.deepseek.com/v1',
	ollama: 'http://127.0.0.1:11434/v1',
	lmstudio: 'http://127.0.0.1:1234/v1'
};

const REQUIRES_KEY: Record<ProviderId, boolean> = {
	openai: true,
	anthropic: true,
	google: true,
	openrouter: true,
	groq: true,
	deepseek: true,
	ollama: false,
	lmstudio: false,
	custom: false
};

export type ProviderEntry = {
	id: ProviderId;
	enabled: boolean;
	model: string;
	baseUrl: string;
	cacheKey: string;
	requiresKey: boolean;
};

const entrySchema = z
	.object({
		id: z.enum(PROVIDER_IDS),
		enabled: z.boolean().default(true),
		model: z.string().trim().min(1).max(200),
		baseUrl: z.string().trim().max(2048).nullish()
	})
	.strict();

function isHttp(value: string): boolean {
	try {
		const url = new URL(value);
		if (url.username || url.password) return false;
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

export function cacheKeyFor(id: ProviderId, model: string): string {
	return `${id}:${model}`;
}

export function providerKeyName(id: ProviderId): string {
	return `secret.ai.${id}.key`;
}

/** One bad entry must not hide a good one, so the array is parsed item by item. */
export function parseProviderEntry(input: unknown): ProviderEntry | null {
	const parsed = entrySchema.safeParse(input);
	if (!parsed.success) return null;

	const { id, enabled, model } = parsed.data;
	const override = parsed.data.baseUrl?.trim() || null;
	if (override && !isHttp(override)) return null;

	const baseUrl = override ?? (id === 'custom' ? null : DEFAULT_BASE_URLS[id]);
	if (!baseUrl) return null;

	return {
		id,
		enabled,
		model,
		baseUrl,
		cacheKey: cacheKeyFor(id, model),
		requiresKey: REQUIRES_KEY[id]
	};
}

export async function listConfiguredProviders(db: Db): Promise<ProviderEntry[]> {
	const raw = await getSetting<unknown>(db, PROVIDERS_KEY);
	if (!Array.isArray(raw)) return [];
	return raw
		.map(parseProviderEntry)
		.filter((provider): provider is ProviderEntry => provider !== null);
}

export async function getConfiguredProvider(
	db: Db,
	id: ProviderId
): Promise<ProviderEntry | null> {
	return (await listConfiguredProviders(db)).find((provider) => provider.id === id) ?? null;
}

/** The endpoint a stored key was configured for; null when only the request names one. */
export function safeBaseUrl(id: ProviderId, configured: ProviderEntry | null): string | null {
	if (configured) return configured.baseUrl;
	return id === 'custom' ? null : DEFAULT_BASE_URLS[id];
}

export async function getActiveProvider(db: Db): Promise<ProviderEntry | null> {
	const providers = await listConfiguredProviders(db);
	return providers.find((provider) => provider.enabled) ?? null;
}

export type BuildModelResult =
	| { ok: true; model: LanguageModel }
	| { ok: false; code: 'ai_not_configured' | 'ai_locked' };

function makeModel(provider: ProviderEntry, apiKey: string | undefined): LanguageModel {
	switch (provider.id) {
		case 'openai':
			return createOpenAI({ apiKey, baseURL: provider.baseUrl }).chat(provider.model);
		case 'anthropic':
			return createAnthropic({ apiKey, baseURL: provider.baseUrl }).languageModel(provider.model);
		case 'google':
			return createGoogle({ apiKey, baseURL: provider.baseUrl }).languageModel(provider.model);
		default:
			return createOpenAICompatible({
				name: provider.id,
				baseURL: provider.baseUrl,
				apiKey
			}).chatModel(provider.model);
	}
}

/**
 * The key is decrypted only when a model is actually needed (§S9). A missing
 * vault key is a locked vault, not a missing key: the two get different codes
 * so the UI can tell the user to sign in again.
 */
export async function buildModel(
	db: Db,
	provider: ProviderEntry,
	vaultKey?: Buffer,
	apiKeyOverride?: string
): Promise<BuildModelResult> {
	let apiKey = apiKeyOverride?.trim() || undefined;

	if (!apiKey) {
		const stored = await getSetting<string>(db, providerKeyName(provider.id));
		if (stored) {
			if (!vaultKey) return { ok: false, code: 'ai_locked' };
			try {
				apiKey = decryptSecret(vaultKey, stored);
			} catch {
				return { ok: false, code: 'ai_locked' };
			}
		} else if (provider.requiresKey) {
			return { ok: false, code: 'ai_not_configured' };
		}
	}

	return { ok: true, model: makeModel(provider, apiKey) };
}
