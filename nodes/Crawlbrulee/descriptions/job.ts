import type { INodeProperties } from 'n8n-workflow';

export const jobOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['job'] } },
	options: [
		{
			name: 'Get Scrape Result',
			value: 'getScrapeResult',
			action: 'Get the result of a scrape job',
			description: 'Fetch the content of a finished async scrape',
		},
		{
			name: 'Get Scrape Status',
			value: 'getScrapeStatus',
			action: 'Get the status of a scrape job',
			description: 'Check whether an async scrape is pending, running, done or failed',
		},
	],
	default: 'getScrapeStatus',
};

export const jobFields: INodeProperties[] = [
	{
		displayName: 'Job ID',
		name: 'jobId',
		type: 'string',
		required: true,
		default: '',
		description: 'The job ID returned by Scrape (Async)',
		displayOptions: { show: { resource: ['job'], operation: ['getScrapeStatus', 'getScrapeResult'] } },
	},
];
