import { createRequire } from 'node:module';
import { afterEach, describe, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const configPath = require.resolve('../.releaserc.cjs');

function loadConfig() {
	delete require.cache[configPath];
	return require(configPath);
}

/** @param {{ plugins: Array<string | [string, Record<string, unknown>]> }} config */
function npmPlugin(config) {
	return config.plugins.find(
		(plugin) => Array.isArray(plugin) && plugin[0] === '@semantic-release/npm'
	);
}

afterEach(() => vi.unstubAllEnvs());

describe('release config', () => {
	test('prepares the package but skips npm without NPM_TOKEN', () => {
		vi.stubEnv('NPM_TOKEN', '');
		const config = loadConfig();
		expect(config.branches).toEqual(['main']);
		expect(config.tagFormat).toBe('v${version}');
		expect(config.plugins).toContain('@semantic-release/github');
		expect(npmPlugin(config)).toEqual([
			'@semantic-release/npm',
			{ npmPublish: false, provenance: false }
		]);
	});

	test('publishes when NPM_TOKEN is present', () => {
		vi.stubEnv('NPM_TOKEN', 'test-token');
		const config = loadConfig();
		expect(npmPlugin(config)).toEqual([
			'@semantic-release/npm',
			{ npmPublish: true, provenance: true }
		]);
	});
});
