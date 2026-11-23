import tailwindcss from '@tailwindcss/vite';
import adapterVercel from '@sveltejs/adapter-vercel';
import adapterNode from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// One codebase, two targets (§S19). VERCEL=1 is set by the platform itself.
const adapter = process.env.VERCEL === '1' ? adapterVercel() : adapterNode();

export default defineConfig({
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
	test: {
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		environment: 'node'
	}
});
