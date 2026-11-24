#!/usr/bin/env node
// §S17 budgets fail the build, not a code review. Static sizes come from the
// rendered HTML, so the number is the bytes a browser actually asks for.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createClient } from '@libsql/client';
import {
	checkBudget,
	fontFiles,
	formatBytes,
	hasFontFace,
	parseAssetUrls,
	percentile
} from './budget-lib.mjs';
import { cookieHeader, ROOT, startServer, stopServer } from './server-harness.mjs';

const KB = 1024;
const LIMITS = {
	routeJs: 60 * KB,
	css: 28 * KB,
	firstLoad: 90 * KB,
	landing: 40 * KB,
	feed: 120 * KB,
	coldBoot: 800,
	feedP95: 300,
	database: 200 * KB * KB
};
/** @type {Array<{ name: string, value: number, limit: number, ok: boolean, unit: string }>} */
const results = [];

/** @param {string} name @param {number} value @param {number} limit @param {string} [unit] */
function add(name, value, limit, unit = 'bytes') {
	results.push({ ...checkBudget(name, value, limit), unit });
}

/** @param {string} message @returns {never} */
function fail(message) {
	console.error(`[budget] ${message}`);
	process.exit(1);
}

/** @param {string} file @returns {number} */
function gzBytes(file) {
	const gz = `${file}.gz`;
	return existsSync(gz) ? statSync(gz).size : gzipSync(readFileSync(file)).length;
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...walk(path));
		else files.push(path);
	}
	return files;
}

/** @param {string} url @returns {string} */
function assetFile(url) {
	const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
	const root = join(ROOT, 'build', 'client');
	const file = resolve(root, `.${pathname}`);
	if (!file.startsWith(root + sep)) fail(`asset escapes the client build: ${url}`);
	if (!existsSync(file)) fail(`asset missing from the build: ${url}`);
	return file;
}

/** A long insert can outlive the server's keep-alive window; retry the safe GET once. */
/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
async function get(url, init) {
	for (let attempt = 0; ; attempt++) {
		try {
			return await fetch(url, init);
		} catch (err) {
			const code = /** @type {{ cause?: { code?: string } }} */ (err).cause?.code;
			if (attempt === 0 && code === 'ECONNRESET') continue;
			throw err;
		}
	}
}

/** @param {{ name: string, value: number, limit: number, ok: boolean, unit: string }} result */
function show(result) {
	const value =
		result.unit === 'ms'
			? `${Math.round(result.value)} ms`
			: result.unit === 'count'
				? `${result.value}`
				: formatBytes(result.value);
	const limit =
		result.unit === 'ms'
			? `${result.limit} ms`
			: result.unit === 'count'
				? `${result.limit}`
				: formatBytes(result.limit);
	return `${result.ok ? 'ok  ' : 'FAIL'} ${result.name.padEnd(22)} ${value.padStart(9)}  limit ${limit}`;
}

if (!existsSync(join(ROOT, 'build', 'handler.js')) || !existsSync(join(ROOT, 'build', 'client')))
	fail('app build is missing. Run "pnpm build" first.');
if (!existsSync(join(ROOT, 'landing', 'build', 'index.html')))
	fail('landing build is missing. Run "pnpm build:landing" first.');

const dataDir = mkdtempSync(join(tmpdir(), 'l30-budget-'));
let server;
/** @type {import('@libsql/client').Client | undefined} */
let client;

