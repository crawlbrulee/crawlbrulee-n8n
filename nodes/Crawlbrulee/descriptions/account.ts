import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['account'] } },
	options: [
		{
			name: 'Get Usage',
			value: 'getUsage',
			action: 'Get credit usage',
			description:
				'Credits used and left in the current billing cycle, plus concurrency and the reset date',
		},
		{
			name: 'Whoami',
			value: 'whoami',
			action: 'Get the organization behind the API key',
			description: 'Organization name, token name and a token preview',
		},
	],
	default: 'getUsage',
};
