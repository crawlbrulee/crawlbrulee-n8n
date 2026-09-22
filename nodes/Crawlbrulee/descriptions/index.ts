import type { INodeProperties } from 'n8n-workflow';
import { accountOperations } from './account';
import { mapFields, mapOperations } from './map';
import { scrapeFields, scrapeOperations } from './scrape';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Account', value: 'account' },
		{ name: 'Map', value: 'map' },
		{ name: 'Scrape', value: 'scrape' },
	],
	default: 'scrape',
};

export const crawlbruleeProperties: INodeProperties[] = [
	resourceProperty,
	scrapeOperations,
	mapOperations,
	accountOperations,
	...scrapeFields,
	...mapFields,
];
