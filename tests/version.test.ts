import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '#lib/version';

describe('version', () => {
	it('is a semver string', () => {
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it('matches the version in package.json', () => {
		const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
		expect(VERSION).toBe(pkg.version);
	});
});
