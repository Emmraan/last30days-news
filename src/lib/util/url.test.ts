import { expect, test } from 'vitest';
import { canonicalUrl, itemId } from '#lib/util/url';

const cases: [string, string | null][] = [
	// scheme + host are lowercased, the path keeps its case
	['https://WWW.Example.COM/Path/', 'https://example.com/Path'],
	// a bare host gets the root path, and the root keeps its slash
	['http://example.com', 'http://example.com/'],
	['https://example.com/', 'https://example.com/'],
	// only the exact `www.` prefix goes
	['https://wwwx.example.com/a', 'https://wwwx.example.com/a'],
	// the fragment is never part of the identity
	['https://example.com/a#section-2', 'https://example.com/a'],
	// tracking params go, everything else stays and is sorted
	[
		'https://example.com/a?utm_source=x&utm_medium=y&utm_campaign=z&fbclid=1&gclid=2&ref=rss&ref_src=t&source=hn&mc_cid=3&mc_eid=4&igshid=5&keep=1',
		'https://example.com/a?keep=1'
	],
	['https://example.com/a?b=2&a=1', 'https://example.com/a?a=1&b=2'],
	['https://example.com/a?a=2&a=1', 'https://example.com/a?a=1&a=2'],
	// a non-tracking param named like one of ours still goes if it matches exactly
	['https://example.com/a?sources=1', 'https://example.com/a?sources=1'],
	// deep paths keep one trailing slash strip only
	['https://example.com/a/b//', 'https://example.com/a/b'],
	// a port survives
	['https://example.com:8443/a', 'https://example.com:8443/a'],
	// anything that is not http(s) is not a news item
	['ftp://example.com/a', null],
	['file:///etc/passwd', null],
	['javascript:alert(1)', null],
	['mailto:a@example.com', null],
	['not a url', null],
	['', null],
	['//example.com/a', null]
];

for (const [input, expected] of cases) {
	test(`canonical ${input || '(empty)'}`, () => {
		expect(canonicalUrl(input)).toBe(expected);
	});
}

test('the same URL in two shapes yields one id', () => {
	const a = canonicalUrl('https://www.example.com/x/?utm_source=a#frag')!;
	const b = canonicalUrl('https://EXAMPLE.com/x')!;
	expect(itemId(a)).toBe(itemId(b));
	expect(itemId(a)).toMatch(/^[0-9a-f]{40}$/);
});
