import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignature } from '../nodes/CrawlbruleeTrigger/signature';

const secret = 'whsec_test_secret';
const payload = '{"event":"scrape.complete","data":{"job_id":"j"}}';
const now = 1_700_000_000;
const sign = (t: number, s = secret) => `t=${t},v1=${createHmac('sha256', s).update(`${t}.${payload}`).digest('hex')}`;

describe('verifySignature', () => {
	it('verifies the primary header', async () => {
		expect(await verifySignature({ payload, headers: { 'x-cwbl-signature': sign(now) }, secret, nowSeconds: now })).toEqual({ verified: true, signedWith: 'primary' });
	});

	it('is case-insensitive on header names and accepts arrays', async () => {
		expect(await verifySignature({ payload, headers: { 'X-Cwbl-Signature': [sign(now)] }, secret, nowSeconds: now })).toMatchObject({ verified: true });
	});

	it('falls back to the rotated header', async () => {
		const r = await verifySignature({ payload, headers: { 'x-cwbl-signature': sign(now, 'old'), 'x-cwbl-signature-rotated': sign(now) }, secret, nowSeconds: now });
		expect(r).toEqual({ verified: true, signedWith: 'rotated' });
	});

	it('reports each failure reason', async () => {
		expect(await verifySignature({ payload, headers: {}, secret, nowSeconds: now })).toEqual({ verified: false, reason: 'missing_signature' });
		expect(await verifySignature({ payload, headers: { 'x-cwbl-signature': 'garbage' }, secret, nowSeconds: now })).toEqual({ verified: false, reason: 'malformed_signature' });
		expect(await verifySignature({ payload, headers: { 'x-cwbl-signature': sign(now - 301) }, secret, nowSeconds: now })).toEqual({ verified: false, reason: 'timestamp_out_of_tolerance' });
		expect(await verifySignature({ payload, headers: { 'x-cwbl-signature': sign(now, 'wrong') }, secret, nowSeconds: now })).toEqual({ verified: false, reason: 'signature_mismatch' });
	});

	it('ignores tolerance when it is 0', async () => {
		expect(await verifySignature({ payload, headers: { 'x-cwbl-signature': sign(now - 99999) }, secret, nowSeconds: now, toleranceSeconds: 0 })).toMatchObject({ verified: true });
	});

	it('fails on a payload that was re-serialized', async () => {
		const other = JSON.stringify(JSON.parse(payload), null, 2);
		expect(await verifySignature({ payload: other, headers: { 'x-cwbl-signature': sign(now) }, secret, nowSeconds: now })).toEqual({ verified: false, reason: 'signature_mismatch' });
	});

	it('rejects an unsafe-integer timestamp as malformed, like the sdk', async () => {
		const t = 9_007_199_254_740_992;
		expect(await verifySignature({ payload, headers: { 'x-cwbl-signature': sign(t) }, secret, nowSeconds: now, toleranceSeconds: 0 })).toEqual({ verified: false, reason: 'malformed_signature' });
	});

	it('falls back to the rotated header when the primary is stale', async () => {
		const r = await verifySignature({ payload, headers: { 'x-cwbl-signature': sign(now - 301), 'x-cwbl-signature-rotated': sign(now) }, secret, nowSeconds: now });
		expect(r).toEqual({ verified: true, signedWith: 'rotated' });
	});

	it('reports malformed when both headers are malformed', async () => {
		const r = await verifySignature({ payload, headers: { 'x-cwbl-signature': 'garbage', 'x-cwbl-signature-rotated': 'garbage' }, secret, nowSeconds: now });
		expect(r).toEqual({ verified: false, reason: 'malformed_signature' });
	});

	it('ranks a mismatch above a malformed header', async () => {
		const r = await verifySignature({ payload, headers: { 'x-cwbl-signature': 'garbage', 'x-cwbl-signature-rotated': sign(now, 'wrong') }, secret, nowSeconds: now });
		expect(r).toEqual({ verified: false, reason: 'signature_mismatch' });
	});

	it('reports a timestamp a year in the future as out of tolerance', async () => {
		const r = await verifySignature({ payload, headers: { 'x-cwbl-signature': sign(now + 31_536_000) }, secret, nowSeconds: now });
		expect(r).toEqual({ verified: false, reason: 'timestamp_out_of_tolerance' });
	});
});
