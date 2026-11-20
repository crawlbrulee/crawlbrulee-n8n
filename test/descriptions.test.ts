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

	it('defaults extract to markdown + metadata and proxy to auto', () => {
		const extract = find('extract')[0];
		expect(extract.default).toEqual(['markdown', 'metadata']);
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
		expect(list.description).toContain('https://crawlbrulee.com/docs/scrape/targeted-extraction');
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
		expect(json.description).toContain('https://crawlbrulee.com/docs/scrape/targeted-extraction');
	});

	it('offers Headers and Cookies lists under Options on scrape and scrape async; only cookie values are hidden', () => {
		const owners = find('options', (p) =>
			(p.options as INodeProperties[]).some((o) => o.name === 'headers' || o.name === 'cookies'),
		);
		expect(owners).toHaveLength(1);
		expect(owners[0].displayOptions?.show?.operation).toEqual(['scrape', 'scrapeAsync']);
		const opts = owners[0].options as INodeProperties[];
		const cases: Array<[string, string, string, boolean | undefined]> = [
			['headers', 'Headers', 'header', undefined],
			['cookies', 'Cookies', 'cookie', true],
		];
		for (const [name, displayName, row, hidden] of cases) {
			const list = opts.find((o) => o.name === name)!;
			expect(list.displayName).toBe(displayName);
			expect(list.type).toBe('fixedCollection');
			expect(list.typeOptions?.multipleValues).toBe(true);
			expect(list.default).toEqual({});
			expect(list.description).toContain(
				'https://crawlbrulee.com/docs/scrape/custom-headers-and-cookies',
			);
			expect(list.description).toMatch(/never cached/);
			const groups = list.options as Array<{ name: string; values: INodeProperties[] }>;
			expect(groups.map((g) => g.name)).toEqual([row]);
			const values = groups[0].values;
			expect(values.map((v) => v.name)).toEqual(['name', 'value']);
			const value = values.find((v) => v.name === 'value')!;
			expect(value.typeOptions?.password).toBe(hidden);
			expect(values.find((v) => v.name === 'name')!.typeOptions?.password).toBeUndefined();
		}
		const headers = opts.find((o) => o.name === 'headers')!;
		expect(headers.description).toContain('custom_user_agent');
		expect(headers.description).toMatch(/only to the origin/);
		expect(opts.find((o) => o.name === 'cookies')!.description).toMatch(/only to the host/);
	});

	it('does not offer Headers or Cookies on Map Website', () => {
		const map = find('options', (p) => p.displayOptions?.show?.resource?.[0] === 'map')[0];
		expect(map).toBeDefined();
		const names = (map.options as INodeProperties[]).map((o) => o.name);
		expect(names).not.toContain('headers');
		expect(names).not.toContain('cookies');
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

	it('offers Color Scheme among the screenshot options, light by default', () => {
		const opts = find('screenshotOptions')[0].options as INodeProperties[];
		const scheme = opts.find((o) => o.name === 'colorScheme')!;
		expect(scheme.displayName).toBe('Color Scheme');
		expect(scheme.type).toBe('options');
		expect(scheme.default).toBe('light');
		expect((scheme.options as INodePropertyOptions[]).map((o) => o.value)).toEqual([
			'dark',
			'light',
		]);
		expect(scheme.description).toMatch(/No extra credits/);
	});

	it('offers a PDF switch on scrape and scrape async, with its options shown only when on', () => {
		const pdf = find('pdf')[0];
		expect(pdf.displayName).toBe('PDF');
		expect(pdf.type).toBe('boolean');
		expect(pdf.default).toBe(false);
		expect(pdf.displayOptions?.show?.operation).toEqual(['scrape', 'scrapeAsync']);
		expect(pdf.description).toMatch(/expires 24 hours after the scrape/);
		expect(pdf.description).toContain('https://crawlbrulee.com/docs/scrape/pdf');

		const options = find('pdfOptions')[0];
		expect(options.type).toBe('collection');
		expect(options.displayOptions?.show?.operation).toEqual(['scrape', 'scrapeAsync']);
		expect(options.displayOptions?.show?.pdf).toEqual([true]);
		const fields = options.options as INodeProperties[];
		expect(fields.map((f) => f.name)).toEqual(['landscape', 'layout', 'media', 'paper']);
		const values = (name: string) =>
			(fields.find((f) => f.name === name)!.options as INodePropertyOptions[]).map((o) => o.value);
		expect(values('layout')).toEqual(['pages', 'single_page']);
		expect(values('paper')).toEqual(['a4', 'letter']);
		expect(values('media')).toEqual(['print', 'screen']);
		expect(fields.find((f) => f.name === 'layout')!.default).toBe('pages');
		expect(fields.find((f) => f.name === 'paper')!.default).toBe('a4');
		expect(fields.find((f) => f.name === 'media')!.default).toBe('screen');
		expect(fields.find((f) => f.name === 'landscape')!.default).toBe(false);
	});

	it('offers Download PDF on Scrape URL (only with PDF on) and on a finished job', () => {
		const downloads = find('downloadPdf');
		expect(downloads).toHaveLength(2);
		const onScrape = downloads.find((p) => p.displayOptions?.show?.operation?.[0] === 'scrape')!;
		expect(onScrape.displayOptions?.show?.pdf).toEqual([true]);
		const onJob = downloads.find(
			(p) => p.displayOptions?.show?.operation?.[0] === 'getScrapeResult',
		)!;
		expect(onJob.displayOptions?.show?.pdf).toBeUndefined();
		for (const d of downloads) {
			expect(d.type).toBe('boolean');
			expect(d.default).toBe(false);
		}
	});

	it('keeps the released map option names, with Max URLs now labeled Max Results', () => {
		const map = find('options').find((p) => p.displayOptions?.show?.resource?.[0] === 'map')!;
		const fields = map.options as INodeProperties[];
		expect(fields.map((f) => f.name)).toEqual([
			'cacheMaxAge',
			'country',
			'depth',
			'entries',
			'external',
			'internal',
			'internalSubdomains',
			'limit',
			'maxUrls',
			'modifiedSince',
			'page',
			'proxy',
			'sitemapOnly',
			'sitemapUrl',
			'zeroDataRetention',
		]);
		const maxUrls = fields.find((f) => f.name === 'maxUrls')!;
		expect(maxUrls.displayName).toBe('Max Results');
		expect(maxUrls.default).toBe(5000);
		const depth = fields.find((f) => f.name === 'depth')!;
		expect(depth.default).toBe(3);
		// no maximum here: the api sets it and can raise it without a node release
		expect(depth.typeOptions).toEqual({ minValue: 0 });
		const entries = fields.find((f) => f.name === 'entries')!;
		expect(entries.default).toBe('pages');
		expect((entries.options as INodePropertyOptions[]).map((o) => o.value)).toEqual([
			'all',
			'pages',
			'sitemaps',
		]);
		// every link type the api returns is named, so a user can tell an index from a leaf
		expect(entries.description).toContain('sitemap_index');
		expect(fields.find((f) => f.name === 'modifiedSince')!.type).toBe('dateTime');
		expect(fields.find((f) => f.name === 'sitemapUrl')!.description).toContain(
			'https://crawlbrulee.com/docs/map',
		);
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
