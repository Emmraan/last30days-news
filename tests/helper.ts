import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { createDb } from '#lib/server/db';

const cleanups: (() => void)[] = [];

afterEach(() => {
	// Windows holds the libSQL WAL handle for a while after close(); a temp dir
	// that refuses to delete is left to the OS rather than failing the test.
	while (cleanups.length)
		try {
			cleanups.pop()!();
		} catch {
			/* ignore */
		}
});

/** A real file-backed DB per call — never a mock, per AGENTS.md §2. */
export async function freshDb() {
	const dir = mkdtempSync(join(tmpdir(), 'l30-auth-'));
	const handle = await createDb({ dataDir: dir });
	cleanups.push(() => {
		handle.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
	});
	return handle;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
