import { posix, win32 } from 'node:path';

export class UsageError extends Error {}

const DEFAULT_PORTS = Array.from({ length: 11 }, (_, i) => 4477 + i);

/** `--help` and `--version` must work before the build is imported. @param {string[]} argv */
export function parseArgs(argv) {
	const result = { help: false, version: false, noOpen: false };
	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') result.help = true;
		else if (arg === '--version' || arg === '-v') result.version = true;
		else if (arg === '--no-open') result.noOpen = true;
		else if (arg.startsWith('-')) throw new UsageError(`Unknown option: ${arg}`);
		else throw new UsageError(`Unexpected argument: ${arg}`);
	}
	return result;
}

/** §S19: an explicit PORT is used as-is; otherwise the next free port wins. @param {Record<string, string | undefined>} env */
export function portCandidates(env) {
	if (env.PORT === undefined) return [...DEFAULT_PORTS];
	if (!/^\d+$/.test(env.PORT))
		throw new Error('PORT must be a whole number between 1 and 65535.');
	const port = Number(env.PORT);
	if (port < 1 || port > 65535)
		throw new Error('PORT must be a whole number between 1 and 65535.');
	return [port];
}

/**
 * @param {{ platform: string, env: Record<string, string | undefined>, home: string }} input
 * @returns {string}
 */
export function defaultDataDir({ platform, env, home }) {
	if (env.L30_DATA_DIR) return env.L30_DATA_DIR;
	const path = platform === 'win32' ? win32 : posix;
	if (platform === 'win32' && env.APPDATA) return path.join(env.APPDATA, 'last30days-news');
	if (platform === 'darwin')
		return path.join(home, 'Library', 'Application Support', 'last30days-news');
	return path.join(env.XDG_DATA_HOME ?? path.join(home, '.local', 'share'), 'last30days-news');
}

/** The adapter reads these at import time, so they must be set before it loads. @param {Record<string, string | undefined>} env */
export function adapterEnv(env) {
	if (env.L30_TRUST_PROXY !== '1')
		return { PROTOCOL_HEADER: 'x-l30-proto' };
	return {
		PROTOCOL_HEADER: 'x-forwarded-proto',
		ADDRESS_HEADER: 'x-forwarded-for',
		XFF_DEPTH: '1'
	};
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {boolean} noOpen
 */
export function shouldOpenBrowser(env, noOpen) {
	return !noOpen && !env.CI;
}

/** @param {string} host */
export function displayHost(host) {
	if (host === '0.0.0.0') return '127.0.0.1';
	if (host === '::') return '[::1]';
	if (host.includes(':') && !host.startsWith('[')) return `[${host}]`;
	return host;
}

/**
 * @param {string} platform
 * @param {string} url
 */
export function browserCommand(platform, url) {
	if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '', url] };
	if (platform === 'darwin') return { command: 'open', args: [url] };
	return { command: 'xdg-open', args: [url] };
}
