import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { mdsvex } from 'mdsvex';
import { defineConfig, loadEnv } from 'vite';

/** The install commands point back at the deployed landing site. */
function resolveAppUrl(mode: string) {
	const env = loadEnv(mode, process.cwd(), '');
	const raw = process.env.APP_URL || env.APP_URL || 'http://localhost:5174';
	const url = raw.replace(/\/+$/, '');
	if (!/^https?:\/\//.test(url)) {
		throw new Error('APP_URL must start with http:// or https://');
	}
	if (process.env.VERCEL && !process.env.APP_URL && !env.APP_URL) {
		throw new Error('Set APP_URL to the public landing URL before deploying to Vercel.');
	}
	return url;
}

// Static showcase site: prerendered, no server, no hydration (section 6.8).
export default defineConfig(({ mode }) => ({
	define: {
		__APP_URL__: JSON.stringify(resolveAppUrl(mode))
	},
	plugins: [
		sveltekit({
			preprocess: mdsvex({ extensions: ['.svx'] }),
			extensions: ['.svelte', '.svx'],
			adapter: adapter({ strict: true }),
			// Nav anchors are written before the sections they point at, so prerendering
			// would otherwise fail on a link whose id does not exist yet.
			prerender: { handleMissingId: () => undefined }
		})
	]
}));
