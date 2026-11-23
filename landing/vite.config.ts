import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Static showcase site: prerendered, no server, no hydration (§6.8).
export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({ strict: true }),
			// Nav anchors are written before the sections they point at, so prerendering
			// would otherwise fail on a link whose id does not exist yet.
			prerender: { handleMissingId: () => undefined }
		})
	]
});
