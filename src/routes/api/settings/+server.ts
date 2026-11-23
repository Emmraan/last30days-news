import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { z } from 'zod';
import { apiError, readJson } from '#lib/server/api';
import {
	PROVIDER_IDS,
	PROVIDERS_KEY,
	parseProviderEntry,
	providerKeyName,
	type ProviderEntry
} from '#lib/server/ai/provider';
import { encryptSecret } from '#lib/server/auth/secret';
import { deleteSetting, getSetting, setSetting } from '#lib/server/settings';
import { THEME_COOKIE, readTheme } from '#lib/theme';

export const prerender = false;

const THEME_MAX_AGE = 60 * 60 * 24 * 365;

const body = z
	.object({
		theme: z.enum(['dark', 'light']).optional(),
		providers: z
			.array(
				z
					.object({
						id: z.enum(PROVIDER_IDS),
						model: z.string().trim().min(1).max(200),
						baseUrl: z.string().trim().max(2048).nullish(),
						enabled: z.boolean().optional()
					})
					.strict()
			)
			.max(32)
			.optional(),
		keys: z
			.array(
				z
					.object({
						id: z.enum(PROVIDER_IDS),
						key: z.string().trim().min(1).max(4096).nullable()
					})
					.strict()
			)
			.max(32)
			.optional()
	})
	.strict();

type ProviderView = ProviderEntry & { keyConfigured: boolean };

async function views(db: RequestEvent['locals']['db']): Promise<ProviderView[]> {
	const raw = await getSetting<unknown>(db, PROVIDERS_KEY);
	if (!Array.isArray(raw)) return [];
	const rows = await Promise.all(
		raw.map(async (entry) => {
			const provider = parseProviderEntry(entry);
			if (!provider) return null;
			const stored = await getSetting<string>(db, providerKeyName(provider.id));
			return { ...provider, keyConfigured: Boolean(stored) };
		})
	);
	return rows.filter((row): row is ProviderView => row !== null);
}

export async function GET({ locals, cookies }: RequestEvent) {
	if (!locals.sessionId) return apiError(401, 'unauthenticated', 'Sign in first.');
	return json({
		theme: readTheme(cookies.get(THEME_COOKIE)),
		ids: [...PROVIDER_IDS],
		providers: await views(locals.db)
	});
}

export async function PATCH({ request, locals, cookies, url }: RequestEvent) {
	if (!locals.sessionId) return apiError(401, 'unauthenticated', 'Sign in first.');

	const parsed = await readJson(request, body);
	if (!parsed.ok) return parsed.response;
	const { theme, providers, keys } = parsed.data;

	// Everything is validated before the first write: a rejected body must not
	// leave half of the provider list saved.
	const next: ProviderEntry[] = [];
	if (providers) {
		const seen = new Set<string>();
		for (const entry of providers) {
			if (seen.has(entry.id)) return apiError(400, 'validation', 'Duplicate provider.');
			seen.add(entry.id);
			const provider = parseProviderEntry({ ...entry, enabled: entry.enabled ?? true });
			if (!provider) return apiError(400, 'validation', 'Invalid provider settings.');
			next.push(provider);
		}
	}

	for (const entry of keys ?? []) {
		if (entry.key !== null && !locals.vaultKey)
			return apiError(409, 'ai_locked', 'Sign in again to unlock AI keys.');
	}

	if (providers) {
		const before = await views(locals.db);
		await setSetting(
			locals.db,
			PROVIDERS_KEY,
			providers.map(({ id, model, baseUrl, enabled }) => ({ id, model, baseUrl, enabled }))
		);
		// A key belongs to the endpoint it was entered for; pointing a provider
		// at a new host drops the key rather than forwarding the secret there.
		for (const provider of next) {
			const old = before.find((entry) => entry.id === provider.id);
			if (old?.keyConfigured && old.baseUrl !== provider.baseUrl)
				await deleteSetting(locals.db, providerKeyName(provider.id));
		}
	}

	for (const entry of keys ?? []) {
		const name = providerKeyName(entry.id);
		if (entry.key === null) await deleteSetting(locals.db, name);
		else await setSetting(locals.db, name, encryptSecret(locals.vaultKey!, entry.key));
	}

	if (theme) {
		cookies.set(THEME_COOKIE, theme, {
			path: '/',
			maxAge: THEME_MAX_AGE,
			sameSite: 'lax',
			secure: url.protocol === 'https:'
		});
	}

	return json({
		theme: theme ?? readTheme(cookies.get(THEME_COOKIE)),
		ids: [...PROVIDER_IDS],
		providers: await views(locals.db)
	});
}
