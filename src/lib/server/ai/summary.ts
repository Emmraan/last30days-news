import { generateText, type LanguageModel } from 'ai';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db';
import { item, itemSource, source, summary } from '../db/schema';
import type { Summary } from '#lib/types';
import { log } from '../log';
import { SUMMARY_SYSTEM_PROMPT, buildArticlePrompt } from './prompt';

const SUMMARY_TIMEOUT_MS = 60_000;
const SUMMARY_MAX_TOKENS = 700;

const plain = (max: number) =>
	z
		.string()
		.trim()
		.min(1)
		.max(max)
		.refine((value) => !/[<>]/.test(value), 'Plain text only.')
		.refine(
			(value) =>
				!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u202A-\u202E\u2066-\u2069]/.test(value),
			'No control characters.'
		);

const outputSchema = z
	.object({
		summary: plain(480)
			.refine((value) => !/(?:https?:\/\/|www\.)/i.test(value), 'No URLs.')
			.refine((value) => !/\*\*|`|\[[^\]]*\]\([^)]*\)/.test(value), 'No markdown.'),
		key_points: z.array(plain(200)).min(2).max(4),
		why_it_matters: plain(180).optional()
	})
	.strict();

export type SummaryOutput = z.infer<typeof outputSchema>;
export type ParseResult =
	| { ok: true; data: SummaryOutput }
	| { ok: false; error: string };

function unfence(text: string): string {
	const trimmed = text.trim();
	const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
	return fenced ? fenced[1] : trimmed;
}

/** Issues carry no article text: the repair prompt must not echo untrusted input. */
function describe(error: z.ZodError): string {
	return error.issues
		.slice(0, 5)
		.map((issue) => `${issue.path.join('.') || 'reply'}: ${issue.message}`)
		.join('; ')
		.slice(0, 400);
}

export function parseSummaryOutput(text: string): ParseResult {
	let value: unknown;
	try {
		value = JSON.parse(unfence(text));
	} catch {
		return { ok: false, error: 'The reply was not valid JSON.' };
	}
	const parsed = outputSchema.safeParse(value);
	if (!parsed.success) return { ok: false, error: describe(parsed.error) };
	return { ok: true, data: parsed.data };
}

type CachedRow = {
	model: string;
	body: string;
	keyPoints: string[];
	whyItMatters: string | null;
	citations: { n: number; source_id: string; url: string }[];
	createdAt: number;
};

export async function getCachedSummary(
	db: Db,
	itemId: string,
	cacheKey: string
): Promise<Summary | null> {
	const row: CachedRow | undefined = await db
		.select({
			model: summary.model,
			body: summary.body,
			keyPoints: summary.keyPoints,
			whyItMatters: summary.whyItMatters,
			citations: summary.citations,
			createdAt: summary.createdAt
		})
		.from(summary)
		.where(and(eq(summary.itemId, itemId), eq(summary.model, cacheKey)))
		.get();
	return row ?? null;
}

export type SummarizeInput = {
	db: Db;
	model: LanguageModel;
	itemId: string;
	cacheKey: string;
};

export type SummarizeResult =
	| { ok: true; summary: Summary }
	| { ok: false; code: 'not_found' | 'ai_failed' | 'ai_invalid_output' };

type ModelReply = { ok: true; text: string; tokensIn: number; tokensOut: number } | { ok: false };

async function callModel(
	model: LanguageModel,
	prompt: string,
	repair?: { previous: string; error: string }
): Promise<ModelReply> {
	const messages = repair
		? [
				{ role: 'user' as const, content: prompt },
				{ role: 'assistant' as const, content: repair.previous.slice(0, 4000) },
				{
					role: 'user' as const,
					content: `That reply was not valid: ${repair.error}. Reply again with only the corrected JSON object.`
				}
			]
		: [{ role: 'user' as const, content: prompt }];
	try {
		const result = await generateText({
			model,
			system: SUMMARY_SYSTEM_PROMPT,
			messages,
			temperature: 0.2,
			maxOutputTokens: SUMMARY_MAX_TOKENS,
			maxRetries: 0,
			abortSignal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS)
		});
		return {
			ok: true,
			text: result.text,
			tokensIn: result.usage.inputTokens ?? 0,
			tokensOut: result.usage.outputTokens ?? 0
		};
	} catch {
		return { ok: false };
	}
}

export async function summarizeItem({
	db,
	model,
	itemId,
	cacheKey
}: SummarizeInput): Promise<SummarizeResult> {
	const target = await db
		.select({
			title: item.title,
			publishedAt: item.publishedAt,
			excerpt: item.excerpt
		})
		.from(item)
		.where(eq(item.id, itemId))
		.get();
	if (!target) return { ok: false, code: 'not_found' };

	const sources = await db
		.select({ id: source.id, name: source.name, url: itemSource.url })
		.from(itemSource)
		.innerJoin(source, eq(itemSource.sourceId, source.id))
		.where(eq(itemSource.itemId, itemId))
		.orderBy(asc(source.name))
		.all();

	const prompt = buildArticlePrompt({
		title: target.title,
		sourceName: sources[0]?.name ?? 'Unknown source',
		publishedAt: target.publishedAt,
		excerpt: target.excerpt ?? target.title
	});
	const started = Date.now();

	const first = await callModel(model, prompt);
	if (!first.ok) {
		log('warn', 'summary.gen', {
			item_id: itemId,
			model: cacheKey,
			ok: false,
			error_code: 'ai_failed',
			ms: Date.now() - started
		});
		return { ok: false, code: 'ai_failed' };
	}

	let tokensIn = first.tokensIn;
	let tokensOut = first.tokensOut;
	let parsed = parseSummaryOutput(first.text);

	if (!parsed.ok) {
		const repaired = await callModel(model, prompt, {
			previous: first.text,
			error: parsed.error
		});
		if (!repaired.ok) {
			log('warn', 'summary.gen', {
				item_id: itemId,
				model: cacheKey,
				ok: false,
				error_code: 'ai_failed',
				ms: Date.now() - started
			});
			return { ok: false, code: 'ai_failed' };
		}
		tokensIn += repaired.tokensIn;
		tokensOut += repaired.tokensOut;
		parsed = parseSummaryOutput(repaired.text);
	}

	if (!parsed.ok) {
		log('warn', 'summary.gen', {
			item_id: itemId,
			model: cacheKey,
			ok: false,
			error_code: 'ai_invalid_output',
			ms: Date.now() - started
		});
		return { ok: false, code: 'ai_invalid_output' };
	}

	const createdAt = Date.now();
	const citations = sources.map((entry, index) => ({
		n: index + 1,
		source_id: entry.id,
		url: entry.url
	}));
	const keyPoints = parsed.data.key_points;
	const whyItMatters = parsed.data.why_it_matters ?? null;

	await db
		.insert(summary)
		.values({
			itemId,
			model: cacheKey,
			body: parsed.data.summary,
			keyPoints,
			whyItMatters,
			citations,
			createdAt,
			tokensIn,
			tokensOut
		})
		.onConflictDoUpdate({
			target: [summary.itemId, summary.model],
			set: {
				body: parsed.data.summary,
				keyPoints,
				whyItMatters,
				citations,
				createdAt,
				tokensIn,
				tokensOut
			}
		});

	log('info', 'summary.gen', {
		item_id: itemId,
		model: cacheKey,
		ok: true,
		// The log scrubber drops any key containing "token"; these are counts,
		// not credentials, so they use names the scrubber leaves alone.
		usage_in: tokensIn,
		usage_out: tokensOut,
		ms: Date.now() - started
	});

	return {
		ok: true,
		summary: {
			model: cacheKey,
			body: parsed.data.summary,
			keyPoints,
			whyItMatters,
			citations,
			createdAt
		}
	};
}
