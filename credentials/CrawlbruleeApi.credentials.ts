import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class CrawlbruleeApi implements ICredentialType {
	name = 'crawlbruleeApi';

	displayName = 'Crawlbrulee API';

	documentationUrl = 'https://crawlbrulee.com/docs/authentication';

	icon: Icon = 'file:crawlbrulee.svg';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Your crawlbrulee API key (starts with cwbl_). Create one in the dashboard at dashboard.crawlbrulee.com.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.crawlbrulee.com',
			description: 'The API host. Leave as is unless you were given a different host.',
		},
		{
			displayName: 'Webhook Signing Secret',
			name: 'webhookSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Optional. Your organization webhook signing secret (starts with whsec_) from the dashboard. When set, the Crawlbrulee Trigger verifies every delivery and drops any that fail. When empty, deliveries are accepted without verification.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			// Same fallback the node uses, so a blank Base URL still tests production
			baseURL: '={{$credentials.baseUrl || "https://api.crawlbrulee.com"}}',
			url: '/api/whoami',
		},
	};
}
