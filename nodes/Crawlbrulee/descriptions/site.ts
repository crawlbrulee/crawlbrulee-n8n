import type { INodeProperties } from 'n8n-workflow';
import { cacheMaxAgeOption, countryOption, proxyOption } from './shared';

export const siteOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['site'] } },
	options: [
		{
			name: 'Map',
			value: 'map',
			action: 'Map a site',
			description: 'Discover the URLs of a site from its sitemap and homepage links',
		},
	],
	default: 'map',
};

export const siteFields: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com',
		description: 'The site to map',
		displayOptions: { show: { resource: ['site'], operation: ['map'] } },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['site'], operation: ['map'] } },
		options: [
			cacheMaxAgeOption('7 days'),
			countryOption,
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
				description: 'Max number of results to return',
			},
			{
				displayName: 'Max URLs',
				name: 'maxUrls',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 100000 },
				default: 5000,
				description:
					'Stop discovery after this many URLs. A smaller value is a cheaper, faster map.',
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
				description: 'Whether to read only sitemap.xml and skip homepage link extraction',
			},
		],
	},
];
