#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
	UsageError,
	adapterEnv,
	browserCommand,
	defaultDataDir,
	displayHost,
	parseArgs,
	portCandidates,
	shouldOpenBrowser
} from './options.mjs';

const ROOT = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));

const HELP = `last30days-news ${pkg.version}

Usage: last30days [options]

Options:
  --no-open       Do not open the browser
  --version, -v   Print the version and exit
  --help, -h      Print this help and exit

Environment:
  PORT            Port to listen on (default: first free from 4477 to 4487)
  HOST            Bind address (default: 127.0.0.1)
  L30_DATA_DIR    Data directory (default: the platform app data directory)
  L30_DEBUG       Set to 1 for debug logs
  L30_TRUST_PROXY Set to 1 only behind a proxy that sets X-Forwarded-*
  CI              Set to any value to skip opening the browser
`;

let args;
try {
	args = parseArgs(process.argv.slice(2));
} catch (err) {
	if (!(err instanceof UsageError)) throw err;
	console.error(`last30days: ${err.message}`);
	console.error('Run "last30days --help" for usage.');
	process.exit(2);
}

if (args.help) {
	console.log(HELP);
	process.exit(0);
}
if (args.version) {
	console.log(`last30days-news ${pkg.version}`);
	process.exit(0);
}

const dataDir = prepareDataDir(
	defaultDataDir({ platform: process.platform, env: process.env, home: homedir() })
);
// The server resolves the same variable, so the printed path is the one it uses.
process.env.L30_DATA_DIR = dataDir;

// The adapter snapshots these at import time, so they must be in place first.
for (const [key, value] of Object.entries(adapterEnv(process.env))) process.env[key] ??= value;
const trustProxy = process.env.L30_TRUST_PROXY === '1';
const protocolHeader = process.env.PROTOCOL_HEADER;

let candidates;
try {
	candidates = portCandidates(process.env);
} catch (err) {
	fail(err instanceof Error ? err.message : String(err));
}

const host = process.env.HOST || '127.0.0.1';
if (!isLoopback(host)) {
	console.warn(
		`last30days: listening on ${host}. Make sure a firewall or proxy protects this port.`
	);
}

/** @type {number | null} */
let port;
try {
	port = await pickPort(candidates, host);
} catch (err) {
	fail(`Cannot listen on ${host}: ${err instanceof Error ? err.message : String(err)}`);
}
if (port === null) {
	fail(
		process.env.PORT === undefined
			? 'No free port between 4477 and 4487. Set PORT to a free port.'
			: `Port ${process.env.PORT} is already in use. Set PORT to a free port.`
	);
}

const handlerPath = new URL('build/handler.js', ROOT);
if (!existsSync(handlerPath)) {
	fail(`Build not found at ${fileURLToPath(handlerPath)}. Run "pnpm build" first.`);
}

let handler;
try {
	({ handler } = await import(pathToFileURL(fileURLToPath(handlerPath)).href));
} catch (err) {
	fail(`Cannot load the built server: ${err instanceof Error ? err.message : String(err)}`);
}

const server = createServer((req, res) => {
	// The adapter assumes TLS unless told otherwise. A direct install is plain
	// HTTP, and the host comes from the request so Docker's port mapping works.
	if (!trustProxy && protocolHeader === 'x-l30-proto') req.headers['x-l30-proto'] = 'http';
	handler(req, res);
});
try {
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, host, () => {
			server.off('error', reject);
			resolve(undefined);
		});
	});
} catch (err) {
	fail(
		`Cannot listen on ${host}:${port}: ${err instanceof Error ? err.message : String(err)}`
	);
}

const url = `http://${displayHost(host)}:${port}`;
console.log(`\nlast30days-news ${pkg.version}`);
console.log(`  ${url}`);
console.log(`  data ${dataDir}`);
console.log('  press Ctrl+C to stop\n');

if (shouldOpenBrowser(process.env, args.noOpen)) openBrowser(url);

let closing = false;
/** @param {string} signal */
function shutdown(signal) {
	if (closing) return;
	closing = true;
	console.log(`\nlast30days: ${signal}, closing.`);
	const timer = setTimeout(() => process.exit(1), 5000);
	timer.unref();
	server.close(() => {
		clearTimeout(timer);
		process.exit(0);
	});
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/** @param {string} dir @returns {string} */
function prepareDataDir(dir) {
	try {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
		const probe = join(dir, `.write-test-${process.pid}`);
		writeFileSync(probe, '');
		unlinkSync(probe);
		return dir;
	} catch {
		fail(`Cannot write to data directory ${dir}. Set L30_DATA_DIR to a writable path.`);
	}
}

/** @param {string} address */
function isLoopback(address) {
	return (
		address === 'localhost' ||
		address === '::1' ||
		address.startsWith('127.') ||
		address === '[::1]'
	);
}

/** @param {number} port @param {string} address @returns {Promise<boolean>} */
function canListen(port, address) {
	return new Promise((resolve, reject) => {
		const probe = createNetServer();
		probe.unref();
		probe.once('error', (err) => {
			if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EADDRINUSE') resolve(false);
			else reject(err);
		});
		probe.once('listening', () => probe.close(() => resolve(true)));
		probe.listen({ port, host: address, exclusive: true });
	});
}

/** @param {number[]} candidates @param {string} address @returns {Promise<number | null>} */
async function pickPort(candidates, address) {
	for (const candidate of candidates) if (await canListen(candidate, address)) return candidate;
	return null;
}

/** @param {string} target */
function openBrowser(target) {
	try {
		const { command, args: commandArgs } = browserCommand(process.platform, target);
		const child = spawn(command, commandArgs, {
			detached: true,
			stdio: 'ignore',
			windowsHide: true
		});
		child.on('error', () => {
			/* a headless host still has a working URL in the terminal */
		});
		child.unref();
	} catch {
		/* opening a browser is a convenience, never a boot requirement */
	}
}

/** @param {string} message @returns {never} */
function fail(message) {
	console.error(`last30days: ${message}`);
	process.exit(1);
}
