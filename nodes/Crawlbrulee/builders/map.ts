import type { INode } from 'n8n-workflow';
import type { MapRequest, MapTypes } from '@crawlbrulee/sdk';
import { isSet, parseCacheMaxAge, type ProxyChoice } from './scrape';

export interface MapParams {
	url: string;
	options: {
		sitemapOnly?: boolean;
		internal?: boolean;
		internalSubdomains?: boolean;
		external?: boolean;
		maxUrls?: number;
		page?: number;
		limit?: number;
		proxy?: ProxyChoice;
		cacheMaxAge?: string;
		country?: string;
	};
}

// `node` and `itemIndex` are accepted for symmetry with the scrape builder; map has no
// cross-field rules today, so nothing throws.
export function buildMapBody(_node: INode, _itemIndex: number, p: MapParams): MapRequest {
	const body: MapRequest = { url: p.url };
	const o = p.options ?? {};

	if (o.sitemapOnly === true) body.sitemap_only = true;

	const types: MapTypes = {};
	if (typeof o.internal === 'boolean') types.internal = o.internal;
	if (typeof o.internalSubdomains === 'boolean') types.internal_subdomains = o.internalSubdomains;
	if (typeof o.external === 'boolean') types.external = o.external;
	if (Object.keys(types).length > 0) body.types = types;

	if (isSet(o.maxUrls)) body.max_urls = Number(o.maxUrls);
	if (isSet(o.page)) body.page = Number(o.page);
	if (isSet(o.limit)) body.limit = Number(o.limit);
	if (o.proxy) body.proxy = o.proxy;

	const maxAge = parseCacheMaxAge(o.cacheMaxAge);
	if (maxAge !== undefined) body.cache = { max_age: maxAge };
	const country = String(o.country ?? '').trim();
	if (country !== '') body.location = { country };

	return body;
}
