import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import DetailPane from '../src/lib/components/DetailPane.svelte';
import ItemRow from '../src/lib/components/ItemRow.svelte';
import TopBar from '../src/lib/components/TopBar.svelte';
import type { Item, ItemDetail } from '../src/lib/types';

const NOW = Date.UTC(2026, 10, 20, 12);

const baseItem: Item = {
	id: 'a'.repeat(40),
	title: 'A title',
	url: 'https://example.com/article',
	author: null,
	publishedAt: NOW - 2 * 60 * 60 * 1000,
	publishedEstimated: false,
	fetchedAt: NOW - 60 * 60 * 1000,
	excerpt: 'An excerpt.',
	language: 'en',
	category: 'technology',
	sourceCount: 1
};

function row(item: Item, now = NOW) {
	return render(ItemRow, {
		props: { item, now, onselect: () => undefined }
	}).body;
}

function detailPane(detail: ItemDetail | null, state: 'ready' | 'idle' | 'loading' = 'ready') {
	return render(DetailPane, {
		props: {
			state,
			detail,
			error: '',
			categoryName: 'Technology',
			now: NOW,
			generating: false,
			generateError: '',
			onretry: () => undefined,
			ongenerate: () => undefined
		}
	}).body;
}

describe('ItemRow', () => {
	it('escapes a hostile title and removes bidi controls', () => {
		const body = row({
			...baseItem,
			title: '<img src=x onerror="alert(1)">\u202Egnp.exe'
		});

		expect(body).not.toContain('<img');
		expect(body).toContain('&lt;img');
		expect(body).not.toContain('\u202E');
	});

	it('shows the source name and a multi-source badge only above one', () => {
		const two = row({ ...baseItem, sourceCount: 2, sourceName: 'Ars Technica' });
		expect(two).toContain('Ars Technica');
		expect(two).toContain('2 sources');
		expect(two).toContain('>AT<');

		const one = row({ ...baseItem, sourceName: 'The Verge' });
		expect(one).toContain('The Verge');
		expect(one).not.toContain('1 sources');
		expect(one).toContain('>V<');
	});

	it('falls back for an unattributed item and flags an estimated time', () => {
		const body = row({
			...baseItem,
			sourceName: null,
			publishedEstimated: true,
			publishedAt: NOW - 3 * 60 * 60 * 1000
		});

		expect(body).toContain('Unknown source');
		expect(body).toContain('~3h ago');
	});

	it('renders the why callout when a reason exists', () => {
		const body = row({ ...baseItem, reason: 'Matches <AI> keywords' });
		expect(body).toContain('Matches &lt;AI> keywords');
		expect(body).not.toContain('<AI>');
	});
});

describe('DetailPane', () => {
	it('renders an idle prompt with no item', () => {
		expect(detailPane(null, 'idle')).toContain('Select an item to read it.');
	});

	it('escapes summary content and blocks unsafe URLs', () => {
		const detail: ItemDetail = {
			item: { ...baseItem, url: 'javascript:alert(1)' },
			sources: [
				{
					id: 'ars',
					name: '<b>Ars</b>',
					url: 'data:text/html,<script>alert(1)</script>',
					rawTitle: null
				}
			],
			summary: {
				model: 'test-model',
				body: '<script>alert(1)</script> summary',
				keyPoints: ['<img src=x onerror=alert(2)>', 'A safe point'],
				whyItMatters: '<svg onload=alert(3)>',
				citations: [{ n: 1, source_id: 'ars', url: 'javascript:alert(4)' }],
				createdAt: NOW - 60 * 60 * 1000
			}
		};

		const body = detailPane(detail);

		expect(body).not.toContain('<script');
		expect(body).not.toContain('<img');
		expect(body).not.toContain('<svg');
		expect(body).not.toContain('<b>Ars');
		expect(body).not.toContain('javascript:');
		expect(body).not.toContain('data:text/html');
		expect(body).toContain('&lt;script>');
		expect(body).toContain('[1]');
		expect(body).toContain('test-model');
		expect(body.match(/href="#"/g)?.length).toBe(3);
	});

	it('shows excerpt and the generate action when no summary is cached', () => {
		const detail: ItemDetail = {
			item: baseItem,
			sources: [],
			summary: null
		};

		const body = detailPane(detail);
		expect(body).toContain('An excerpt.');
		expect(body).toContain('Generate summary');
		expect(body).toContain('Open original');
	});

	it('renders the relevance footer only when a score exists', () => {
		const scored = detailPane({
			item: { ...baseItem, score: 0.82 },
			sources: [],
			summary: null
		});
		expect(scored).toContain('Relevance');
		expect(scored).toContain('0.82');

		const unscored = detailPane({ item: baseItem, sources: [], summary: null });
		expect(unscored).not.toContain('Relevance');
	});
});

describe('TopBar', () => {
	it('enables the search field and reflects the current query', () => {
		const body = render(TopBar, {
			props: {
				preset: '24h',
				onpreset: () => undefined,
				onrefresh: () => undefined,
				refreshing: false,
				query: 'alpha beta',
				onquery: () => undefined
			}
		}).body;

		expect(body).toContain('type="search"');
		expect(body).not.toMatch(/type="search"[^>]*disabled/);
		expect(body).toContain('value="alpha beta"');
	});
});
