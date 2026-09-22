import { describe, expect, it } from 'vitest';
import { NodeOperationError } from 'n8n-workflow';
import {
	buildAsyncScrapeBody,
	buildScrapeBody,
	type ScrapeParams,
} from '../nodes/Crawlbrulee/builders/scrape';

const node = {
	name: 'Crawlbrulee',
	type: 'crawlbrulee',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
} as never;
const base = (over: Partial<ScrapeParams> = {}): ScrapeParams => ({
	url: 'https://example.com',
	extract: ['cleaned_html', 'metadata'],
	screenshotType: 'none',
	screenshotOptions: {},
	options: {},
	...over,
});

describe('buildScrapeBody', () => {
	it('sends the url and all six extract flags explicitly', () => {
		expect(buildScrapeBody(node, 0, base())).toEqual({
			url: 'https://example.com',
			extract: {
				markdown: false,
				cleaned_html: true,
				raw_html: false,
				links: false,
				images: false,
				metadata: true,
			},
		});
	});

	it('omits proxy, cleanup, cache and location when Options is untouched', () => {
		const body = buildScrapeBody(node, 0, base());
		expect(body).not.toHaveProperty('proxy');
		expect(body).not.toHaveProperty('cleanup');
		expect(body).not.toHaveProperty('cache');
		expect(body).not.toHaveProperty('location');
		expect(body).not.toHaveProperty('require_js');
	});

	it('maps every option', () => {
		const body = buildScrapeBody(
			node,
			0,
			base({
				options: {
					proxy: 'advanced',
					requireJs: true,
					removeAdsAndPopups: false,
					excludeSelectors: ['.ad', ''],
					cacheMaxAge: '3600',
					locale: 'de-DE',
					country: 'de',
				},
			}),
		);
		expect(body.proxy).toBe('advanced');
		expect(body.require_js).toBe(true);
		expect(body.cleanup).toEqual({ ads_and_popups: false, exclude_selectors: ['.ad'] });
		expect(body.cache).toEqual({ max_age: 3600 });
		expect(body.location).toEqual({ locale: 'de-DE', country: 'de' });
	});

	it('treats whitespace-only locale and country as unset', () => {
		const body = buildScrapeBody(node, 0, base({ options: { locale: '  ', country: '\t' } }));
		expect(body).not.toHaveProperty('location');
	});

	it('passes an ISO cache cutoff as a string', () => {
		expect(
			buildScrapeBody(node, 0, base({ options: { cacheMaxAge: '2026-09-01T00:00:00Z' } })).cache,
		).toEqual({
			max_age: '2026-09-01T00:00:00Z',
		});
	});

	it('does not send require_js: false', () => {
		expect(buildScrapeBody(node, 0, base({ options: { requireJs: false } }))).not.toHaveProperty(
			'require_js',
		);
	});

	it('builds a full screenshot block', () => {
		const body = buildScrapeBody(
			node,
			0,
			base({
				screenshotType: 'full_page',
				screenshotOptions: {
					width: 1280,
					height: 800,
					deviceScaleFactor: 2,
					deviceMode: 'mobile',
					actionsBefore: {
						action: [
							{ type: 'wait', value: 500 },
							{ type: 'scroll', value: 1000 },
						],
					},
					sliceHeight: 900,
				},
			}),
		);
		expect(body.extract?.screenshot).toEqual({
			type: 'full_page',
			viewport: { width: 1280, height: 800, device_scale_factor: 2 },
			device_mode: 'mobile',
			actions_before: [
				{ type: 'wait', ms: 500 },
				{ type: 'scroll', pixels: 1000 },
			],
			actions_after: [{ type: 'slice', height: 900 }],
		});
	});

	it('sends a bare screenshot type when no options are set', () => {
		expect(
			buildScrapeBody(node, 0, base({ screenshotType: 'viewport' })).extract?.screenshot,
		).toEqual({ type: 'viewport' });
	});

	it('rejects width without height, and a scale factor without a viewport', () => {
		expect(() =>
			buildScrapeBody(
				node,
				2,
				base({ screenshotType: 'viewport', screenshotOptions: { width: 100 } }),
			),
		).toThrow(NodeOperationError);
		expect(() =>
			buildScrapeBody(
				node,
				2,
				base({ screenshotType: 'viewport', screenshotOptions: { deviceScaleFactor: 2 } }),
			),
		).toThrow(/Width and Height/);
	});

	it('rejects a request that asks for nothing', () => {
		expect(() => buildScrapeBody(node, 2, base({ extract: [], screenshotType: 'none' }))).toThrow(
			/Pick at least one Extract output or a Screenshot/,
		);
		expect(() =>
			buildScrapeBody(node, 2, base({ extract: [], screenshotType: 'viewport' })),
		).not.toThrow();
		expect(() =>
			buildAsyncScrapeBody(node, 2, base({ extract: [], screenshotType: 'none' })),
		).toThrow(NodeOperationError);
	});

	it('rejects more than 5 actions and a slice under 500', () => {
		const six = { action: Array.from({ length: 6 }, () => ({ type: 'wait' as const, value: 1 })) };
		expect(() =>
			buildScrapeBody(
				node,
				0,
				base({ screenshotType: 'viewport', screenshotOptions: { actionsBefore: six } }),
			),
		).toThrow(/at most 5/);
		expect(() =>
			buildScrapeBody(
				node,
				0,
				base({ screenshotType: 'viewport', screenshotOptions: { sliceHeight: 100 } }),
			),
		).toThrow(/at least 500/);
	});
});

describe('buildAsyncScrapeBody', () => {
	it('adds the webhook when a url is set, parsing json metadata', () => {
		const body = buildAsyncScrapeBody(
			node,
			0,
			base({ webhookUrl: 'https://hook', webhookMetadata: '{"tenant":"acme"}' }),
		);
		expect(body.webhook).toEqual({ url: 'https://hook', metadata: { tenant: 'acme' } });
	});

	it('accepts object metadata and omits the webhook without a url', () => {
		expect(
			buildAsyncScrapeBody(node, 0, base({ webhookUrl: 'https://hook', webhookMetadata: { a: 1 } }))
				.webhook,
		).toEqual({ url: 'https://hook', metadata: { a: 1 } });
		expect(buildAsyncScrapeBody(node, 0, base())).not.toHaveProperty('webhook');
	});

	it('rejects metadata without a url and invalid metadata json', () => {
		expect(() => buildAsyncScrapeBody(node, 0, base({ webhookMetadata: '{"a":1}' }))).toThrow(
			/Webhook URL/,
		);
		expect(() =>
			buildAsyncScrapeBody(node, 0, base({ webhookUrl: 'https://hook', webhookMetadata: '{oops' })),
		).toThrow(/Webhook Metadata/);
	});
});
