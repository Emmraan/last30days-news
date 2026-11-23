import { expect, test } from 'vitest';
import { PRESETS, presetRange, type Preset } from '#lib/util/time';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

test.each([
	['24h', DAY],
	['7d', 7 * DAY],
	['30d', 30 * DAY]
] satisfies [Preset, number][])('%s is a rolling window ending at now', (preset, span) => {
	expect(presetRange(preset, NOW)).toEqual({ from: NOW - span, to: NOW });
});

test('the three presets match the product order', () => {
	expect(PRESETS).toEqual(['24h', '7d', '30d']);
});

test('a preset window is inclusive of its boundaries', () => {
	const { from, to } = presetRange('24h', NOW);
	expect(from).toBe(NOW - DAY);
	expect(to).toBe(NOW);
	expect(from).toBeLessThan(to);
});

test('the window moves with the caller clock', () => {
	const later = NOW + 5 * HOUR;
	expect(presetRange('7d', later)).toEqual({ from: later - 7 * DAY, to: later });
});
