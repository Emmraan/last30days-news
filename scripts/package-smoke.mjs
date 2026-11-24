#!/usr/bin/env node
// The published tarball is the artifact users install. This proves the build,
// bin and dependency set survive packing instead of only working in the repo.
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, startServer, stopServer } from './server-harness.mjs';

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
// npm_execpath points at the pnpm that started this script, which is the only
// reliable way to find it on Windows. A bare `pnpm.cmd` is not spawnable
// without a shell, and a shell splits paths on spaces.
const pnpm = process.env.npm_execpath ?? (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
const tmp = mkdtempSync(join(tmpdir(), 'l30-package-'));
let server;

/** @param {string[]} args @returns {{ command: string, args: string[] }} */
function pnpmInvocation(args) {
	if (/\.(?:c?js|mjs)$/i.test(pnpm)) return { command: process.execPath, args: [pnpm, ...args] };
	return { command: pnpm, args };
}

/** @param {string} command @param {string[]} args @param {string} cwd */
function run(command, args, cwd) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: 'utf8',
		windowsHide: true,
		shell: process.platform === 'win32' && command.endsWith('.cmd')
	});
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(' ')} failed (${result.status})\n${result.error ?? ''}\n${result.stdout}\n${result.stderr}`
		);
	}
	return result.stdout;
}

try {
	const packDir = join(tmp, 'pack');
	mkdirSync(packDir);
	const pack = pnpmInvocation(['pack', '--pack-destination', packDir]);
	run(pack.command, pack.args, ROOT);
	const tarball = readdirSync(packDir).find((file) => file.endsWith('.tgz'));
	if (!tarball) throw new Error('pnpm pack produced no tarball');

	const listing = run('tar', ['-tzf', join(packDir, tarball)], tmp)
		.split(/\r?\n/)
		.filter(Boolean);
	const forbidden = [
		/(^|\/)options\.test\.mjs$/,
		/\.map$/,
		/(^|\/)src\//,
		/(^|\/)tests\//,
		/(^|\/)node_modules\//,
		/(^|\/)fixtures\//,
		/(^|\/)\.env(?:\.|$)/
	];
	const leaked = listing.filter((entry) => forbidden.some((pattern) => pattern.test(entry)));
	if (leaked.length) throw new Error(`tarball contains files it should not:\n${leaked.join('\n')}`);
	for (const required of [
		'package/bin/last30days.js',
		'package/bin/options.mjs',
		'package/build/handler.js',
		'package/build/index.js',
		'package/build/client/theme.js',
		'package/build/client/_app/version.json',
		'package/README.md',
		'package/LICENSE',
		'package/CHANGELOG.md'
	]) {
		if (!listing.includes(required)) throw new Error(`tarball is missing ${required}`);
	}

	const appDir = join(tmp, 'app');
	mkdirSync(appDir);
	writeFileSync(
		join(appDir, 'package.json'),
		JSON.stringify({ name: 'l30-package-smoke', private: true }, null, 2)
	);
	const add = pnpmInvocation(['add', join(packDir, tarball)]);
	run(add.command, add.args, appDir);

	const bin = join(appDir, 'node_modules', 'last30days-news', 'bin', 'last30days.js');
	if (!existsSync(bin)) throw new Error('the tarball has no bin/last30days.js');
	const version = run(process.execPath, [bin, '--version'], appDir).trim();
	if (version !== `last30days-news ${pkg.version}`)
		throw new Error(`installed --version printed ${JSON.stringify(version)}`);

	server = await startServer({
		cwd: appDir,
		script: 'node_modules/last30days-news/bin/last30days.js',
		dataDir: join(tmp, 'data')
	});
	const health = await fetch(`${server.url}/api/health`);
	const healthBody = await health.json();
	if (health.status !== 200 || healthBody.version !== pkg.version)
		throw new Error(`installed health returned ${health.status} ${JSON.stringify(healthBody)}`);

	const login = await fetch(`${server.url}/login`);
	const html = await login.text();
	if (login.status !== 200 || !html.includes('Sign in'))
		throw new Error(`installed login page returned ${login.status}`);

	// A deployed install must never accept the repository's default password
	// and must never expose reset, even when the request arrives from loopback.
	await stopServer(server.child);
	server = await startServer({
		cwd: appDir,
		script: 'node_modules/last30days-news/bin/last30days.js',
		dataDir: join(tmp, 'data-deployed'),
		env: { L30_DEPLOYED: '1', L30_INITIAL_PASSWORD: 'deploy-password-1' }
	});

	const deployedPage = await fetch(`${server.url}/login`);
	const deployedHtml = await deployedPage.text();
	if (deployedPage.status !== 200 || !deployedHtml.includes('Sign in'))
		throw new Error(`deployed login page returned ${deployedPage.status}`);
	if (deployedHtml.includes('First run:'))
		throw new Error('deployed login page still advertises the default password');

	const defaultLogin = await fetch(`${server.url}/api/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: server.url },
		body: JSON.stringify({ password: 'last30' })
	});
	if (defaultLogin.status !== 401)
		throw new Error(`deployed login accepted the default password (${defaultLogin.status})`);
	await defaultLogin.text();

	const deployedLogin = await fetch(`${server.url}/api/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: server.url },
		body: JSON.stringify({ password: 'deploy-password-1' })
	});
	const deployedBody = await deployedLogin.json();
	if (deployedLogin.status !== 200 || deployedBody.mustChangePassword !== false)
		throw new Error(
			`deployed login returned ${deployedLogin.status} ${JSON.stringify(deployedBody)}`
		);

	const reset = await fetch(`${server.url}/api/auth/reset`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: server.url },
		body: JSON.stringify({ confirm: 'reset', next: 'hacked-password' })
	});
	if (reset.status !== 403)
		throw new Error(`deployed reset returned ${reset.status} instead of 403`);
	await reset.text();

	console.log('[package] ok: pack, install, version, boot, health, login, deployed login');
} finally {
	await stopServer(server?.child);
	try {
		rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
	} catch {
		/* temp dir, OS cleans up */
	}
}
