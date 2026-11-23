import { z } from 'zod';

const keyword = z.string().trim().min(1).max(200);
const sourceId = z.string().trim().min(1);
const name = z.string().trim().min(1).max(40);
const matchMode = z.enum(['keywords', 'ai', 'both']);
const createPrompt = z
	.string()
	.trim()
	.nullable()
	.optional()
	.transform((value) => (value ? value : null));
const patchPrompt = z
	.string()
	.trim()
	.nullable()
	.optional()
	.transform((value) => (value === undefined ? undefined : value ? value : null));

export const createCategoryBody = z
	.object({
		name,
		matchMode: matchMode.default('keywords'),
		keywords: z.array(keyword).default([]),
		prompt: createPrompt,
		aiThreshold: z.number().min(0).max(1).default(0.6),
		sourceIds: z.array(sourceId).default([])
	})
	.strict();

export const patchCategoryBody = z
	.object({
		name: name.optional(),
		matchMode: matchMode.optional(),
		keywords: z.array(keyword).optional(),
		prompt: patchPrompt,
		aiThreshold: z.number().min(0).max(1).optional(),
		sourceIds: z.array(sourceId).optional()
	})
	.strict();

export function cleanKeywords(values: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		const key = value.toLowerCase();
		if (!value || seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

export function cleanSourceIds(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
