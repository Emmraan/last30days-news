import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** @returns {Promise<number>} */
export function freePort() {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.unref();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			server.close(() => resolve(port));
		});
	});
}

/**
 * @param {{ dataDir: string, cwd?: string, script?: string, env?: Record<string, string | undefined>, args?: string[], timeoutMs?: number }} options
 */
export async function startServer({
	dataDir,
	cwd = ROOT,
	script = 'bin/last30days.js',
	env = {},
	args = [],
	timeoutMs = 15000
}) {
	const port = await freePort();
	const startedAt = performance.now();
	const child = spawn(process.execPath, [join(cwd, script), ...args], {
		cwd,
		env: {
			...process.env,
			...env,
			PORT: String(port),
			HOST: '127.0.0.1',
			CI: '1',
			L30_DATA_DIR: dataDir
		},
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true
	});

	let output = '';
	child.stdout.on('data', (chunk) => (output += chunk));
	child.stderr.on('data', (chunk) => (output += chunk));

	const url = `http://127.0.0.1:${port}`;
	try {
		await waitForHealth(url, child, timeoutMs);
	} catch (err) {
		await stopServer(child);
		throw new Error(`${err instanceof Error ? err.message : String(err)}\n${output}`);
	}

	return {
		url,
		port,
		child,
		bootMs: performance.now() - startedAt,
		output: () => output
	};
}

/**
 * @param {string} url
 * @param {import('node:child_process').ChildProcess} child
 * @param {number} [timeoutMs]
 */
export async function waitForHealth(url, child, timeoutMs = 15000) {
	const deadline = Date.now() + timeoutMs;
	let lastError = 'no response';
	while (Date.now() < deadline) {
		if (child.exitCode !== null)
			throw new Error(`server exited with code ${child.exitCode} before health check`);
		try {
			const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
			await res.text();
			if (res.ok) return;
			lastError = `HTTP ${res.status}`;
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		}
		await delay(50);
	}
	throw new Error(`server did not become healthy: ${lastError}`);
}

/** @param {import('node:child_process').ChildProcess | undefined} child */
export async function stopServer(child) {
	if (!child || child.exitCode !== null) return;
	child.kill('SIGTERM');
	await Promise.race([once(child, 'exit'), delay(5000)]);
	if (child.exitCode === null) {
		child.kill('SIGKILL');
		await Promise.race([once(child, 'exit'), delay(2000)]);
	}
}

/** @param {Response} res @returns {string} */
export function cookieHeader(res) {
	return res.headers
		.getSetCookie()
		.map((cookie) => cookie.split(';', 1)[0])
		.join('; ');
}
