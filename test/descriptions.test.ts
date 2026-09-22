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

	it('has a job id field on both job operations of the scrape resource', () => {
		expect(find('jobId')[0].displayOptions?.show?.resource).toEqual(['scrape']);
		expect(find('jobId')[0].displayOptions?.show?.operation?.sort()).toEqual([
			'getScrapeResult',
			'getScrapeStatus',
		]);
		expect(find('jobId')[0].required).toBe(true);
	});
});
