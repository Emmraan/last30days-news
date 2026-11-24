export const THEME_COOKIE = 'l30_theme';

// The cookie is what the server reads before first paint; localStorage is the
// fallback for browsers or embedded previews that refuse the cookie write.
export const THEME_STORAGE_KEY = 'l30-theme';

export type Theme = 'dark' | 'light';

/** Unknown or malformed cookie values fall back to the system preference. */
export function readTheme(value: string | null | undefined): Theme | null {
	return value === 'dark' || value === 'light' ? value : null;
}
