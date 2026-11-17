import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { MapRequest, MapTypes } from '@crawlbrulee/sdk';
import { DateTime, IANAZone } from 'luxon';
import { isSet, parseCacheMaxAge, type ProxyChoice } from './scrape';

/** What a map returns: page addresses, sitemap files, or both. */
export type MapEntries = 'pages' | 'sitemaps' | 'all';

/**
 * The request fields `max_results`, `sitemap_url`, `depth`, `entries` and `modified_since`,
 * local until the sdk ships them. Then remove this and use `MapRequest` again.
 */
export type MapRequestBody = MapRequest & {
	max_results?: number;
	sitemap_url?: string;
	depth?: number;
	entries?: MapEntries;
	modified_since?: string;
};

export interface MapParams {
	url: string;
	options: {
		sitemapOnly?: boolean;
		internal?: boolean;
		internalSubdomains?: boolean;
		external?: boolean;
		/** Shown as Max Results. The name stays `maxUrls` so saved workflows keep their value. */
		maxUrls?: number;
		page?: number;
		limit?: number;
		proxy?: ProxyChoice;
		cacheMaxAge?: string;
		country?: string;
		zeroDataRetention?: boolean;
		sitemapUrl?: string;
		depth?: number;
		entries?: MapEntries;
		modifiedSince?: string;
	};
}

/** Ends in `Z` or an offset like `+02:00`: the value carries its own time zone. */
const HAS_TIME_ZONE = /[zZ]$|[+-]\d{2}:?\d{2}$/;

/**
 * A date, or a date and time, with no time zone: `YYYY-MM-DD`, then optionally `T` (or a
 * space) and `HH:mm`, `:ss` and up to nine digits of a second. luxon reads more ISO shapes
 * than these (week dates, `24:00`), so only these reach it.
 */
const LOCAL_DATE_TIME =
	/^\d{4}-\d{2}-\d{2}(?:[T ](?:[01]\d|2[0-3]):\d{2}(?::\d{2}(?:\.\d{1,9})?)?)?$/;

/**
 * A date and time for `modified_since`. The api needs a time zone. n8n's date picker gives
 * none, and n8n means such a value in the workflow's time zone (the workflow's setting, else
 * the instance's), so a value without one is read in `timeZone` and sent in UTC, as
 * `YYYY-MM-DDTHH:mm:ss.sssZ`. A plain date means midnight. A value that carries its own
 * zone (`Z` or an offset like `+02:00`) is sent unchanged, and so is one that is not a date
 * this function can read, so the api can say what is wrong with it.
 *
 * luxon does the time zone work, the same library n8n uses for dates. A time in the hour
 * skipped in spring moves forward by the length of the skip (03:30 in a skip from 03:00 to
 * 04:00 is 04:30 summer time). A time in the hour repeated in autumn is the first, earlier
 * of its two instants, so the map leaves out nothing from that hour. Neither ever depends on
 * the date the node runs.
 */
function modifiedSince(value: string, timeZone: string): string {
	const text = value.trim();
	if (HAS_TIME_ZONE.test(text) || !LOCAL_DATE_TIME.test(text)) {
		return text;
	}

	// an empty or unknown zone name falls back to UTC instead of failing the node
	const zone = IANAZone.isValidZone(timeZone.trim()) ? timeZone.trim() : 'UTC';
	const date = DateTime.fromISO(text.replace(' ', 'T'), { zone });
	// luxon marks a date that does not exist (like February 30) as invalid: send it as typed
	if (!date.isValid) {
		return text;
	}
	// a time in the repeated hour has two instants, and luxon's pick depends on today's date,
	// so take the earlier one of the two luxon lists
	const [earliest] = date.getPossibleOffsets().sort((a, b) => a.toMillis() - b.toMillis());
	return earliest.toUTC().toISO() ?? text;
}

/**
 * `timeZone` is the workflow's time zone (`this.getTimezone()` in the node). It is used only
 * to read a Modified Since that has no time zone of its own.
 */
export function buildMapBody(
	node: INode,
	itemIndex: number,
	p: MapParams,
	timeZone = 'UTC',
): MapRequestBody {
	const body: MapRequestBody = { url: p.url };
	const o = p.options ?? {};

	if (o.sitemapOnly === true) body.sitemap_only = true;
	if (o.zeroDataRetention === true) body.zero_data_retention = true;

	const types: MapTypes = {};
	if (typeof o.internal === 'boolean') types.internal = o.internal;
	if (typeof o.internalSubdomains === 'boolean') types.internal_subdomains = o.internalSubdomains;
	if (typeof o.external === 'boolean') types.external = o.external;
	if (Object.keys(types).length > 0) body.types = types;

	// the field was labeled Max URLs up to 1.1.0; it keeps its name and now sends the api's
	// new name for the same limit
	if (isSet(o.maxUrls)) body.max_results = Number(o.maxUrls);
	if (isSet(o.page)) body.page = Number(o.page);
	if (isSet(o.limit)) body.limit = Number(o.limit);
	if (o.proxy) body.proxy = o.proxy;

	const maxAge = parseCacheMaxAge(o.cacheMaxAge);
	if (maxAge !== undefined) body.cache = { max_age: maxAge };
	const country = String(o.country ?? '').trim();
	if (country !== '') body.location = { country };

	const sitemapUrl = String(o.sitemapUrl ?? '').trim();
	if (sitemapUrl !== '') body.sitemap_url = sitemapUrl;
	if (isSet(o.depth)) {
		// the api sets the highest depth and answers with a clear error above it, so only the
		// shape is checked here
		const depth = Number(o.depth);
		if (!Number.isInteger(depth) || depth < 0) {
			throw new NodeOperationError(node, 'Depth must be a whole number, 0 or more', {
				itemIndex,
			});
		}
		body.depth = depth;
	}
	if (o.entries === 'pages' || o.entries === 'sitemaps' || o.entries === 'all') {
		body.entries = o.entries;
	}
	const since = String(o.modifiedSince ?? '').trim();
	if (since !== '') body.modified_since = modifiedSince(since, timeZone);

	return body;
}
