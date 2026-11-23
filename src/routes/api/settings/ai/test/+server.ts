import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { generateText } from 'ai';
import { z } from 'zod';
import { apiError, readJson } from '#lib/server/api';
import {
	PROVIDER_IDS,
	buildModel,
	getConfiguredProvider,
	parseProviderEntry,
	providerKeyName,
	safeBaseUrl
} from '#lib/server/ai/provider';
import { getSetting } from '#lib/server/settings';

export const prerender = false;

const body = z
	.object({
		provider: z.enum(PROVIDER_IDS),
		model: z.string().trim().min(1).max(200),
		baseUrl: z.string().trim().max(2048).optional(),
		apiKey: z.string().trim().min(1).max(4096).optional()
	})
	.strict();

export async function POST({ request, locals }: RequestEvent) {
	const parsed = await readJson(request, body);
	if (!parsed.ok) return parsed.response;

	const configured = await getConfiguredProvider(locals.db, parsed.data.provider);
	const provider = parseProviderEntry({
		id: parsed.data.provider,
		enabled: true,
		model: parsed.data.model,
		baseUrl: parsed.data.baseUrl ?? configured?.baseUrl
	});
	if (!provider) return apiError(400, 'validation', 'Invalid provider settings.');

	// A stored key must only travel to the endpoint it was configured for.
	// Without this, a session could point the test at its own host and read
	// the decrypted key from the request it receives.
	const storedKey = await getSetting<string>(locals.db, providerKeyName(provider.id));
	if (!parsed.data.apiKey && storedKey) {
		const safe = safeBaseUrl(provider.id, configured);
		if (provider.baseUrl !== safe)
			return apiError(400, 'validation', 'Enter the key for a new endpoint.');
	}

	const built = await buildModel(locals.db, provider, locals.vaultKey, parsed.data.apiKey);
	if (!built.ok) {
		if (built.code === 'ai_locked')
			return apiError(409, 'ai_locked', 'Sign in again to unlock AI keys.');
		return apiError(409, 'ai_not_configured', 'No API key is configured for this provider.');
	}

	try {
		await generateText({
			model: built.model,
			prompt: 'Reply with the single word OK.',
			temperature: 0,
			maxOutputTokens: 5,
			maxRetries: 0,
			abortSignal: AbortSignal.timeout(30_000)
		});
	} catch {
		// The upstream message may contain a key or a URL; the client gets a
		// fixed string and nothing from the error is logged.
		return apiError(502, 'ai_test_failed', 'The provider did not answer.');
	}

	return json({ ok: true, model: provider.model });
}
