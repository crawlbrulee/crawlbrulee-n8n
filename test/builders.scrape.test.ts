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

	it('sends zero_data_retention at the top level only when on, for sync and async', () => {
		expect(buildScrapeBody(node, 0, base({ options: { zeroDataRetention: true } }))).toMatchObject({
			zero_data_retention: true,
		});
		expect(
			buildAsyncScrapeBody(node, 0, base({ options: { zeroDataRetention: true } })),
		).toMatchObject({ zero_data_retention: true });
		expect(
			buildScrapeBody(node, 0, base({ options: { zeroDataRetention: false } })),
		).not.toHaveProperty('zero_data_retention');
		expect(buildScrapeBody(node, 0, base())).not.toHaveProperty('zero_data_retention');
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
			/Pick at least one Extract output, an Element or a Screenshot/,
		);
		expect(() =>
			buildScrapeBody(
				node,
				2,
				base({ extract: [], elements: { element: [{ name: 'heading', selector: 'h1' }] } }),
			),
		).not.toThrow();
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

describe('extract.elements', () => {
	const books = {
		selector: 'article.product_pod',
		all: true,
		fields: {
			title: { selector: 'h3 a', output: 'attribute', attribute: 'title' },
			price: '.price_color',
		},
	};

	it('turns the list into elements, using the short form for the text of the first match', () => {
		const body = buildScrapeBody(
			node,
			0,
			base({
				elements: {
					element: [
						{ name: 'heading', selector: ' h1 ', output: 'text', all: false },
						{ name: 'next_page', selector: 'li.next a', output: 'attribute', attribute: 'href' },
						{ name: 'prices', selector: '.price_color', output: 'text', all: true },
						{ name: 'card', selector: 'article', output: 'html', attribute: 'ignored' },
					],
				},
			}),
		);
		expect(body.extract).toMatchObject({
			elements: {
				heading: 'h1',
				next_page: { selector: 'li.next a', output: 'attribute', attribute: 'href' },
				prices: { selector: '.price_color', all: true },
				card: { selector: 'article', output: 'html' },
			},
		});
	});

	it('merges the list with Elements (JSON), given as text or as an object', () => {
		const list = { element: [{ name: 'heading', selector: 'h1' }] };
		const expected = { heading: 'h1', books };
		expect(
			buildScrapeBody(
				node,
				0,
				base({ elements: list, options: { elementsJson: JSON.stringify({ books }) } }),
			).extract,
		).toMatchObject({ elements: expected });
		expect(
			buildAsyncScrapeBody(node, 0, base({ elements: list, options: { elementsJson: { books } } }))
				.extract,
		).toMatchObject({ elements: expected });
	});

	it('rejects a name given twice, in the list or across the list and the JSON', () => {
		const row = { name: 'price', selector: '.price' };
		expect(() =>
			buildScrapeBody(node, 0, base({ elements: { element: [row, { ...row, selector: 'b' }] } })),
		).toThrow(/Element name "price" is used twice/);
		expect(() =>
			buildScrapeBody(
				node,
				0,
				base({ elements: { element: [row] }, options: { elementsJson: '{"price": "b"}' } }),
			),
		).toThrow(NodeOperationError);
	});

	it('sends nothing when the list and the JSON are empty', () => {
		for (const over of [
			{},
			{ elements: {} },
			{ elements: { element: [] } },
			{ options: { elementsJson: '' } },
			{ options: { elementsJson: '  ' } },
			{ options: { elementsJson: '{}' } },
		] as Partial<ScrapeParams>[]) {
			expect(buildScrapeBody(node, 0, base(over)).extract).not.toHaveProperty('elements');
		}
	});

	it('rejects a row without a name, selector or attribute', () => {
		expect(() =>
			buildScrapeBody(node, 0, base({ elements: { element: [{ name: ' ', selector: 'h1' }] } })),
		).toThrow(/needs a Name/);
		expect(() =>
			buildScrapeBody(node, 0, base({ elements: { element: [{ name: 'a', selector: '' }] } })),
		).toThrow(/"a" needs a CSS Selector/);
		expect(() =>
			buildScrapeBody(
				node,
				0,
				base({ elements: { element: [{ name: 'a', selector: 'a', output: 'attribute' }] } }),
			),
		).toThrow(/"a" needs an Attribute/);
	});

	it('skips a fully blank row but still rejects a half-filled one', () => {
		const blank = [
			{ name: '', selector: '' },
			{ name: ' ', selector: '  ', output: 'attribute' as const },
			{},
		];
		expect(
			buildScrapeBody(node, 0, base({ elements: { element: blank } })).extract,
		).not.toHaveProperty('elements');
		expect(
			buildScrapeBody(
				node,
				0,
				base({ elements: { element: [...blank, { name: 'heading', selector: 'h1' }] } }),
			).extract,
		).toMatchObject({ elements: { heading: 'h1' } });
		expect(() =>
			buildScrapeBody(
				node,
				0,
				base({ extract: [], elements: { element: [{ name: '', selector: '' }] } }),
			),
		).toThrow(/ask for nothing|Pick at least one/);
		expect(() =>
			buildScrapeBody(node, 0, base({ elements: { element: [{ name: '', selector: 'h1' }] } })),
		).toThrow(/needs a Name/);
		expect(() =>
			buildScrapeBody(node, 0, base({ elements: { element: [{ name: 'a', selector: ' ' }] } })),
		).toThrow(/"a" needs a CSS Selector/);
	});

	it('rejects Elements (JSON) that is not an object of selectors', () => {
		for (const bad of ['[]', '"h1"', 'null', '{"a": 1}', '{"a": ["h1"]}']) {
			expect(() => buildScrapeBody(node, 0, base({ options: { elementsJson: bad } }))).toThrow(
				/Elements \(JSON\) must be|in Elements \(JSON\) must be/,
			);
		}
	});

	it('says when Elements (JSON) is not valid JSON, with a short reason', () => {
		const error = (text: string) => {
			try {
				buildScrapeBody(node, 0, base({ options: { elementsJson: text } }));
			} catch (e) {
				return e as NodeOperationError;
			}
			throw new Error('expected an error');
		};
		const oops = error('{oops');
		expect(oops.message).toBe('Elements (JSON) is not valid JSON');
		expect(oops.description).toMatch(/position 1/);
		// a reason that quotes the input back is replaced by a plain hint
		const quoted = error('{"a": tru}');
		expect(quoted.message).toBe('Elements (JSON) is not valid JSON');
		expect(quoted.description).toBe('Check for a missing quote, comma or bracket.');
		expect(quoted.description).not.toContain('tru');
	});
});

describe('headers and cookies', () => {
	const withRows = (
		headers?: Array<{ name?: string; value?: string }>,
		cookies?: Array<{ name?: string; value?: string }>,
	) =>
		base({
			options: {
				...(headers ? { headers: { header: headers } } : {}),
				...(cookies ? { cookies: { cookie: cookies } } : {}),
			},
		});

	it('sends headers as an object and cookies as name/value pairs', () => {
		const body = buildScrapeBody(
			node,
			0,
			withRows(
				[
					{ name: 'Authorization', value: 'Bearer abc' },
					{ name: ' X-Tenant-Id ', value: 'acme' },
				],
				[{ name: 'session_id', value: 'a1b2c3' }],
			),
		);
		expect(body.headers).toEqual({ Authorization: 'Bearer abc', 'X-Tenant-Id': 'acme' });
		expect(body.cookies).toEqual([{ name: 'session_id', value: 'a1b2c3' }]);
	});

	it('omits both fields when the lists are untouched or empty', () => {
		expect(buildScrapeBody(node, 0, base())).not.toHaveProperty('headers');
		expect(buildScrapeBody(node, 0, base())).not.toHaveProperty('cookies');
		const empty = buildScrapeBody(node, 0, withRows([], []));
		expect(empty).not.toHaveProperty('headers');
		expect(empty).not.toHaveProperty('cookies');
		const noRows = buildScrapeBody(
			node,
			0,
			base({ options: { headers: {}, cookies: {} } as ScrapeParams['options'] }),
		);
		expect(noRows).not.toHaveProperty('headers');
		expect(noRows).not.toHaveProperty('cookies');
	});

	it('skips blank rows, and omits the field when every row is blank', () => {
		const body = buildScrapeBody(
			node,
			0,
			withRows(
				[{}, { name: ' ', value: '' }, { name: 'X-Key', value: 'k' }],
				[{ name: '', value: '  ' }, {}],
			),
		);
		expect(body.headers).toEqual({ 'X-Key': 'k' });
		expect(body).not.toHaveProperty('cookies');
	});

	it('sends values exactly as typed, for the api to check', () => {
		const body = buildScrapeBody(
			node,
			0,
			withRows([{ name: 'X-Key', value: ' padded ' }], [{ name: 'sid', value: 'a;b' }]),
		);
		expect(body.headers).toEqual({ 'X-Key': ' padded ' });
		expect(body.cookies).toEqual([{ name: 'sid', value: 'a;b' }]);
	});

	it('refuses a row with a Name but no Value, such as an expression that came back empty', () => {
		const cases: Array<[ScrapeParams, string]> = [
			[withRows([{ name: 'Authorization', value: '' }]), 'Header "Authorization" has no Value'],
			[withRows([{ name: 'Authorization' }]), 'Header "Authorization" has no Value'],
			[withRows([{ name: 'X-Key', value: '   ' }]), 'Header "X-Key" has no Value'],
			[withRows(undefined, [{ name: 'sid', value: '' }]), 'Cookie "sid" has no Value'],
		];
		for (const [params, message] of cases) {
			expect(() => buildScrapeBody(node, 0, params)).toThrow(message);
		}
	});

	it('turns a value set by an expression into a string', () => {
		const body = buildScrapeBody(
			node,
			0,
			withRows(
				[{ name: 'X-Count', value: 42 as unknown as string }],
				[{ name: 'n', value: 7 as unknown as string }],
			),
		);
		expect(body.headers).toEqual({ 'X-Count': '42' });
		expect(body.cookies).toEqual([{ name: 'n', value: '7' }]);
	});

	it('needs a name on a row that has a value', () => {
		expect(() => buildScrapeBody(node, 0, withRows([{ name: '', value: 'x' }]))).toThrow(
			/^Each Header needs a Name$/,
		);
		expect(() =>
			buildScrapeBody(node, 0, withRows(undefined, [{ name: ' ', value: 'x' }])),
		).toThrow(/^Each Cookie needs a Name$/);
	});

	it('refuses the same header name twice, whatever the case', () => {
		const err = (() => {
			try {
				buildScrapeBody(
					node,
					0,
					withRows([
						{ name: 'X-Key', value: 'a' },
						{ name: 'x-key', value: 'b' },
					]),
				);
			} catch (e) {
				return e;
			}
		})();
		expect(err).toBeInstanceOf(NodeOperationError);
		expect((err as Error).message).toBe('Header "x-key" is used twice');
	});

	it('keeps header and cookie values out of error messages', () => {
		const secret = 'Bearer s3cret';
		for (const params of [
			withRows([
				{ name: 'Authorization', value: secret },
				{ name: 'authorization', value: secret },
			]),
			withRows([{ name: '', value: secret }]),
			withRows(undefined, [{ name: '', value: secret }]),
		]) {
			try {
				buildScrapeBody(node, 0, params);
				expect.unreachable();
			} catch (e) {
				const error = e as NodeOperationError;
				expect(error.message).not.toContain('s3cret');
				expect(String(error.description ?? '')).not.toContain('s3cret');
			}
		}
	});

	it('does not count as an output on its own: headers alone still need one', () => {
		expect(() =>
			buildScrapeBody(
				node,
				0,
				base({ extract: [], options: { headers: { header: [{ name: 'X-Key', value: 'k' }] } } }),
			),
		).toThrow(/Pick at least one Extract output/);
	});

	it('carries both fields into the async body', () => {
		const body = buildAsyncScrapeBody(node, 0, {
			...withRows([{ name: 'X-Key', value: 'k' }], [{ name: 'sid', value: 'v' }]),
			webhookUrl: 'https://hook',
		});
		expect(body.headers).toEqual({ 'X-Key': 'k' });
		expect(body.cookies).toEqual([{ name: 'sid', value: 'v' }]);
		expect(body.webhook).toEqual({ url: 'https://hook' });
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
		).toThrow(/^Webhook Metadata is not valid JSON$/);
		expect(() =>
			buildAsyncScrapeBody(node, 0, base({ webhookUrl: 'https://hook', webhookMetadata: '[1]' })),
		).toThrow(/^Webhook Metadata must be a JSON object$/);
	});
});
