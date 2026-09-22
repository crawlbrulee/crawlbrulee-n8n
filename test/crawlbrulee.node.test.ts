import { describe, expect, it, vi } from 'vitest';
import { Crawlbrulee } from '../nodes/Crawlbrulee/Crawlbrulee.node';

type Params = Record<string, unknown>;

function ctx(params: Params, response: { statusCode: number; body: unknown }, items = 1, continueOnFail = false) {
	const httpRequestWithAuthentication = vi.fn().mockResolvedValue(response);
	const self = {
		getInputData: () => Array.from({ length: items }, () => ({ json: {} })),
		getNodeParameter: (name: string, _i: number, fallback?: unknown) => (name in params ? params[name] : fallback),
		getNode: () => ({ name: 'Crawlbrulee', type: 'crawlbrulee', typeVersion: 1, position: [0, 0], parameters: {} }),
		getCredentials: vi.fn().mockResolvedValue({ apiKey: 'k', baseUrl: 'https://api.crawlbrulee.com', webhookSecret: '' }),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication,
			httpRequest: vi.fn().mockResolvedValue(new ArrayBuffer(2)),
			prepareBinaryData: vi.fn().mockResolvedValue({ data: 'AA', fileName: 'f', mimeType: 'image/png' }),
		},
	};
	return { self: self as never, httpRequestWithAuthentication };
}

const node = new Crawlbrulee();

describe('Crawlbrulee node', () => {
	it('describes itself for verification', () => {
		expect(node.description.name).toBe('crawlbrulee');
		expect(node.description.usableAsTool).toBe(true);
		expect(node.description.credentials).toEqual([{ name: 'crawlbruleeApi', required: true }]);
		expect(node.description.subtitle).toBe('={{ $parameter["operation"] + ": " + $parameter["resource"] }}');
	});

	it('scrapes a page and returns the body with pairedItem', async () => {
		const { self, httpRequestWithAuthentication } = ctx(
			{ resource: 'page', operation: 'scrape', url: 'https://example.com', extract: ['markdown'], screenshotType: 'none', screenshotOptions: {}, options: {} },
			{ statusCode: 200, body: { url: 'https://example.com', markdown: '# hi', response_meta: { usage: { credits: 1 } } } },
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
			[{ resource: 'page', operation: 'scrapeAsync', url: 'https://x', extract: [], screenshotType: 'none', screenshotOptions: {}, options: {}, webhookUrl: '', webhookMetadata: '' }, 'POST', '/api/scrape/async'],
			[{ resource: 'job', operation: 'getScrapeStatus', jobId: 'job 1' }, 'GET', '/api/scrape/status/job%201'],
			[{ resource: 'job', operation: 'getScrapeResult', jobId: 'j' }, 'GET', '/api/scrape/result/j'],
			[{ resource: 'site', operation: 'map', url: 'https://x', options: {} }, 'POST', '/api/map'],
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

	it('attaches binary when Download Screenshot is on', async () => {
		const { self } = ctx(
			{ resource: 'page', operation: 'scrape', url: 'https://x', extract: [], screenshotType: 'viewport', screenshotOptions: {}, downloadScreenshot: true, options: {} },
			{ statusCode: 200, body: { screenshot: { url: 'https://cdn/a.png', type: 'viewport', properties: { file_name: 'a.png', mime: 'image/png', width: 1, height: 1, viewport: { width: 1, height: 1, device_scale_factor: 1 } } } } },
		);
		const [out] = await node.execute.call(self);
		expect(out[0].binary).toHaveProperty('screenshot');
	});

	it('attaches binary on a job result when Download Screenshot is on', async () => {
		const { self } = ctx(
			{ resource: 'job', operation: 'getScrapeResult', jobId: 'j', downloadScreenshot: true },
			{ statusCode: 200, body: { screenshot: { url: 'https://cdn/b.png', type: 'viewport', properties: { file_name: 'b.png', mime: 'image/png', width: 1, height: 1, viewport: { width: 1, height: 1, device_scale_factor: 1 } } } } },
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

	it('rejects an unknown operation', async () => {
		await expect(node.execute.call(ctx({ resource: 'page', operation: 'nope' }, { statusCode: 200, body: {} }).self)).rejects.toThrow(/not supported/);
	});
});
