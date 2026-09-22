import type {
	IDataObject,
	IExecuteFunctions,
	INode,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { attachScreenshots } from './binary';
import { buildMapBody, type MapParams } from './builders/map';
import { buildAsyncScrapeBody, buildScrapeBody, type ScrapeParams } from './builders/scrape';
import { crawlbruleeProperties } from './descriptions';
import { crawlbruleeRequest } from './transport/request';

export class Crawlbrulee implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'crawlbrulee',
		name: 'crawlbrulee',
		icon: 'file:crawlbrulee.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] }}',
		description:
			"Scrape any URL to Markdown, HTML, links, images, metadata or a screenshot, and map a site's URLs",
		defaults: { name: 'crawlbrulee' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'crawlbruleeApi', required: true }],
		properties: crawlbruleeProperties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const item = await runOperation.call(this, resource, operation, i);
				returnData.push({ ...item, pairedItem: { item: i } });
			} catch (error) {
				const failure = asNodeError(this.getNode(), error, i);
				if (this.continueOnFail()) {
					returnData.push({ json: { error: failure.message }, pairedItem: { item: i } });
					continue;
				}
				throw failure;
			}
		}
		return [returnData];
	}
}

/** Our own errors pass through; anything unexpected is wrapped so the UI keeps the node context. */
function asNodeError(node: INode, error: unknown, itemIndex: number): Error {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;
	return new NodeOperationError(node, error as Error, { itemIndex });
}

function scrapeParams(this: IExecuteFunctions, i: number): ScrapeParams {
	return {
		url: this.getNodeParameter('url', i) as string,
		extract: this.getNodeParameter('extract', i, []) as ScrapeParams['extract'],
		screenshotType: this.getNodeParameter(
			'screenshotType',
			i,
			'none',
		) as ScrapeParams['screenshotType'],
		screenshotOptions: this.getNodeParameter(
			'screenshotOptions',
			i,
			{},
		) as ScrapeParams['screenshotOptions'],
		options: this.getNodeParameter('options', i, {}) as ScrapeParams['options'],
		webhookUrl: this.getNodeParameter('webhookUrl', i, '') as string,
		webhookMetadata: this.getNodeParameter(
			'webhookMetadata',
			i,
			'',
		) as ScrapeParams['webhookMetadata'],
	};
}

/** The path segment for a job operation. Blank is a user mistake, not an api call. */
function jobIdSegment(node: INode, raw: unknown, itemIndex: number): string {
	const jobId = String(raw ?? '').trim();
	if (jobId === '') {
		throw new NodeOperationError(node, 'Job ID is required', {
			itemIndex,
			description: 'Set the Job ID field to the id returned by Scrape URL (Async).',
		});
	}
	return encodeURIComponent(jobId);
}

async function scrapeAndMaybeDownload(
	this: IExecuteFunctions,
	i: number,
	json: IDataObject,
): Promise<INodeExecutionData> {
	const download = this.getNodeParameter('downloadScreenshot', i, false) as boolean;
	if (!download) return { json };
	const binary = await attachScreenshots.call(this, json);
	return binary ? { json, binary } : { json };
}

async function runOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<INodeExecutionData> {
	const node = this.getNode();
	const key = `${resource}:${operation}`;
	switch (key) {
		case 'scrape:scrape': {
			const body = buildScrapeBody(node, i, scrapeParams.call(this, i)) as unknown as IDataObject;
			const json = await crawlbruleeRequest.call(this, {
				method: 'POST',
				path: '/api/scrape',
				body,
				itemIndex: i,
			});
			return scrapeAndMaybeDownload.call(this, i, json);
		}
		case 'scrape:scrapeAsync': {
			const body = buildAsyncScrapeBody(
				node,
				i,
				scrapeParams.call(this, i),
			) as unknown as IDataObject;
			return {
				json: await crawlbruleeRequest.call(this, {
					method: 'POST',
					path: '/api/scrape/async',
					body,
					itemIndex: i,
				}),
			};
		}
		case 'scrape:getScrapeStatus': {
			const jobId = jobIdSegment(node, this.getNodeParameter('jobId', i), i);
			return {
				json: await crawlbruleeRequest.call(this, {
					method: 'GET',
					path: `/api/scrape/status/${jobId}`,
					itemIndex: i,
				}),
			};
		}
		case 'scrape:getScrapeResult': {
			const jobId = jobIdSegment(node, this.getNodeParameter('jobId', i), i);
			const json = await crawlbruleeRequest.call(this, {
				method: 'GET',
				path: `/api/scrape/result/${jobId}`,
				itemIndex: i,
			});
			return scrapeAndMaybeDownload.call(this, i, json);
		}
		case 'map:map': {
			const params: MapParams = {
				url: this.getNodeParameter('url', i) as string,
				options: this.getNodeParameter('options', i, {}) as MapParams['options'],
			};
			const body = buildMapBody(node, i, params) as unknown as IDataObject;
			return {
				json: await crawlbruleeRequest.call(this, {
					method: 'POST',
					path: '/api/map',
					body,
					itemIndex: i,
				}),
			};
		}
		case 'account:getUsage':
			return {
				json: await crawlbruleeRequest.call(this, {
					method: 'GET',
					path: '/api/usage',
					itemIndex: i,
				}),
			};
		case 'account:whoami':
			return {
				json: await crawlbruleeRequest.call(this, {
					method: 'GET',
					path: '/api/whoami',
					itemIndex: i,
				}),
			};
		default:
			throw new NodeOperationError(
				node,
				`The operation "${operation}" is not supported for resource "${resource}"`,
				{ itemIndex: i },
			);
	}
}
