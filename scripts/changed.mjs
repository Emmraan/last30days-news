#!/usr/bin/env node
// Dev-loop speed: only re-check files touched since main. Full gates still run
// in CI; this exists so a phase in progress does not pay for the whole repo.
import { execSync } from 'node:child_process';

const mode = process.argv[2];
const base = process.env.L30_BASE_BRANCH ?? 'main';
const CODE = /\.(ts|js|mjs|svelte|css)$/;

/** @param {...string} args */
const git = (...args) => execSync(`git ${args.join(' ')}`, { encoding: 'utf8' }).trim();

/** @returns {string[]} */
function changed() {
	/** @type {Set<string>} */
	const files = new Set();
	/** @param {string} out */
	const add = (out) =>
		out
			.split('\n')
			.filter(Boolean)
			.forEach((f) => files.add(f));
	try {
		add(git('diff', '--name-only', `${base}...HEAD`));
	} catch {
		// No main yet (fresh repo) — fall through to the working tree only.
	}
	add(git('diff', '--name-only', 'HEAD'));
	add(git('diff', '--name-only', '--cached'));
	add(git('ls-files', '--others', '--exclude-standard'));
	return [...files].filter((f) => CODE.test(f));
}

const files = changed();
if (files.length === 0) {
	console.log(`[changed] nothing changed against ${base}`);
	process.exit(0);
}
console.log(`[changed] ${files.length} file(s):\n  ${files.join('\n  ')}`);

/** @param {string} cmd */
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const quoted = files.map((f) => `"${f}"`).join(' ');

if (mode === '--lint') {
	run(`npx eslint ${quoted}`);
} else if (mode === '--typecheck') {
	run('npx svelte-kit sync');
	run(`npx svelte-check --tsconfig ./tsconfig.json ${quoted}`);
} else if (mode === '--test') {
	// `related` runs only the test files that import something we touched.
	run(`npx vitest related --run ${quoted}`);
} else {
	console.error('usage: changed.mjs --lint|--typecheck|--test');
	process.exit(2);
}
