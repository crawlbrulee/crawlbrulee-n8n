import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['account'] } },
	options: [
		{
			name: 'Get Account Info',
			value: 'whoami',
			action: 'Get account info',
			description: 'The organization behind the API key: its name, the token name and a preview',
		},
		{
			name: 'Get Credit Usage',
			value: 'getUsage',
			action: 'Get credit usage',
			description:
				'Credits used and left in the current billing cycle, plus concurrency and the reset date',
		},
	],
	default: 'getUsage',
};
