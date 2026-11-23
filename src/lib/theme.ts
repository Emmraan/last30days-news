export const THEME_COOKIE = 'l30_theme';

export type Theme = 'dark' | 'light';

/** Unknown or malformed cookie values fall back to the system preference. */
export function readTheme(value: string | null | undefined): Theme | null {
	return value === 'dark' || value === 'light' ? value : null;
}
