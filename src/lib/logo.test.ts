import { expect, test } from 'vitest';
import { FAVICON_DATA_URI, LOGO_GLYPH } from './logo';

test('the shared glyph is the four locked radar shapes', () => {
	expect(LOGO_GLYPH.match(/<circle/g)).toHaveLength(3);
	expect(LOGO_GLYPH.match(/<path/g)).toHaveLength(1);
	expect(LOGO_GLYPH).toContain('r="8.7"');
	expect(LOGO_GLYPH).toContain('r="5"');
	expect(LOGO_GLYPH).toContain('M12 12 12 3.3A8.7 8.7 0 0 1 20.7 12Z');
	expect(LOGO_GLYPH).toContain('r="1.9"');
});

test('the glyph carries no script or event handler', () => {
	expect(LOGO_GLYPH).not.toMatch(/<script|on[a-z]+\s*=/i);
});

test('the favicon uses the light-mode accent tile and white glyph', () => {
	expect(FAVICON_DATA_URI.startsWith('data:image/svg+xml,')).toBe(true);
	const svg = decodeURIComponent(FAVICON_DATA_URI.slice('data:image/svg+xml,'.length));
	expect(svg.startsWith('<svg')).toBe(true);
	expect(svg).toContain('viewBox="0 0 28 28"');
	expect(svg).toContain('rx="9"');
	expect(svg).toContain('#0f6cbd');
	expect(svg).toContain('#ffffff');
	expect(svg).not.toContain('#60cdff');
	expect(svg).toContain('M12 12 12 3.3A8.7 8.7 0 0 1 20.7 12Z');
	expect(svg).not.toContain('<script');
});
