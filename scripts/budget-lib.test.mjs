import { describe, expect, it } from 'vitest';
import {
	checkBudget,
	fontFiles,
	formatBytes,
	hasFontFace,
	parseAssetUrls,
	percentile
} from './budget-lib.mjs';

describe('parseAssetUrls', () => {
	it('collects unique local scripts and stylesheets', () => {
		const html = `
			<script type="module" src="/_app/immutable/entry/start.js?v=1"></script>
			<link rel="stylesheet" href="/_app/immutable/assets/0.css">
			<link rel="modulepreload" href="/_app/immutable/nodes/1.js">
			<script src="/_app/immutable/entry/start.js"></script>
			<script src="/theme.js"></script>
			<link rel="icon" href="/favicon.svg">
			<a href="/login">Sign in</a>
			<script src="https://cdn.example.com/x.js"></script>
			<link rel="stylesheet" href="//cdn.example.com/x.css">
			<img src="data:image/png;base64,aa">
		`;
		expect(parseAssetUrls(html)).toEqual([
			'/_app/immutable/entry/start.js',
			'/_app/immutable/assets/0.css',
			'/_app/immutable/nodes/1.js',
			'/theme.js'
		]);
	});

	it('resolves the relative paths SvelteKit renders against the page', () => {
		const html = `
			<link href="./_app/immutable/assets/0.css" rel="stylesheet">
			<link href="./_app/immutable/entry/start.js" rel="modulepreload">
		`;
		expect(parseAssetUrls(html, '/login')).toEqual([
			'/_app/immutable/assets/0.css',
			'/_app/immutable/entry/start.js'
		]);
	});

	it('ignores quotes that are not attributes and empty paths', () => {
		expect(parseAssetUrls('<p data-href="/not-an-asset.js">nope</p><script src=""></script>')).toEqual(
			[]
		);
	});
});

describe('percentile', () => {
	it('uses nearest-rank on sorted values', () => {
		expect(percentile([], 95)).toBeNull();
		expect(percentile([1], 95)).toBe(1);
		expect(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(95);
		expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
	});

	it('clamps the percentile to 1..100', () => {
		expect(percentile([1, 2, 3], 0)).toBe(1);
		expect(percentile([1, 2, 3], 101)).toBe(3);
	});
});

describe('checkBudget', () => {
	it('passes at the limit and fails one byte over', () => {
		expect(checkBudget('js', 100, 100).ok).toBe(true);
		expect(checkBudget('js', 101, 100).ok).toBe(false);
	});
});

describe('fonts', () => {
	it('finds font files by extension', () => {
		expect(
			fontFiles([
				'font.woff2',
				'font.woff',
				'font.ttf',
				'font.otf',
				'font.eot',
				'app.css',
				'app.js'
			])
		).toEqual(['font.woff2', 'font.woff', 'font.ttf', 'font.otf', 'font.eot']);
	});

	it('detects a font-face rule through whitespace', () => {
		expect(hasFontFace('@font-face { font-family: x; }')).toBe(true);
		expect(hasFontFace('@media screen { @font-face{} }')).toBe(true);
		expect(hasFontFace('body { font-family: system-ui; }')).toBe(false);
	});
});

describe('formatBytes', () => {
	it('prints bytes, kilobytes and megabytes', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
	});
});
