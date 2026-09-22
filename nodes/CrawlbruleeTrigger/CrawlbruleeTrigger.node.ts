import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import type { ScrapeCompleteWebhook } from '@crawlbrulee/sdk';
import { crawlbruleeRequest } from '../Crawlbrulee/transport/request';
import { EVENT_ID_HEADER, getHeader, verifySignature, type HeaderBag } from './signature';

const SEEN_LIMIT = 500;

export class CrawlbruleeTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'crawlbrulee Trigger',
		name: 'crawlbruleeTrigger',
		icon: 'file:crawlbrulee.svg',
		group: ['trigger'],
		version: 1,
		subtitle: 'scrape.complete',
		description: 'Starts the workflow when a crawlbrulee async scrape finishes',
		defaults: { name: 'crawlbrulee Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'crawlbruleeApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					"Copy this node's webhook URL into the Webhook URL field of a Scrape URL (Async) operation. Each finished job posts one scrape.complete event here. Set the Webhook Signing Secret on the credential to verify deliveries.",
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Fetch Result',
				name: 'fetchResult',
				type: 'boolean',
				default: false,
				description:
					'Whether to fetch the scrape result when the job succeeded, so the item carries the page content under result',
			},
		],
	};

	// The crawlbrulee api has no webhook-subscription endpoint: the webhook url is
	// attached per job by the Scrape URL (Async) operation. So there is nothing to
	// register or remove remotely; these only satisfy n8n's lifecycle contract.
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		if (!req.rawBody) await req.readRawBody();
		const raw = req.rawBody ? req.rawBody.toString('utf8') : '';
		const headers = req.headers as HeaderBag;

		const credentials = (await this.getCredentials('crawlbruleeApi')) as { webhookSecret?: string };
		const secret = (credentials.webhookSecret ?? '').trim();
		if (secret) {
			const check = await verifySignature({ payload: raw, headers, secret });
			if (!check.verified) {
				this.logger.warn(`crawlbrulee webhook dropped: ${check.reason}`);
				return {};
			}
		}

		let envelope: ScrapeCompleteWebhook | undefined;
		try {
			envelope = JSON.parse(raw) as ScrapeCompleteWebhook;
		} catch {
			this.logger.warn('crawlbrulee webhook dropped: body is not json');
			return {};
		}
		if (
			envelope?.event !== 'scrape.complete' ||
			typeof envelope.data !== 'object' ||
			envelope.data === null
		) {
			this.logger.warn('crawlbrulee webhook dropped: not a scrape.complete event');
			return {};
		}

		const eventId = getHeader(headers, EVENT_ID_HEADER) || envelope.event_id;
		if (eventId && isDuplicate(this.getWorkflowStaticData('node'), eventId)) {
			return {};
		}

		const json: IDataObject = {
			event_id: envelope.event_id,
			timestamp: envelope.timestamp,
			...(envelope.data as unknown as IDataObject),
		};

		const fetchResult = this.getNodeParameter('fetchResult', false) as boolean;
		if (fetchResult && envelope.data.status === 'success') {
			try {
				json.result = await crawlbruleeRequest.call(this, {
					method: 'GET',
					path: `/api/scrape/result/${encodeURIComponent(envelope.data.job_id)}`,
				});
			} catch (error) {
				json.result_error = error instanceof Error ? error.message : String(error);
			}
		}

		return { workflowData: [[{ json }]] };
	}
}

/** Remember the last SEEN_LIMIT event ids in the node's static data; true when already seen. */
function isDuplicate(staticData: IDataObject, eventId: string): boolean {
	const seen = Array.isArray(staticData.seenEventIds) ? (staticData.seenEventIds as string[]) : [];
	if (seen.includes(eventId)) return true;
	seen.push(eventId);
	if (seen.length > SEEN_LIMIT) seen.splice(0, seen.length - SEEN_LIMIT);
	staticData.seenEventIds = seen;
	return false;
}
