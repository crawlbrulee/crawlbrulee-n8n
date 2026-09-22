import type { INodeProperties } from 'n8n-workflow';

export const proxyOption: INodeProperties = {
	displayName: 'Proxy',
	name: 'proxy',
	type: 'options',
	options: [
		{ name: 'Advanced', value: 'advanced', description: 'Enhanced proxy tier with a higher success rate on hard sites' },
		{ name: 'Auto', value: 'auto', description: 'Tries Basic first and moves to Advanced on failure. You are billed at the tier that delivered.' },
		{ name: 'Basic', value: 'basic', description: 'Datacenter proxy tier, lowest cost' },
	],
	default: 'auto',
	description: 'Proxy tier used to fetch the page',
};

export const cacheMaxAgeOption = (defaultText: string): INodeProperties => ({
	displayName: 'Cache Max Age',
	name: 'cacheMaxAge',
	type: 'string',
	default: '',
	placeholder: 'e.g. 3600',
	description: `Seconds, or an ISO-8601 cutoff. Cached results older than this are skipped. Default ${defaultText}.`,
});

export const countryOption: INodeProperties = {
	displayName: 'Country',
	name: 'country',
	type: 'string',
	default: '',
	placeholder: 'e.g. DE',
	description: 'ISO 3166-1 alpha-2 country code to fetch from',
};

export const localeOption: INodeProperties = {
	displayName: 'Locale',
	name: 'locale',
	type: 'string',
	default: '',
	placeholder: 'e.g. en-US',
	description: 'BCP-47 locale sent as Accept-Language and used by the browser when rendering JavaScript',
};
