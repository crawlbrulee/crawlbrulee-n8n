import { describe, expect, it } from 'vitest';
import { describeApiError } from '../nodes/Crawlbrulee/transport/errors';

const body = (name: string, message = 'msg', details?: Record<string, unknown>) => ({ name, message, details });

describe('describeApiError', () => {
	it('explains a rejected key', () => {
		expect(describeApiError(401, body('invalid_credentials')).message).toBe(
			'Crawlbrulee rejected the API key. Check the key on the credential.',
		);
		expect(describeApiError(403, body('access_denied')).message).toBe(
			'Crawlbrulee rejected the API key. Check the key on the credential.',
		);
	});

	it('explains an anti-bot block without a retry hint', () => {
		const r = describeApiError(403, body('antibot_blocked', 'Target refused'));
		expect(r.message).toBe("The site's anti-bot protection blocked this scrape. Target refused");
		expect(r.message).not.toMatch(/retry/i);
	});

	it('adds the retry hint on 429 when present', () => {
		expect(
			describeApiError(429, body('too_many_requests', 'slow down', { retry_after_ms: 1500 })).message,
		).toBe('Crawlbrulee rate limit reached. Retry after 1500 ms.');
		expect(describeApiError(429, body('too_many_requests', 'slow down')).message).toBe(
			'Crawlbrulee rate limit reached.',
		);
	});

	it('names the usage reason', () => {
		expect(describeApiError(402, body('usage_allocation_error', 'x', { reason: 'credit_limit' })).message).toBe(
			'Out of credits.',
		);
		expect(
			describeApiError(429, body('usage_allocation_error', 'x', { reason: 'concurrency_limit' })).message,
		).toBe('Concurrency limit reached.');
		expect(describeApiError(500, body('usage_allocation_error', 'odd', { reason: 'internal_error' })).message).toBe(
			'odd',
		);
	});

	it('appends the scrape_error hint', () => {
		expect(describeApiError(500, body('scrape_error', 'Fetch failed')).message).toBe(
			'Fetch failed. The Advanced proxy tier has a higher success rate; enable Require JS for JavaScript-rendered content.',
		);
	});

	it('passes other api messages through', () => {
		expect(describeApiError(400, body('invalid_url', 'Not a url')).message).toBe('Not a url');
		expect(describeApiError(422, body('page_too_large', 'Too big')).message).toBe('Too big');
	});

	it('falls back on a non-api body', () => {
		expect(describeApiError(502, '<html>bad gateway</html>').message).toBe('Crawlbrulee returned HTTP 502.');
		expect(describeApiError(503, undefined).message).toBe('Crawlbrulee returned HTTP 503.');
	});

	it('keeps the raw body in description', () => {
		const r = describeApiError(400, body('invalid_url', 'Not a url'));
		expect(r.description).toContain('"invalid_url"');
	});
});
