import { describe, expect, it } from 'vitest';
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

describe('parseArgs', () => {
	it.each([
		[[], { help: false, version: false, noOpen: false }],
		[['--no-open'], { help: false, version: false, noOpen: true }],
		[['--help'], { help: true, version: false, noOpen: false }],
		[['-h'], { help: true, version: false, noOpen: false }],
		[['--version'], { help: false, version: true, noOpen: false }],
		[['-v'], { help: false, version: true, noOpen: false }],
		[
			['--no-open', '--no-open'],
			{ help: false, version: false, noOpen: true }
		]
	])('accepts %j', (argv, expected) => {
		expect(parseArgs(argv)).toEqual(expected);
	});

	it.each([['--port'], ['-p'], ['--bogus'], ['serve']])('rejects unknown arg %s', (arg) => {
		expect(() => parseArgs([arg])).toThrow(UsageError);
	});
});

describe('portCandidates', () => {
	it('defaults to the ten ports after 4477', () => {
		expect(portCandidates({})).toEqual([4477, 4478, 4479, 4480, 4481, 4482, 4483, 4484, 4485, 4486, 4487]);
	});

	it('honours PORT exactly', () => {
		expect(portCandidates({ PORT: '5000' })).toEqual([5000]);
	});

	it.each(['', '0', '65536', '12.5', 'abc', ' 5000', '-1'])(
		'rejects invalid PORT %j naming the variable',
		(value) => {
			expect(() => portCandidates({ PORT: value })).toThrow(/PORT/);
		}
	);
});

describe('defaultDataDir', () => {
	it('lets L30_DATA_DIR win on every platform', () => {
		expect(
			defaultDataDir({
				platform: 'win32',
				env: { L30_DATA_DIR: 'D:\\feed', APPDATA: 'C:\\Users\\me\\AppData\\Roaming' },
				home: 'C:\\Users\\me'
			})
		).toBe('D:\\feed');
	});

	it('uses APPDATA on Windows', () => {
		expect(
			defaultDataDir({
				platform: 'win32',
				env: { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' },
				home: 'C:\\Users\\me'
			})
		).toBe('C:\\Users\\me\\AppData\\Roaming\\last30days-news');
	});

	it('uses Application Support on macOS', () => {
		expect(defaultDataDir({ platform: 'darwin', env: {}, home: '/Users/me' })).toBe(
			'/Users/me/Library/Application Support/last30days-news'
		);
	});

	it('uses XDG_DATA_HOME on Linux', () => {
		expect(
			defaultDataDir({ platform: 'linux', env: { XDG_DATA_HOME: '/home/me/.data' }, home: '/home/me' })
		).toBe('/home/me/.data/last30days-news');
	});

	it('falls back to ~/.local/share on Linux', () => {
		expect(defaultDataDir({ platform: 'linux', env: {}, home: '/home/me' })).toBe(
			'/home/me/.local/share/last30days-news'
		);
	});
});

describe('adapterEnv', () => {
	it('makes a direct install speak HTTP and trusts forwarded headers only when asked', () => {
		expect(adapterEnv({})).toEqual({ PROTOCOL_HEADER: 'x-l30-proto' });
		expect(adapterEnv({ L30_TRUST_PROXY: 'true' })).toEqual({
			PROTOCOL_HEADER: 'x-l30-proto'
		});
		expect(adapterEnv({ L30_TRUST_PROXY: '1' })).toEqual({
			PROTOCOL_HEADER: 'x-forwarded-proto',
			ADDRESS_HEADER: 'x-forwarded-for',
			XFF_DEPTH: '1'
		});
	});
});

describe('shouldOpenBrowser', () => {
	it('opens unless --no-open or CI is set', () => {
		expect(shouldOpenBrowser({}, false)).toBe(true);
		expect(shouldOpenBrowser({}, true)).toBe(false);
		expect(shouldOpenBrowser({ CI: '1' }, false)).toBe(false);
		expect(shouldOpenBrowser({ CI: '' }, false)).toBe(true);
	});
});

describe('displayHost', () => {
	it.each([
		['0.0.0.0', '127.0.0.1'],
		['::', '[::1]'],
		['127.0.0.1', '127.0.0.1'],
		['localhost', 'localhost']
	])('turns %s into a browsable host', (host, expected) => {
		expect(displayHost(host)).toBe(expected);
	});
});

describe('browserCommand', () => {
	it.each([
		['win32', { command: 'cmd', args: ['/c', 'start', '', 'http://127.0.0.1:4477'] }],
		['darwin', { command: 'open', args: ['http://127.0.0.1:4477'] }],
		['linux', { command: 'xdg-open', args: ['http://127.0.0.1:4477'] }]
	])('uses the platform opener on %s', (platform, expected) => {
		expect(browserCommand(platform, 'http://127.0.0.1:4477')).toEqual(expected);
	});
});
