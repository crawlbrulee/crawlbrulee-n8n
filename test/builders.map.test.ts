import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeOperationError } from 'n8n-workflow';
import { buildMapBody } from '../nodes/Crawlbrulee/builders/map';

const node = {
	name: 'Crawlbrulee',
	type: 'crawlbrulee',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
} as never;

describe('buildMapBody', () => {
	it('sends only the url when Options is untouched', () => {
		expect(buildMapBody(node, 0, { url: 'https://example.com', options: {} })).toEqual({
			url: 'https://example.com',
		});
	});

	it('maps every option', () => {
		expect(
			buildMapBody(node, 0, {
				url: 'https://example.com',
				options: {
					sitemapOnly: true,
					internal: true,
					internalSubdomains: false,
					external: false,
					maxUrls: 100,
					page: 2,
					limit: 50,
					proxy: 'basic',
					cacheMaxAge: '86400',
					country: 'US',
				},
			}),
		).toEqual({
			url: 'https://example.com',
			sitemap_only: true,
			types: { internal: true, internal_subdomains: false, external: false },
			max_results: 100,
			page: 2,
			limit: 50,
			proxy: 'basic',
			cache: { max_age: 86400 },
			location: { country: 'US' },
		});
	});

	it('treats a whitespace-only country as unset', () => {
		expect(buildMapBody(node, 0, { url: 'https://x', options: { country: '  ' } })).toEqual({
			url: 'https://x',
		});
	});

	it('sends zero_data_retention at the top level only when on', () => {
		expect(
			buildMapBody(node, 0, { url: 'https://x', options: { zeroDataRetention: true } }),
		).toEqual({ url: 'https://x', zero_data_retention: true });
		expect(
			buildMapBody(node, 0, { url: 'https://x', options: { zeroDataRetention: false } }),
		).toEqual({ url: 'https://x' });
	});

	it('does not send sitemap_only: false', () => {
		expect(buildMapBody(node, 0, { url: 'https://x', options: { sitemapOnly: false } })).toEqual({
			url: 'https://x',
		});
	});
});

