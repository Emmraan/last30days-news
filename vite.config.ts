import tailwindcss from '@tailwindcss/vite';
import adapterVercel from '@sveltejs/adapter-vercel';
import adapterNode from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// One codebase, two targets (§S19). VERCEL=1 is set by the platform itself.
const adapter = process.env.VERCEL === '1' ? adapterVercel() : adapterNode();

export default defineConfig({
	plugins: [tailwindcss(), sveltekit({ adapter })],
	test: {
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		environment: 'node'
	}
});