try {
	server = await startServer({ dataDir });
	add('cold boot', server.bootMs, LIMITS.coldBoot, 'ms');

	const loginPage = await get(`${server.url}/login`);
	const loginHtml = await loginPage.text();
	if (loginPage.status !== 200) throw new Error(`login page returned ${loginPage.status}`);

	const login = await fetch(`${server.url}/api/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: server.url },
		body: JSON.stringify({ password: 'last30' })
	});
	if (login.status !== 200) throw new Error(`first-run login returned ${login.status}`);
	const firstCookie = cookieHeader(login);
	await login.json();

	const changed = await fetch(`${server.url}/api/auth/password`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin: server.url,
			cookie: firstCookie
		},
		body: JSON.stringify({ current: 'last30', next: `budget-${randomUUID()}` })
	});
	if (changed.status !== 200) throw new Error(`password change returned ${changed.status}`);
	const cookie = cookieHeader(changed);
	await changed.json();
	if (!cookie) throw new Error('password change set no cookies');

	const appPage = await get(`${server.url}/app`, { headers: { cookie } });
	const appHtml = await appPage.text();
	if (appPage.status !== 200) throw new Error(`app page returned ${appPage.status}`);

	for (const [name, html] of [
		['/login', loginHtml],
		['/app', appHtml]
	]) {
		const urls = parseAssetUrls(html, name);
		const js = urls
			.filter((url) => url.endsWith('.js'))
			.reduce((sum, url) => sum + gzBytes(assetFile(url)), 0);
		const css = urls
			.filter((url) => url.endsWith('.css'))
			.reduce((sum, url) => sum + gzBytes(assetFile(url)), 0);
		const htmlGz = gzipSync(Buffer.from(html)).length;
		add(`JS ${name}`, js, LIMITS.routeJs);
		add(`CSS ${name}`, css, LIMITS.css);
		add(`first load ${name}`, js + css + htmlGz, LIMITS.firstLoad);
	}

	const clientFiles = walk(join(ROOT, 'build', 'client'));
	const landingFiles = walk(join(ROOT, 'landing', 'build')).filter(
		(file) => !/\.(?:gz|br|map)$/i.test(file)
	);
	const landingBytes = landingFiles.reduce((sum, file) => sum + gzBytes(file), 0);
	add('landing total', landingBytes, LIMITS.landing);

	const cssFiles = [...clientFiles, ...landingFiles].filter((file) => file.endsWith('.css'));
	const fontCss = cssFiles.filter((file) => hasFontFace(readFileSync(file, 'utf8')));
	const fonts = fontFiles([...clientFiles, ...landingFiles]);
	add('web fonts', fonts.length + fontCss.length, 0, 'count');
	if (fonts.length + fontCss.length > 0) {
		for (const file of [...fonts, ...fontCss])
			console.error(`[budget]   font source: ${relative(ROOT, file)}`);
	}

	client = createClient({ url: `file:${join(dataDir, 'db.sqlite')}` });
	const now = Date.now();
	const excerpt = 'The quick brown fox jumps over the lazy dog. '.repeat(20).slice(0, 800);
	for (let start = 0; start < 20000; start += 250) {
		const statements = [];
		for (let n = start; n < Math.min(start + 250, 20000); n++) {
			const id = n.toString(16).padStart(40, '0');
			const url = `https://example.com/story/${n}`;
			statements.push({
				sql: 'insert into item (id, title, url, published_at, fetched_at, excerpt, language, category, source_count) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
				args: [
					id,
					`Story ${n}: a headline long enough to look like a real feed row`,
					url,
					now - n * 1000,
					now - n * 1000,
					excerpt,
					'en',
					n % 2 ? 'ai' : 'technology',
					1
				]
			});
			statements.push({
				sql: 'insert into item_source (item_id, source_id, url) values (?, ?, ?)',
				args: [id, 'ars', url]
			});
		}
		await client.batch(statements, 'write');
	}
	await client.execute('PRAGMA wal_checkpoint(TRUNCATE)');
	await client.close();
	client = undefined;
	const dbFile = join(dataDir, 'db.sqlite');
	const dbBytes =
		statSync(dbFile).size + (existsSync(`${dbFile}-wal`) ? statSync(`${dbFile}-wal`).size : 0);
	add('database 20k rows', dbBytes, LIMITS.database);

	const feed = await get(`${server.url}/api/feed?limit=50`, { headers: { cookie } });
	if (feed.status !== 200) throw new Error(`feed returned ${feed.status}`);
	const feedBytes = (await feed.arrayBuffer()).byteLength;
	add('feed 50 items', feedBytes, LIMITS.feed);

	const samples = [];
	for (let i = 0; i < 20; i++) {
		const started = performance.now();
		const res = await get(`${server.url}/api/feed?limit=50`, { headers: { cookie } });
		await res.arrayBuffer();
		if (res.status !== 200) throw new Error(`feed sample returned ${res.status}`);
		samples.push(performance.now() - started);
	}
	add('feed p95 @20k', percentile(samples, 95) ?? 0, LIMITS.feedP95, 'ms');

	for (const result of results) console.log(`[budget] ${show(result)}`);
	console.log('[budget] fetch pass            not measured (network; recorded fixtures only)');

	if (results.some((result) => !result.ok)) {
		console.error('[budget] one or more budgets failed');
		process.exitCode = 1;
	} else {
		console.log('[budget] all measured budgets pass');
	}
} catch (err) {
	console.error('[budget] failed:', err);
	if (server) console.error(`[budget] server output:\n${server.output()}`);
	throw err;
} finally {
	await stopServer(server?.child);
	if (client) {
		try {
			await client.close();
		} catch {
			/* closing a temp DB is best-effort */
		}
	}
	try {
		rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
	} catch {
		/* temp dir, OS cleans up */
	}
}