describe('map fields for sitemap files', () => {
	const url = 'https://example.com';

	it('sends Max Results, saved under its old name maxUrls, as max_results and never max_urls', () => {
		const body = buildMapBody(node, 0, { url, options: { maxUrls: 1000 } });
		expect(body).toEqual({ url, max_results: 1000 });
		expect(body).not.toHaveProperty('max_urls');
	});

	it('sends every new field at the top level, with no sitemap block', () => {
		const body = buildMapBody(node, 0, {
			url,
			options: {
				sitemapUrl: ' https://cdn.example.com/sitemap-products.xml.gz ',
				depth: 2,
				entries: 'sitemaps',
				modifiedSince: '2026-11-01T08:00:00+02:00',
			},
		});
		expect(body).toEqual({
			url,
			sitemap_url: 'https://cdn.example.com/sitemap-products.xml.gz',
			depth: 2,
			entries: 'sitemaps',
			modified_since: '2026-11-01T08:00:00+02:00',
		});
		expect(body).not.toHaveProperty('sitemap');
	});

	it('sends depth 0 rather than leaving it out as empty', () => {
		expect(buildMapBody(node, 0, { url, options: { depth: 0, entries: 'sitemaps' } })).toEqual({
			url,
			depth: 0,
			entries: 'sitemaps',
		});
	});

	it('sends depth 1 with Entries on Sitemaps, which lists the top files and the files they list', () => {
		expect(buildMapBody(node, 0, { url, options: { depth: 1, entries: 'sitemaps' } })).toEqual({
			url,
			depth: 1,
			entries: 'sitemaps',
		});
	});

	it('passes a high depth through, since the api sets the highest one', () => {
		expect(buildMapBody(node, 0, { url, options: { depth: 7 } }).depth).toBe(7);
	});

	it('rejects a depth that is not a whole number of 0 or more', () => {
		for (const depth of [-1, 1.5]) {
			expect(() => buildMapBody(node, 3, { url, options: { depth } })).toThrow(NodeOperationError);
		}
	});

	describe('Modified Since and the time zone', () => {
		const since = (modifiedSince: string, timeZone: string) =>
			buildMapBody(node, 0, { url, options: { modifiedSince } }, timeZone).modified_since;

		it('sends a value with its own time zone unchanged', () => {
			expect(since('2026-11-01T00:00:00Z', 'Europe/Bucharest')).toBe('2026-11-01T00:00:00Z');
			expect(since('2026-11-01T00:00:00+02:00', 'America/New_York')).toBe(
				'2026-11-01T00:00:00+02:00',
			);
			expect(since('2026-11-01T00:00:00.000-05:00', 'Europe/Bucharest')).toBe(
				'2026-11-01T00:00:00.000-05:00',
			);
		});

		it("reads a value with no time zone in the workflow's zone, winter and summer", () => {
			// Bucharest is UTC+2 in winter and UTC+3 in summer
			expect(since('2026-11-01T00:00:00', 'Europe/Bucharest')).toBe('2026-10-31T22:00:00.000Z');
			expect(since('2026-07-15T09:30:00', 'Europe/Bucharest')).toBe('2026-07-15T06:30:00.000Z');
			expect(since('2026-11-01T08:15', 'Europe/Bucharest')).toBe('2026-11-01T06:15:00.000Z');
			expect(since('2026-11-01T00:00:00.5', 'Europe/Bucharest')).toBe('2026-10-31T22:00:00.500Z');
		});

		it("reads it in America/New_York, n8n's default instance zone", () => {
			// still summer time (UTC-4) at midnight: the switch is at 02:00 that night
			expect(since('2026-11-01T00:00:00', 'America/New_York')).toBe('2026-11-01T04:00:00.000Z');
			expect(since('2026-12-01T00:00:00', 'America/New_York')).toBe('2026-12-01T05:00:00.000Z');
		});

		it('reads a plain date as midnight in the zone', () => {
			expect(since('2026-11-01', 'Europe/Bucharest')).toBe('2026-10-31T22:00:00.000Z');
			expect(since('2026-12-01', 'America/New_York')).toBe('2026-12-01T05:00:00.000Z');
		});

		it('moves a time in the hour skipped in spring forward by the skip', () => {
			// Bucharest 2026-03-29: 03:00 jumps to 04:00, so 03:30 is 04:30 summer time (UTC+3)
			expect(since('2026-03-29T03:30:00', 'Europe/Bucharest')).toBe('2026-03-29T01:30:00.000Z');
			// New York 2026-03-08: 02:00 jumps to 03:00, so 02:30 is 03:30 summer time (UTC-4)
			expect(since('2026-03-08T02:30:00', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z');
		});

		describe('a time in the hour repeated in autumn', () => {
			afterEach(() => {
				vi.useRealTimers();
			});

			// luxon's own pick for this hour depends on the date it runs, so the same check runs
			// with the clock in summer and in winter, and must give the same answer both times
			for (const [season, now] of [
				['summer', '2026-07-15T12:00:00Z'],
				['winter', '2026-01-15T12:00:00Z'],
			]) {
				it(`is the first, earlier one when the node runs in ${season}`, () => {
					vi.useFakeTimers({ toFake: ['Date'] });
					vi.setSystemTime(new Date(now));
					// Bucharest 2026-10-25: 04:00 goes back to 03:00, so 03:30 happens at UTC+3, then UTC+2
					expect(since('2026-10-25T03:30:00', 'Europe/Bucharest')).toBe('2026-10-25T00:30:00.000Z');
					// New York 2026-11-01: 02:00 goes back to 01:00, so 01:30 happens at UTC-4, then UTC-5
					expect(since('2026-11-01T01:30:00', 'America/New_York')).toBe('2026-11-01T05:30:00.000Z');
				});
			}
		});

		it('reads it as UTC in UTC', () => {
			expect(since('2026-11-01T00:00:00', 'UTC')).toBe('2026-11-01T00:00:00.000Z');
		});

		it('falls back to UTC for an unknown or empty zone', () => {
			expect(since('2026-11-01T00:00:00', 'Mars/Olympus_Mons')).toBe('2026-11-01T00:00:00.000Z');
			expect(since('2026-11-01T00:00:00', '')).toBe('2026-11-01T00:00:00.000Z');
		});

		it('sends a value that is not a real date as typed, for the api to answer', () => {
			expect(since('2026-02-30T00:00:00', 'Europe/Bucharest')).toBe('2026-02-30T00:00:00');
		});
	});

	it('leaves out an empty Sitemap URL and Modified Since', () => {
		expect(
			buildMapBody(node, 0, { url, options: { sitemapUrl: '  ', modifiedSince: '' } }),
		).toEqual({ url });
	});
});
