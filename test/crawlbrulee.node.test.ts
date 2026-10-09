import { describe, expect, it, vi } from 'vitest';
import { Crawlbrulee } from '../nodes/Crawlbrulee/Crawlbrulee.node';

type Params = Record<string, unknown>;

function ctx(
	params: Params,
	response: { statusCode: number; body: unknown },
	items = 1,
	continueOnFail = false,
) {
	const httpRequestWithAuthentication = vi.fn().mockResolvedValue(response);
	const self = {
		getInputData: () => Array.from({ length: items }, () => ({ json: {} })),
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		getNode: () => ({
			name: 'Crawlbrulee',
			type: 'crawlbrulee',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getCredentials: vi.fn().mockResolvedValue({
			apiKey: 'k',
			baseUrl: 'https://api.crawlbrulee.com',
			webhookSecret: '',
		}),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication,
			httpRequest: vi.fn().mockResolvedValue(new ArrayBuffer(2)),
			prepareBinaryData: vi
				.fn()
				.mockResolvedValue({ data: 'AA', fileName: 'f', mimeType: 'image/png' }),
		},
	};
	return { self: self as never, httpRequestWithAuthentication };
}

const node = new Crawlbrulee();

// A 404 page: billed like any page, so every cost part is filled in.
const usage404 = {
	total_credit_cost: 15,
	engine_credit_cost: 3,
	proxy_multiplier: 5,
	screenshot_slicing_credit_cost: 0,
	zero_data_retention_credit_cost: 0,
	engine: 'browser',
	proxy: 'advanced',
};

describe('Crawlbrulee node', () => {
	it('describes itself for verification', () => {
		expect(node.description.name).toBe('crawlbrulee');
		expect(node.description.usableAsTool).toBe(true);
		expect(node.description.credentials).toEqual([{ name: 'crawlbruleeApi', required: true }]);
		expect(node.description.subtitle).toBe('={{ $parameter["operation"] }}');
	});

	it('scrapes a page and returns the body with pairedItem', async () => {
		const { self, httpRequestWithAuthentication } = ctx(
			{
				resource: 'scrape',
				operation: 'scrape',
				url: 'https://example.com',
				extract: ['markdown'],
				screenshotType: 'none',
				screenshotOptions: {},
				options: {},
			},
			{
				statusCode: 200,
				body: {
					url: 'https://example.com',
					markdown: '# hi',
					response_meta: { usage: { total_credit_cost: 1 } },
				},
			},
		);
		const [out] = await node.execute.call(self);
		expect(out[0].json.markdown).toBe('# hi');
		expect(out[0].pairedItem).toEqual({ item: 0 });
		const call = httpRequestWithAuthentication.mock.calls[0][1];
		expect(call.url).toBe('https://api.crawlbrulee.com/api/scrape');
		expect(call.body.extract.markdown).toBe(true);
	});

	it('routes every operation to its endpoint', async () => {
		const cases: Array<[Params, string, string]> = [
			[
				{
					resource: 'scrape',
					operation: 'scrapeAsync',
					url: 'https://x',
					extract: ['markdown'],
					screenshotType: 'none',
					screenshotOptions: {},
					options: {},
					webhookUrl: '',
					webhookMetadata: '',
				},
				'POST',
				'/api/scrape/async',
			],
			[
				{ resource: 'scrape', operation: 'getScrapeStatus', jobId: 'job 1' },
				'GET',
				'/api/scrape/status/job%201',
			],
			[
				{ resource: 'scrape', operation: 'getScrapeResult', jobId: 'j' },
				'GET',
				'/api/scrape/result/j',
			],
			[{ resource: 'map', operation: 'map', url: 'https://x', options: {} }, 'POST', '/api/map'],
			[{ resource: 'account', operation: 'getUsage' }, 'GET', '/api/usage'],
			[{ resource: 'account', operation: 'whoami' }, 'GET', '/api/whoami'],
		];
		for (const [params, method, path] of cases) {
			const { self, httpRequestWithAuthentication } = ctx(params, { statusCode: 200, body: {} });
			await node.execute.call(self);
			const call = httpRequestWithAuthentication.mock.calls[0][1];
			expect(call.method).toBe(method);
			expect(call.url).toBe(`https://api.crawlbrulee.com${path}`);
		}
	});

	it('returns a page the site answered with 404 as a normal item, fields untouched', async () => {
		const page = {
			url: 'https://example.com/missing',
			requested_url: 'https://example.com/missing',
			page_status_code: 404,
			content_type: 'text/html',
			markdown: '# Page not found',
			response_meta: { usage: usage404 },
			warnings: [],
			some_future_field: { kept: true },
		};
		const cases: Params[] = [
			{
				resource: 'scrape',
				operation: 'scrape',
				url: 'https://example.com/missing',
				extract: ['markdown'],
				screenshotType: 'none',
				screenshotOptions: {},
				options: {},
			},
			{ resource: 'scrape', operation: 'getScrapeResult', jobId: 'j' },
		];
		for (const params of cases) {
			const { self } = ctx(params, { statusCode: 200, body: page });
			const [out] = await node.execute.call(self);
			expect(out).toHaveLength(1);
			expect(out[0].json).toEqual(page);
			expect(out[0].json).not.toHaveProperty('error');
		}
	});

	it('sends extract.elements and returns elements as the api gives them', async () => {
		const elements = {
			heading: 'All products',
			books: [{ title: 'A Light in the Attic', price: '£51.77', url: null }],
			next_page: 'https://books.toscrape.com/catalogue/page-2.html',
		};
		const body = { url: 'https://books.toscrape.com/', elements, warnings: ['elements_truncated'] };
		const { self, httpRequestWithAuthentication } = ctx(
			{
				resource: 'scrape',
				operation: 'scrape',
				url: 'https://books.toscrape.com/',
				extract: [],
				elements: {
					element: [
						{ name: 'heading', selector: 'h1', output: 'text', all: false },
						{ name: 'next_page', selector: 'li.next a', output: 'attribute', attribute: 'href' },
					],
				},
				screenshotType: 'none',
				screenshotOptions: {},
				options: {
					elementsJson:
						'{"books": {"selector": "article.product_pod", "all": true, "fields": {"price": ".price_color"}}}',
				},
			},
			{ statusCode: 200, body },
		);
		const [out] = await node.execute.call(self);
		expect(out[0].json).toEqual(body);
		const sent = httpRequestWithAuthentication.mock.calls[0][1].body.extract.elements;
		expect(sent).toEqual({
			heading: 'h1',
			next_page: { selector: 'li.next a', output: 'attribute', attribute: 'href' },
			books: { selector: 'article.product_pod', all: true, fields: { price: '.price_color' } },
		});
	});

	it('passes the map usage fields through', async () => {
		const body = {
			links: [],
			response_meta: {
				usage: {
					total_credit_cost: 1,
					engine_credit_cost: 1,
					proxy_multiplier: 1,
					zero_data_retention_credit_cost: 1,
					engine: 'http',
					proxy: 'basic',
				},
			},
		};
		const { self } = ctx(
			{ resource: 'map', operation: 'map', url: 'https://x', options: {} },
			{ statusCode: 200, body },
		);
		const [out] = await node.execute.call(self);
		expect(out[0].json).toEqual(body);
	});

	it('still reads an older response without page_status_code or the new usage fields', async () => {
		const body = {
			url: 'https://x',
			markdown: '# hi',
			response_meta: {
				usage: { engine: 'http', proxy: 'basic' },
			},
		};
		const { self } = ctx(
			{ resource: 'scrape', operation: 'getScrapeResult', jobId: 'j' },
			{ statusCode: 200, body },
		);
		const [out] = await node.execute.call(self);
		expect(out[0].json).toEqual(body);
	});

	it('fails the item on a 502 target_unreachable, or records it with continueOnFail', async () => {
		const params = {
			resource: 'scrape',
			operation: 'scrape',
			url: 'https://nowhere.invalid',
			extract: ['markdown'],
			screenshotType: 'none',
			screenshotOptions: {},
			options: {},
		};
		const bad = {
			statusCode: 502,
			body: { name: 'target_unreachable', message: 'Could not reach the target site.' },
		};
		await expect(node.execute.call(ctx(params, bad).self)).rejects.toThrow(
			/could not reach the target site/,
		);
		const [out] = await node.execute.call(ctx(params, bad, 1, true).self);
		expect(out[0].json.error).toMatch(/could not reach the target site/);
	});

	it('attaches binary when Download Screenshot is on', async () => {
		const { self } = ctx(
			{
				resource: 'scrape',
				operation: 'scrape',
				url: 'https://x',
				extract: [],
				screenshotType: 'viewport',
				screenshotOptions: {},
				downloadScreenshot: true,
				options: {},
			},
			{
				statusCode: 200,
				body: {
					screenshot: {
						url: 'https://cdn/a.png',
						type: 'viewport',
						properties: {
							file_name: 'a.png',
							mime: 'image/png',
							width: 1,
							height: 1,
							viewport: { width: 1, height: 1, device_scale_factor: 1 },
						},
					},
				},
			},
		);
		const [out] = await node.execute.call(self);
		expect(out[0].binary).toHaveProperty('screenshot');
	});

	it('attaches binary on a job result when Download Screenshot is on', async () => {
		const { self } = ctx(
			{ resource: 'scrape', operation: 'getScrapeResult', jobId: 'j', downloadScreenshot: true },
			{
				statusCode: 200,
				body: {
					screenshot: {
						url: 'https://cdn/b.png',
						type: 'viewport',
						properties: {
							file_name: 'b.png',
							mime: 'image/png',
							width: 1,
							height: 1,
							viewport: { width: 1, height: 1, device_scale_factor: 1 },
						},
					},
				},
			},
		);
		const [out] = await node.execute.call(self);
		expect(out[0].binary).toHaveProperty('screenshot');
	});

	it('runs every input item and pairs each failure with its own index', async () => {
		const { self } = ctx(
			{ resource: 'account', operation: 'whoami' },
			{ statusCode: 401, body: { name: 'invalid_credentials', message: 'nope' } },
			2,
			true,
		);
		const [out] = await node.execute.call(self);
		expect(out).toHaveLength(2);
		expect(out[0].json.error).toMatch(/rejected the API key/);
		expect(out[1].json.error).toMatch(/rejected the API key/);
		expect(out.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
	});

	it('throws the mapped api error, or records it with continueOnFail', async () => {
		const params = { resource: 'account', operation: 'whoami' };
		const bad = { statusCode: 401, body: { name: 'invalid_credentials', message: 'nope' } };
		await expect(node.execute.call(ctx(params, bad).self)).rejects.toThrow(/rejected the API key/);
		const [out] = await node.execute.call(ctx(params, bad, 1, true).self);
		expect(out[0].json.error).toMatch(/rejected the API key/);
		expect(out[0].pairedItem).toEqual({ item: 0 });
	});

	it('asks for a Job ID when the field is blank or whitespace', async () => {
		for (const operation of ['getScrapeStatus', 'getScrapeResult']) {
			for (const jobId of ['', '   ']) {
				const { self, httpRequestWithAuthentication } = ctx(
					{ resource: 'scrape', operation, jobId },
					{ statusCode: 200, body: {} },
				);
				await expect(node.execute.call(self)).rejects.toThrow(/Job ID is required/);
				expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
			}
		}
	});

	it('rejects an unknown operation', async () => {
		await expect(
			node.execute.call(
				ctx({ resource: 'scrape', operation: 'nope' }, { statusCode: 200, body: {} }).self,
			),
		).rejects.toThrow(/not supported/);
	});
});
