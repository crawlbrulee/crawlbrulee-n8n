import type { INodeProperties } from 'n8n-workflow';
import { accountOperations } from './account';
import { jobFields, jobOperations } from './job';
import { pageFields, pageOperations } from './page';
import { siteFields, siteOperations } from './site';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Account', value: 'account' },
		{ name: 'Job', value: 'job' },
		{ name: 'Page', value: 'page' },
		{ name: 'Site', value: 'site' },
	],
	default: 'page',
};

export const crawlbruleeProperties: INodeProperties[] = [
	resourceProperty,
	pageOperations,
	jobOperations,
	siteOperations,
	accountOperations,
	...pageFields,
	...jobFields,
	...siteFields,
];
