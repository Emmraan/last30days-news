#!/usr/bin/env node
// A deployed URL gets a real HTTP pass, but this catches the failure modes a
// package or adapter change introduces before anything leaves the laptop.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cookieHeader, ROOT, startServer, stopServer } from './server-harness.mjs';

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const dataDir = mkdtempSync(join(tmpdir(), 'l30-smoke-'));
let server;

try {
	if (!existsSync(join(ROOT, 'build', 'handler.js'))) {
		throw new Error('build/handler.js is missing. Run "pnpm build" first.');
	}

	server = await startServer({ dataDir });

	const health = await fetch(`${server.url}/api/health`);
	const body = await health.json();
	if (health.status !== 200 || body.ok !== true || body.version !== pkg.version) {
		throw new Error(`health returned ${health.status} ${JSON.stringify(body)}`);
	}

	const loginPage = await fetch(`${server.url}/login`);
	const loginHtml = await loginPage.text();
	if (loginPage.status !== 200 || !loginHtml.includes('Sign in')) {
		throw new Error(`login page returned ${loginPage.status}`);
	}
	if (!loginHtml.includes('First run:')) throw new Error('first-run hint is missing');

	const login = await fetch(`${server.url}/api/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: server.url },
		body: JSON.stringify({ password: 'last30' })
	});
	const loginBody = await login.json();
	if (login.status !== 200 || loginBody.mustChangePassword !== true) {
		throw new Error(`first-run login returned ${login.status} ${JSON.stringify(loginBody)}`);
	}
	const cookie = cookieHeader(login);
	if (!cookie) throw new Error('first-run login set no cookies');

	const app = await fetch(`${server.url}/app`, { headers: { cookie } });
	if (app.status !== 200) throw new Error(`app shell returned ${app.status}`);
	await app.text();

	const session = await fetch(`${server.url}/api/auth/session`, { headers: { cookie } });
	const sessionBody = await session.json();
	if (session.status !== 200 || sessionBody.authenticated !== true) {
		throw new Error(`session returned ${session.status} ${JSON.stringify(sessionBody)}`);
	}

	console.log('[smoke] ok: health, login page, first-run login, app shell, session');
} finally {
	await stopServer(server?.child);
	try {
		rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
	} catch {
		/* temp dir, OS cleans up */
	}
}
