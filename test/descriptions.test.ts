import { describe, expect, it } from 'vitest';
import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { crawlbruleeProperties } from '../nodes/Crawlbrulee/descriptions';

const find = (name: string, pred?: (p: INodeProperties) => boolean) =>
	crawlbruleeProperties.filter((p) => p.name === name && (!pred || pred(p)));

describe('crawlbrulee node properties', () => {
	it('lists the three resources and seven operations', () => {
		const resource = find('resource')[0];
		expect((resource.options as INodePropertyOptions[]).map((o) => o.value)).toEqual([
			'account',
			'map',
			'scrape',
		]);
		expect(resource.default).toBe('scrape');
		const ops = find('operation').flatMap((p) =>
			(p.options as INodePropertyOptions[]).map((o) => o.value),
		);
		expect(ops.sort()).toEqual([
			'getScrapeResult',
			'getScrapeStatus',
			'getUsage',
			'map',
			'scrape',
			'scrapeAsync',
			'whoami',
		]);
	});

	it('defaults extract to cleaned html + metadata and proxy to auto', () => {
		const extract = find('extract')[0];
		expect(extract.default).toEqual(['cleaned_html', 'metadata']);
		const options = find(
			'options',
			(p) => p.displayOptions?.show?.operation?.includes('scrape') === true,
		)[0];
		const proxy = (options.options as INodeProperties[]).find((o) => o.name === 'proxy')!;
		expect(proxy.default).toBe('auto');
	});

	it('offers Zero data retention, off by default, on scrape, scrape async and map', () => {
		const collections = find('options', (p) => p.displayOptions?.show?.resource !== undefined);
		const owners = collections.filter((c) =>
			(c.options as INodeProperties[]).some((o) => o.name === 'zeroDataRetention'),
		);
		expect(
			owners
				.map((c) => c.displayOptions?.show?.resource)
				.flat()
				.sort(),
		).toEqual(['map', 'scrape']);
		const flag = (owners[0].options as INodeProperties[]).find(
			(o) => o.name === 'zeroDataRetention',
		)!;
		expect(flag.displayName).toBe('Zero Data Retention');
		expect(flag.type).toBe('boolean');
		expect(flag.default).toBe(false);
		expect(flag.description).toMatch(/1 credit/);
		expect(flag.description).toMatch(/kept for 24 hours, then deleted/);
	});

	it('offers the Elements list and Elements (JSON) on scrape and scrape async', () => {
		const list = find('elements')[0];
		expect(list.type).toBe('fixedCollection');
		expect(list.typeOptions?.multipleValues).toBe(true);
		expect(list.displayOptions?.show?.operation).toEqual(['scrape', 'scrapeAsync']);
		expect(list.description).toContain('https://crawlbrulee.com/docs/scrape/elements');
		const values = (list.options as Array<{ values: INodeProperties[] }>)[0].values;
		expect(values.map((v) => v.name).sort()).toEqual([
			'all',
			'attribute',
			'name',
			'output',
			'selector',
		]);
		const attribute = values.find((v) => v.name === 'attribute')!;
		expect(attribute.displayOptions?.show?.output).toEqual(['attribute']);
		expect(values.find((v) => v.name === 'output')!.default).toBe('text');
		expect(values.find((v) => v.name === 'all')!.default).toBe(false);

		const options = find(
			'options',
			(p) => p.displayOptions?.show?.operation?.includes('scrape') === true,
		)[0];
		const json = (options.options as INodeProperties[]).find((o) => o.name === 'elementsJson')!;
		expect(json.displayName).toBe('Elements (JSON)');
		expect(json.type).toBe('json');
		expect(json.description).toContain('https://crawlbrulee.com/docs/scrape/elements');
	});

	it('shows webhook fields only for async scrape', () => {
		expect(find('webhookUrl')[0].displayOptions?.show?.operation).toEqual(['scrapeAsync']);
		expect(find('webhookMetadata')[0].displayOptions?.show?.operation).toEqual(['scrapeAsync']);
	});

	it('shows screenshot options only when a screenshot type is chosen', () => {
		expect(find('screenshotOptions')[0].displayOptions?.show?.screenshotType).toEqual([
			'full_page',
			'viewport',
		]);
		const scrapeDownload = find(
			'downloadScreenshot',
			(p) => p.displayOptions?.show?.operation?.includes('scrape') === true,
		)[0];
		expect(scrapeDownload.displayOptions?.show?.resource).toEqual(['scrape']);
		expect(scrapeDownload.displayOptions?.show?.operation).toEqual(['scrape']);
		expect(scrapeDownload.displayOptions?.show?.screenshotType).toEqual(['full_page', 'viewport']);
	});

	it('offers the screenshot download on a finished job too', () => {
		const jobDownload = find(
			'downloadScreenshot',
			(p) => p.displayOptions?.show?.operation?.includes('getScrapeResult') === true,
		)[0];
		expect(jobDownload).toBeDefined();
		expect(jobDownload.displayOptions?.show?.resource).toEqual(['scrape']);
		expect(jobDownload.displayOptions?.show?.operation).toEqual(['getScrapeResult']);
		expect(jobDownload.default).toBe(false);
	});

	it('tells the user where the page status is, on the operations that return a page', () => {
		const notice = find('pageStatusNotice')[0];
		expect(notice.type).toBe('notice');
		expect(notice.displayOptions?.show?.resource).toEqual(['scrape']);
		expect(notice.displayOptions?.show?.operation).toEqual(['scrape', 'getScrapeResult']);
		expect(notice.displayName).toContain('page_status_code');
		const ops = find('operation', (p) => p.displayOptions?.show?.resource?.[0] === 'scrape')[0]
			.options as INodePropertyOptions[];
		for (const value of ['scrape', 'getScrapeResult']) {
			expect(ops.find((o) => o.value === value)?.description).toContain('page_status_code');
		}
	});

	it('has a job id field on both job operations of the scrape resource', () => {
		expect(find('jobId')[0].displayOptions?.show?.resource).toEqual(['scrape']);
		expect(find('jobId')[0].displayOptions?.show?.operation?.sort()).toEqual([
			'getScrapeResult',
			'getScrapeStatus',
		]);
		expect(find('jobId')[0].required).toBe(true);
	});
});
