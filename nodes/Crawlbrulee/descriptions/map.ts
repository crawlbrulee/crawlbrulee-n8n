import type { INodeProperties } from 'n8n-workflow';
import { cacheMaxAgeOption, countryOption, proxyOption, zeroDataRetentionOption } from './shared';

export const mapOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['map'] } },
	options: [
		{
			name: 'Map Website',
			value: 'map',
			action: 'Map website',
			description: 'Discover the URLs of a site from its sitemap and homepage links',
		},
	],
	default: 'map',
};

export const mapFields: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com',
		description: 'The site to map',
		displayOptions: { show: { resource: ['map'], operation: ['map'] } },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['map'], operation: ['map'] } },
		options: [
			cacheMaxAgeOption('7 days'),
			countryOption,
			{
				displayName: 'Depth',
				name: 'depth',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 3,
				description:
					"How many levels of nested sitemaps to follow: 0 to 3. The default, 3, reads the site's top sitemap files and 2 levels of nested ones. With Sitemap URL, level 0 is that file, and it is read. Without it, level 0 is the list of the site's top sitemap files, which 0 returns without reading their entries. A top file found at one of the usual addresses can still show as sitemap_index, because finding it shows its kind. A sitemap index holds only sitemap files, so reading one at a low depth with Entries on Pages returns no pages. Depth 1 with Entries on Sitemaps lists the site's top sitemap files and every file they list, in one call. A listed file shows as sitemap until a map opens it, even when it is a sitemap index. To go deeper, read a listed file with Sitemap URL, or ask with a higher depth.",
			},
			{
				displayName: 'Entries',
				name: 'entries',
				type: 'options',
				options: [
					{ name: 'All', value: 'all', description: 'Pages and sitemap files' },
					{ name: 'Pages', value: 'pages', description: 'Page addresses' },
					{
						name: 'Sitemaps',
						value: 'sitemaps',
						description:
							'Sitemap files, of type sitemap or sitemap_index, which you can read with Sitemap URL in another call',
					},
				],
				default: 'pages',
				description:
					'What to return. Each link carries its type: page, sitemap, or sitemap_index for a sitemap file that lists other sitemap files.',
			},
			{
				displayName: 'External',
				name: 'external',
				type: 'boolean',
				default: true,
				description: 'Whether to include links to other domains',
			},
			{
				displayName: 'Internal',
				name: 'internal',
				type: 'boolean',
				default: true,
				description: 'Whether to include links on the same domain',
			},
			{
				displayName: 'Internal Subdomains',
				name: 'internalSubdomains',
				type: 'boolean',
				default: true,
				description: 'Whether to include links to subdomains of the site',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 10000 },
				default: 50,
				// n8n's lint (and its review scan) requires this exact description for `limit`,
				// so the hint says what Limit means next to Max Results
				description: 'Max number of results to return',
				hint: 'Links per page of the answer. It only splits the answer into pages; Max Results sets how many the map finds.',
			},
			{
				// shown as Max Results; the name stays maxUrls so saved workflows keep their value
				displayName: 'Max Results',
				name: 'maxUrls',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 100000 },
				default: 5000,
				description:
					'The most entries the map finds, counting only the kind set in Entries. Discovery stops as soon as this many are found, so a smaller value is a faster and lighter map, not just a smaller answer.',
			},
			{
				displayName: 'Modified Since',
				name: 'modifiedSince',
				type: 'dateTime',
				default: '',
				description:
					"Return only entries whose lastmod is at or after this date and time. An entry with no lastmod is left out, and so is every link found on the home page. Every sitemap file is read whatever its own lastmod, and each entry is judged by its own lastmod. With Entries on Sitemaps, a sitemap file is returned by its own lastmod, not by the pages in it, so use Entries on Pages to find the pages that changed. A map with this set is always fresh, so Cache Max Age does nothing. The time is read in the workflow's time zone, unless it carries its own.",
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				description: '1-based page of results to return',
			},
			proxyOption,
			{
				displayName: 'Sitemap Only',
				name: 'sitemapOnly',
				type: 'boolean',
				default: false,
				description:
					'Whether to use the sitemaps only and leave out the links found on the home page. A map with Sitemap URL or Modified Since never adds them.',
			},
			{
				displayName: 'Sitemap URL',
				name: 'sitemapUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/sitemap-products.xml',
				description:
					'Start from this sitemap file, as a full http or https address. It must be on the same site, or on a host the site\'s robots.txt names, such as a CDN. Leave it empty to start from the site\'s own top sitemap files. <a href="https://crawlbrulee.com/docs/map/sitemaps#map-a-very-large-or-deep-site-in-several-calls">Map a big site in several calls</a>.',
			},
			zeroDataRetentionOption,
		],
	},
];
