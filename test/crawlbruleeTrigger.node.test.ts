import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CrawlbruleeTrigger } from '../nodes/CrawlbruleeTrigger/CrawlbruleeTrigger.node';

const secret = 'whsec_x';
const envelope = (eventId: string, status = 'success') =>
	JSON.stringify({
		event_id: eventId,
		timestamp: '2026-09-22T00:00:00Z',
		event: 'scrape.complete',
		data: { job_id: 'job_1', status, url: 'https://x', completed_at: '2026-09-22T00:00:01Z' },
	});
const sign = (raw: string) => {
	const t = Math.floor(Date.now() / 1000);
	return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;
};

function ctx(
	raw: string,
	headers: Record<string, string>,
	opts: {
		secret?: string;
		fetchResult?: boolean;
		staticData?: Record<string, unknown>;
		result?: unknown;
	} = {},
) {
	const staticData = opts.staticData ?? {};
	const warn = vi.fn();
	const httpRequestWithAuthentication = vi
		.fn()
		.mockResolvedValue({ statusCode: 200, body: opts.result ?? { markdown: '# r' } });
	const self = {
		getRequestObject: () => ({
			rawBody: Buffer.from(raw),
			headers,
			readRawBody: async () => undefined,
		}),
		getCredentials: vi.fn().mockResolvedValue({
			apiKey: 'k',
			baseUrl: 'https://api.crawlbrulee.com',
			webhookSecret: opts.secret ?? '',
		}),
		getNodeParameter: (name: string, fallback?: unknown) =>
			name === 'fetchResult' ? (opts.fetchResult ?? false) : fallback,
		getWorkflowStaticData: () => staticData,
		getNode: () => ({
			name: 'Crawlbrulee Trigger',
			type: 'crawlbruleeTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		logger: { warn, info: vi.fn(), debug: vi.fn(), error: vi.fn() },
		helpers: {
			httpRequestWithAuthentication,
			returnJsonArray: (d: unknown[]) => d.map((json) => ({ json })),
		},
	};
	return { self: self as never, warn, staticData, httpRequestWithAuthentication };
}

const node = new CrawlbruleeTrigger();

describe('CrawlbruleeTrigger', () => {
	it('describes itself as a trigger', () => {
		expect(node.description.name).toBe('crawlbruleeTrigger');
		expect(node.description.displayName).toBe('Crawlbrulee Trigger');
		expect(node.description.inputs).toEqual([]);
		expect(node.description.usableAsTool).toBeUndefined();
		expect(node.description.webhooks?.[0]).toMatchObject({
			httpMethod: 'POST',
			responseMode: 'onReceived',
			path: 'webhook',
		});
	});

	it('lifecycle methods need no remote call', async () => {
		const hooks = node.webhookMethods!.default!;
		await expect(hooks.checkExists.call({} as never)).resolves.toBe(false);
		await expect(hooks.create.call({} as never)).resolves.toBe(true);
		await expect(hooks.delete.call({} as never)).resolves.toBe(true);
	});

	it('emits the data block without a secret', async () => {
		const raw = envelope('evt_1');
		const { self } = ctx(raw, { 'x-cwbl-event-id': 'evt_1' });
		const out = await node.webhook.call(self);
		expect(out.workflowData?.[0][0].json).toMatchObject({
			event_id: 'evt_1',
			job_id: 'job_1',
			status: 'success',
		});
	});

	it('verifies with the secret and drops bad signatures with a warning', async () => {
		const raw = envelope('evt_2');
		const good = ctx(raw, { 'x-cwbl-signature': sign(raw) }, { secret });
		expect((await node.webhook.call(good.self)).workflowData?.[0]).toHaveLength(1);
		const bad = ctx(raw, { 'x-cwbl-signature': 't=1,v1=' + 'a'.repeat(64) }, { secret });
		const out = await node.webhook.call(bad.self);
		expect(out.workflowData).toBeUndefined();
		expect(bad.warn).toHaveBeenCalledWith(
			expect.stringMatching(/dropped.*timestamp_out_of_tolerance|dropped.*signature_mismatch/),
		);
	});

	it('drops a delivery with no signature at all when a secret is set', async () => {
		const raw = envelope('evt_unsigned');
		const unsigned = ctx(raw, {}, { secret });
		const out = await node.webhook.call(unsigned.self);
		expect(out.workflowData).toBeUndefined();
		expect(unsigned.warn).toHaveBeenCalledWith(expect.stringContaining('missing_signature'));
	});

	it('drops repeats of the same event id', async () => {
		const raw = envelope('evt_3');
		const { self, staticData } = ctx(raw, { 'x-cwbl-event-id': 'evt_3' });
		expect((await node.webhook.call(self)).workflowData?.[0]).toHaveLength(1);
		const again = ctx(raw, { 'x-cwbl-event-id': 'evt_3' }, { staticData });
		expect((await node.webhook.call(again.self)).workflowData).toBeUndefined();
	});

	it('drops non scrape.complete bodies and unparsable json', async () => {
		expect(
			(await node.webhook.call(ctx('{"event":"other"}', {}).self)).workflowData,
		).toBeUndefined();
		expect((await node.webhook.call(ctx('{oops', {}).self)).workflowData).toBeUndefined();
	});

	it('fetches the result on success when asked, and reports a fetch error on the item', async () => {
		const ok = ctx(envelope('evt_4'), {}, { fetchResult: true });
		const out = await node.webhook.call(ok.self);
		expect(out.workflowData?.[0][0].json.result).toEqual({ markdown: '# r' });
		expect(ok.httpRequestWithAuthentication.mock.calls[0][1].url).toBe(
			'https://api.crawlbrulee.com/api/scrape/result/job_1',
		);

		const failed = ctx(envelope('evt_5', 'failed'), {}, { fetchResult: true });
		expect((await node.webhook.call(failed.self)).workflowData?.[0][0].json).not.toHaveProperty(
			'result',
		);

		const broken = ctx(envelope('evt_6'), {}, { fetchResult: true });
		broken.httpRequestWithAuthentication.mockResolvedValue({
			statusCode: 404,
			body: { name: 'not_found', message: 'gone' },
		});
		expect((await node.webhook.call(broken.self)).workflowData?.[0][0].json.result_error).toBe(
			'gone',
		);
	});
});
