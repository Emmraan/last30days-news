import tailwindcss from '@tailwindcss/vite';
import adapterVercel from '@sveltejs/adapter-vercel';
import adapterNode from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * File values only fill gaps. A platform or shell value wins, so a deployment
 * never loses its real credentials to a checked-in example.
 * @param {NodeJS.ProcessEnv} target
 * @param {Record<string, string | undefined>} source
 */
export function mergeEnv(target: NodeJS.ProcessEnv, source: Record<string, string | undefined>) {
	for (const [key, value] of Object.entries(source)) {
		if (value !== undefined && target[key] === undefined) target[key] = value;
	}
}

export default defineConfig(({ mode }) => {
	// Vite exposes .env files to import.meta.env, but the server reads
	// process.env directly. Tests skip this so a developer's .env.development
	// cannot point the suite at a real database.
	if (mode !== 'test') mergeEnv(process.env, loadEnv(mode, process.cwd(), ''));

	// One codebase, two targets (§S19). VERCEL=1 is set by the platform itself.
	const adapter = process.env.VERCEL === '1' ? adapterVercel() : adapterNode();

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				adapter,
				// SvelteKit hashes or nonces the inline bootstrap script it emits;
				// without this the static CSP header blocks hydration entirely.
				csp: {
					mode: 'auto',
					directives: {
						'default-src': ['self'],
						'base-uri': ['none'],
						'form-action': ['self'],
						'frame-ancestors': ['none'],
						'object-src': ['none'],
						'script-src': ['self'],
						// SvelteKit's screen-reader announcer is inserted at runtime with
						// one fixed inline style; allow exactly that style, not inline CSS.
						'style-src': [
							'self',
							'unsafe-hashes',
							'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo='
						],
						'img-src': ['self', 'data:']
					}
				}
			})
		],
		// A cold install pays module resolution for ~450 drizzle files on every
		// boot. Bundling it once turns that into a single parse and keeps §S17's
		// 800 ms cold boot reachable on Windows, where resolution is slowest.
		ssr: {
			noExternal: ['drizzle-orm']
		},
		test: {
			include: [
				'src/**/*.test.ts',
				'tests/**/*.test.ts',
				'bin/**/*.test.mjs',
				'scripts/**/*.test.mjs'
			],
			environment: 'node'
		}
	};
});
