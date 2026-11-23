import { expect, test } from 'vitest';
import { displayText, formatWhen, safeHref, sourceInitials } from '#lib/format';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

const localDate = (ms: number, now: number) =>
	new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: new Date(ms).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric'
	}).format(ms);

test.each([
	['now', NOW, 'now'],
	['the first minute', NOW - MINUTE + 1, 'now'],
	['one minute', NOW - MINUTE, '1m ago'],
	['fifty-nine minutes', NOW - 59 * MINUTE, '59m ago'],
	['one hour', NOW - HOUR, '1h ago'],
	['twenty-three hours', NOW - 23 * HOUR, '23h ago'],
	['one day', NOW - DAY, '1d ago'],
	['six days', NOW - 6 * DAY, '6d ago'],
	['a future clock', NOW + HOUR, 'now'],
	['an estimated time', NOW - 2 * HOUR, '~2h ago']
] satisfies [string, number, string][])('formatWhen shows %s', (label, ms, expected) => {
	const estimated = label === 'an estimated time';
	expect(formatWhen(ms, NOW, estimated)).toBe(expected);
});

test('formatWhen switches to a local date at seven days', () => {
	const sevenDays = NOW - 7 * DAY;
	expect(formatWhen(sevenDays, NOW)).toBe(localDate(sevenDays, NOW));
	expect(formatWhen(sevenDays - 1, NOW)).toBe(localDate(sevenDays - 1, NOW));
	expect(formatWhen(sevenDays, NOW)).not.toMatch(/ago$/);
});

test('an old date shows the year only when it is not the current year', () => {
	const thisYear = Date.UTC(2026, 0, 5, 9, 0, 0);
	const lastYear = Date.UTC(2025, 0, 5, 9, 0, 0);
	expect(formatWhen(thisYear, NOW)).toBe('5 Jan');
	expect(formatWhen(lastYear, NOW)).toBe('5 Jan 2025');
});

test('an estimated old date keeps the estimate marker', () => {
	const old = NOW - 30 * DAY;
	expect(formatWhen(old, NOW, true)).toBe(`~${localDate(old, NOW)}`);
});

test.each([
	['Ars Technica', 'AT'],
	['The Verge', 'V'],
	['Hacker News', 'HN'],
	['MIT Technology Review', 'MT'],
	['TechCrunch AI', 'TA'],
	['Hugging Face Blog', 'HF'],
	['The New York Times', 'NY'],
	['The', 'T'],
	['BBC', 'B'],
	['  ', '?'],
	[null, '?'],
	[undefined, '?']
] satisfies [string | null | undefined, string][])('sourceInitials(%o) is %s', (name, expected) => {
	expect(sourceInitials(name)).toBe(expected);
});

test('sourceInitials keeps non-Latin initials', () => {
	expect(sourceInitials('科技 日报')).toBe('科日');
});

test('sourceInitials strips bidi and control characters from hostile names', () => {
	expect(sourceInitials('\u202EThe Verge')).toBe('V');
	expect(sourceInitials('\u0000Ars Technica')).toBe('AT');
});

test('displayText removes controls and bidi overrides', () => {
	expect(displayText('Hello\u0000 world')).toBe('Hello world');
	expect(displayText('Safe\u202Etxet')).toBe('Safetxet');
	expect(displayText('A\u200Bb')).toBe('Ab');
	expect(displayText('One\nTwo\tThree')).toBe('One Two Three');
	expect(displayText('  padded  ')).toBe('padded');
});

test('displayText decodes the entities feeds emit', () => {
	expect(displayText('Read more [&#8230;]')).toBe('Read more […]');
	expect(displayText('Tom &amp; Jerry')).toBe('Tom & Jerry');
	expect(displayText('&lt;b&gt;not markup&lt;/b&gt;')).toBe('<b>not markup</b>');
	expect(displayText('It&rsquo;s here&nbsp;now')).toBe('It’s here now');
	expect(displayText('&#x2014; dash')).toBe('— dash');
	// An unknown or malformed entity stays literal rather than vanishing.
	expect(displayText('&nosuch; &#xZZ;')).toBe('&nosuch; &#xZZ;');
});

test('displayText normalises Unicode without changing plain text', () => {
	expect(displayText('cafe\u0301')).toBe('café');
	expect(displayText('Plain text - unchanged')).toBe('Plain text - unchanged');
	expect(displayText('你好')).toBe('你好');
});

test.each([
	['https://example.com/a?b=c', 'https://example.com/a?b=c'],
	['http://example.com', 'http://example.com'],
	['HTTPS://EXAMPLE.COM/x', 'HTTPS://EXAMPLE.COM/x'],
	['javascript:alert(1)', '#'],
	['data:text/html,<script>alert(1)</script>', '#'],
	['file:///etc/passwd', '#'],
	['//evil.example', '#'],
	['/relative', '#'],
	['not a url', '#'],
	['', '#'],
	[null, '#'],
	[undefined, '#']
] satisfies [string | null | undefined, string][])('safeHref(%o) is %o', (value, expected) => {
	expect(safeHref(value)).toBe(expected);
});
