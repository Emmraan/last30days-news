import { afterEach, expect, test, vi } from 'vitest';
import { log } from '#lib/server/log';

const lines: Record<string, unknown>[] = [];

function capture() {
	lines.length = 0;
	return vi
		.spyOn(process.stdout, 'write')
		.mockImplementation((chunk: unknown) => {
			for (const line of String(chunk).split('\n').filter(Boolean))
				lines.push(JSON.parse(line) as Record<string, unknown>);
			return true;
		});
}

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.L30_DEBUG;
});

test('writes one NDJSON line with ts, level, event and data', () => {
	const out = capture();
	log('info', 'boot', { version: '0.1.0' });
	out.mockRestore();
	expect(lines).toHaveLength(1);
	expect(Object.keys(lines[0])).toEqual(['ts', 'level', 'event', 'data']);
	expect(lines[0].level).toBe('info');
	expect(lines[0].event).toBe('boot');
	expect(lines[0].data).toEqual({ version: '0.1.0' });
	expect(typeof lines[0].ts).toBe('number');
});

test('data is optional', () => {
	const out = capture();
	log('info', 'prune');
	out.mockRestore();
	expect(lines[0].data).toEqual({});
});

test('debug is dropped unless L30_DEBUG=1', () => {
	const out = capture();
	log('debug', 'fetch.source', { source_id: 'hn-top' });
	expect(lines).toHaveLength(0);
	process.env.L30_DEBUG = '1';
	log('debug', 'fetch.source', { source_id: 'hn-top' });
	out.mockRestore();
	expect(lines).toHaveLength(1);
});

test('secret-looking fields are scrubbed at any depth', () => {
	const out = capture();
	log('info', 'auth.fail', {
		ip: '1.2.3.4',
		password: 'hunter2',
		cookie: 'l30_session=abc',
		apiKey: 'sk-live',
		hash: 'scrypt$...',
		nested: { secret: 'x', body: 'request body' },
		items: [{ title: 'a', excerpt: 'b' }]
	});
	out.mockRestore();
	const data = lines[0].data as Record<string, unknown>;
	expect(data.ip).toBe('1.2.3.4');
	for (const key of ['password', 'cookie', 'apiKey', 'hash']) expect(data).not.toHaveProperty(key);
	expect(data.nested).toEqual({});
	expect(data.items).toEqual([]);
});

test('an error object is serialised without a stack or a message body', () => {
	const out = capture();
	log('error', 'api.error', { code: 'internal', err: new Error('boom at /secret/path') });
	out.mockRestore();
	const text = JSON.stringify(lines[0]);
	expect(text).not.toContain('secret/path');
	expect(text).not.toContain('    at ');
});
