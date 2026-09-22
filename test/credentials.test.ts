import { describe, expect, it } from 'vitest';
import { CrawlbruleeApi } from '../credentials/CrawlbruleeApi.credentials';

describe('CrawlbruleeApi credential', () => {
	const cred = new CrawlbruleeApi();

	it('is named crawlbruleeApi and has the three fields', () => {
		expect(cred.name).toBe('crawlbruleeApi');
		expect(cred.properties.map((p) => p.name)).toEqual(['apiKey', 'baseUrl', 'webhookSecret']);
	});

	it('hides secrets and defaults the base url to production', () => {
		const byName = Object.fromEntries(cred.properties.map((p) => [p.name, p]));
		expect(byName.apiKey.typeOptions?.password).toBe(true);
		expect(byName.webhookSecret.typeOptions?.password).toBe(true);
		expect(byName.baseUrl.default).toBe('https://api.crawlbrulee.com');
	});

	it('authenticates with a bearer header and tests against whoami', () => {
		expect(cred.authenticate.properties.headers?.Authorization).toBe(
			'=Bearer {{$credentials.apiKey}}',
		);
		expect(cred.test.request.baseURL).toBe('={{$credentials.baseUrl}}');
		expect(cred.test.request.url).toBe('/api/whoami');
	});
});
