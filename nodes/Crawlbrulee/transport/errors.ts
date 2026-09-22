import type { INode, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import type { ApiErrorResponse } from '@crawlbrulee/sdk';

const KEY_REJECTED = 'Crawlbrulee rejected the API key. Check the key on the credential.';
const SCRAPE_HINT =
	'The Advanced proxy tier has a higher success rate; enable Require JS for JavaScript-rendered content.';

function isApiErrorBody(body: unknown): body is ApiErrorResponse {
	return (
		typeof body === 'object' &&
		body !== null &&
		typeof (body as { name?: unknown }).name === 'string' &&
		typeof (body as { message?: unknown }).message === 'string'
	);
}

/** Turn an api error response into the message the user sees. Pure; no n8n types. */
export function describeApiError(status: number, body: unknown): { message: string; description: string } {
	const description = typeof body === 'string' ? body : JSON.stringify(body ?? null);
	if (!isApiErrorBody(body)) {
		return { message: `Crawlbrulee returned HTTP ${status}.`, description };
	}
	const details = (body.details ?? {}) as Record<string, unknown>;
	switch (body.name) {
		case 'invalid_credentials':
		case 'access_denied':
			return { message: KEY_REJECTED, description };
		case 'antibot_blocked':
			return { message: `The site's anti-bot protection blocked this scrape. ${body.message}`.trim(), description };
		case 'too_many_requests': {
			const retry = typeof details.retry_after_ms === 'number' ? ` Retry after ${details.retry_after_ms} ms.` : '';
			return { message: `Crawlbrulee rate limit reached.${retry}`, description };
		}
		case 'usage_allocation_error':
			if (details.reason === 'credit_limit') return { message: 'Out of credits.', description };
			if (details.reason === 'concurrency_limit') return { message: 'Concurrency limit reached.', description };
			return { message: body.message, description };
		case 'scrape_error':
			return { message: `${body.message.replace(/[.\s]*$/, '')}. ${SCRAPE_HINT}`, description };
		default:
			return { message: body.message || `Crawlbrulee returned HTTP ${status}.`, description };
	}
}

/** Build the NodeApiError n8n shows for a non-2xx api response. */
export function toNodeApiError(node: INode, status: number, body: unknown, itemIndex?: number): NodeApiError {
	const { message, description } = describeApiError(status, body);
	const errorResponse: JsonObject = isApiErrorBody(body)
		? (body as unknown as JsonObject)
		: { status, body: typeof body === 'string' ? body : JSON.stringify(body ?? null) };
	return new NodeApiError(node, errorResponse, {
		message,
		description,
		httpCode: String(status),
		itemIndex,
	});
}
