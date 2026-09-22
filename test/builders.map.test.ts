import { describe, expect, it } from 'vitest';
import { buildMapBody } from '../nodes/Crawlbrulee/builders/map';

const node = { name: 'Crawlbrulee', type: 'crawlbrulee', typeVersion: 1, position: [0, 0], parameters: {} } as never;

describe('buildMapBody', () => {
	it('sends only the url when Options is untouched', () => {
		expect(buildMapBody(node, 0, { url: 'https://example.com', options: {} })).toEqual({ url: 'https://example.com' });
	});

	it('maps every option', () => {
		expect(
			buildMapBody(node, 0, {
				url: 'https://example.com',
				options: {
					sitemapOnly: true, internal: true, internalSubdomains: false, external: false,
					maxUrls: 100, page: 2, limit: 50, proxy: 'basic', cacheMaxAge: '86400', country: 'US',
				},
			}),
		).toEqual({
			url: 'https://example.com',
			sitemap_only: true,
			types: { internal: true, internal_subdomains: false, external: false },
			max_urls: 100,
			page: 2,
			limit: 50,
			proxy: 'basic',
			cache: { max_age: 86400 },
			location: { country: 'US' },
		});
	});

	it('does not send sitemap_only: false', () => {
		expect(buildMapBody(node, 0, { url: 'https://x', options: { sitemapOnly: false } })).toEqual({ url: 'https://x' });
	});
});
