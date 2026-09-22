import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { toNodeApiError } from './errors';

export type CrawlbruleeContext =
	| IExecuteFunctions
	| IWebhookFunctions
	| IHookFunctions
	| ILoadOptionsFunctions;

export const USER_AGENT = 'n8n-nodes-crawlbrulee/0.1.0';

export interface CrawlbruleeRequestArgs {
	method: 'GET' | 'POST';
	path: string;
	body?: IDataObject;
	itemIndex?: number;
}

interface CrawlbruleeCredentials {
	apiKey: string;
	baseUrl?: string;
	webhookSecret?: string;
}

function stripTrailingSlash(url: string): string {
	return url.replace(/\/+$/, '');
}

/** The one place this package talks to the crawlbrulee api. */
export async function crawlbruleeRequest(
	this: CrawlbruleeContext,
	args: CrawlbruleeRequestArgs,
): Promise<IDataObject> {
	const credentials = (await this.getCredentials(
		'crawlbruleeApi',
	)) as unknown as CrawlbruleeCredentials;
	const baseUrl = stripTrailingSlash(
		(credentials.baseUrl ?? '').trim() || 'https://api.crawlbrulee.com',
	);

	const options: IHttpRequestOptions = {
		method: args.method,
		url: `${baseUrl}${args.path}`,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		headers: { 'User-Agent': USER_AGENT },
	};
	if (args.body !== undefined) options.body = args.body;

	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'crawlbruleeApi',
		options,
	)) as {
		statusCode: number;
		body: unknown;
	};

	if (response.statusCode < 200 || response.statusCode >= 300) {
		throw toNodeApiError(this.getNode(), response.statusCode, response.body, args.itemIndex);
	}
	return response.body as IDataObject;
}
