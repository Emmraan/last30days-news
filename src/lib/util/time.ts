/** S13 dashboard presets. The page computes the window from the client clock. */
export const PRESETS = ['24h', '7d', '30d'] as const;

export type Preset = (typeof PRESETS)[number];

export const PRESET_LABEL: Record<Preset, string> = {
	'24h': '24 hours',
	'7d': '7 days',
	'30d': '30 days'
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const SPAN: Record<Preset, number> = {
	'24h': DAY,
	'7d': 7 * DAY,
	'30d': 30 * DAY
};

export type TimeRange = { from: number; to: number };

export function presetRange(preset: Preset, now: number): TimeRange {
	return { from: now - SPAN[preset], to: now };
}
