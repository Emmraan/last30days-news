#!/usr/bin/env node
// pnpm's built-in audit only prints a flat advisory list. This prints the
// severity counts so critical/high are impossible to skim past, and fails the
// gate on them (moderate and below are reported but do not block). Run it as
// `pnpm audit:gate`; `pnpm audit` is the built-in and cannot be shadowed.
import { execSync } from 'node:child_process';

let raw = '';
try {
	raw = execSync('pnpm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
	raw = /** @type {{ stdout?: string }} */ (err).stdout ?? '';
}

/** @type {Record<string, number>} */
let found = {};
try {
	found = JSON.parse(raw).metadata?.vulnerabilities ?? {};
} catch {
	console.error('[audit] could not parse pnpm audit output');
	process.exit(1);
}

const order = ['critical', 'high', 'moderate', 'low', 'info'];
const counts = Object.fromEntries(order.map((k) => [k, Number(found[k] ?? 0)]));
const total = order.reduce((sum, k) => sum + counts[k], 0);

for (const k of order) console.log(`${k.padEnd(9)} ${counts[k]}`);
console.log(`${'total'.padEnd(9)} ${total}`);

if (counts.critical > 0 || counts.high > 0) {
	console.error(`\n[audit] ${counts.critical} critical, ${counts.high} high — fix before shipping`);
	process.exit(1);
}
