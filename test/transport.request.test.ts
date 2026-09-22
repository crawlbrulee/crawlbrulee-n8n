import { describe, expect, it, vi } from 'vitest';
import { NodeApiError } from 'n8n-workflow';
import { crawlbruleeRequest, USER_AGENT } from '../nodes/Crawlbrulee/transport/request';
import pkg from '../package.json';

function ctx(
	response: { statusCode: number; body: unknown },
	baseUrl = 'https://api.crawlbrulee.com/',
) {
	const httpRequestWithAuthentication = vi.fn().mockResolvedValue(response);
	return {
		self: {
			getNode: () => ({
				name: 'Crawlbrulee',
				type: 'crawlbrulee',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			}),
			getCredentials: vi.fn().mockResolvedValue({ apiKey: 'k', baseUrl, webhookSecret: '' }),
			helpers: { httpRequestWithAuthentication },
		} as never,
		httpRequestWithAuthentication,
	};
}

describe('USER_AGENT', () => {
	it('carries the package version', () => {
		expect(USER_AGENT).toBe(`n8n-nodes-crawlbrulee/${pkg.version}`);
	});
});

describe('crawlbruleeRequest', () => {
	it('posts json through the authenticated helper and returns the body', async () => {
		const { self, httpRequestWithAuthentication } = ctx({ statusCode: 200, body: { ok: true } });
		const out = await crawlbruleeRequest.call(self, {
			method: 'POST',
			path: '/api/scrape',
			body: { url: 'https://x' },
		});
		expect(out).toEqual({ ok: true });
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith('crawlbruleeApi', {
			method: 'POST',
			url: 'https://api.crawlbrulee.com/api/scrape',
			body: { url: 'https://x' },
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
			headers: { 'User-Agent': USER_AGENT },
		});
	});

	it('sends GET without a body', async () => {
		const { self, httpRequestWithAuthentication } = ctx({ statusCode: 200, body: {} });
		await crawlbruleeRequest.call(self, { method: 'GET', path: '/api/usage' });
		expect(httpRequestWithAuthentication.mock.calls[0][1]).not.toHaveProperty('body');
	});

	it('maps a non-2xx to NodeApiError with the item index', async () => {
		const { self } = ctx({
			statusCode: 429,
			body: { name: 'too_many_requests', message: 'x', details: { retry_after_ms: 10 } },
		});
		await expect(
			crawlbruleeRequest.call(self, { method: 'GET', path: '/api/usage', itemIndex: 3 }),
		).rejects.toMatchObject({
			message: 'Crawlbrulee rate limit reached. Retry after 10 ms.',
			httpCode: '429',
			context: { itemIndex: 3 },
		});
		await expect(
			crawlbruleeRequest.call(self, { method: 'GET', path: '/api/usage' }),
		).rejects.toBeInstanceOf(NodeApiError);
	});

	it('falls back to the default base url when the credential base url is blank', async () => {
		const { self, httpRequestWithAuthentication } = ctx({ statusCode: 200, body: {} }, '');
		await crawlbruleeRequest.call(self, { method: 'GET', path: '/api/usage' });
		expect(httpRequestWithAuthentication.mock.calls[0][1]).toMatchObject({
			url: 'https://api.crawlbrulee.com/api/usage',
		});
	});
});
