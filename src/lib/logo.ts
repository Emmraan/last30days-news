/**
 * Radar sweep, the locked S11 mark. It is inlined in the app and encoded into
 * the favicon so the browser tab and the shell can never drift apart.
 */
export const LOGO_GLYPH = [
	'<circle cx="12" cy="12" r="8.7" stroke="currentColor" stroke-width="1.5" fill="none" opacity=".3"/>',
	'<circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5" fill="none" opacity=".5"/>',
	'<path d="M12 12 12 3.3A8.7 8.7 0 0 1 20.7 12Z" fill="currentColor" opacity=".92"/>',
	'<circle cx="12" cy="12" r="1.9" fill="currentColor"/>'
].join('');

const FAVICON_SVG = [
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">',
	'<rect width="28" height="28" rx="9" fill="#0f6cbd"/>',
	'<g transform="translate(4.5 4.5) scale(0.7916667)" color="#ffffff">',
	LOGO_GLYPH,
	'</g></svg>'
].join('');

export const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
