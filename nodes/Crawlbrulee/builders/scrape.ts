import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type {
	AsyncScrapeRequest,
	ScrapeCleanup,
	ScrapeExtract,
	ScrapeLocation,
	ScrapeRequest,
	ScreenshotBeforeAction,
	ScreenshotRequest,
} from '@crawlbrulee/sdk';

export type ExtractKey = 'markdown' | 'cleaned_html' | 'raw_html' | 'links' | 'images' | 'metadata';
export const EXTRACT_KEYS: ExtractKey[] = ['markdown', 'cleaned_html', 'raw_html', 'links', 'images', 'metadata'];

export type ProxyChoice = 'auto' | 'basic' | 'advanced';

export interface ScreenshotAction {
	type: 'wait' | 'scroll';
	value: number;
}

export interface ScrapeParams {
	url: string;
	extract: ExtractKey[];
	screenshotType: 'none' | 'viewport' | 'full_page';
	screenshotOptions: {
		width?: number;
		height?: number;
		deviceScaleFactor?: number;
		deviceMode?: 'desktop' | 'mobile';
		actionsBefore?: { action?: ScreenshotAction[] };
		sliceHeight?: number;
	};
	options: {
		proxy?: ProxyChoice;
		requireJs?: boolean;
		removeAdsAndPopups?: boolean;
		excludeSelectors?: string[];
		cacheMaxAge?: string;
		locale?: string;
		country?: string;
	};
	webhookUrl?: string;
	webhookMetadata?: string | Record<string, unknown>;
}

/** Digits-only becomes seconds; anything else is passed through as an ISO-8601 cutoff. */
export function parseCacheMaxAge(value: string | undefined): number | string | undefined {
	if (value === undefined) return undefined;
	const s = value.trim();
	if (s === '') return undefined;
	return /^\d+$/.test(s) ? Number(s) : s;
}

export function isSet(v: unknown): boolean {
	return v !== undefined && v !== null && v !== '';
}

function buildScreenshot(node: INode, itemIndex: number, p: ScrapeParams): ScreenshotRequest | undefined {
	if (p.screenshotType === 'none') return undefined;
	const o = p.screenshotOptions ?? {};
	const shot: ScreenshotRequest = { type: p.screenshotType };

	const hasWidth = isSet(o.width);
	const hasHeight = isSet(o.height);
	if (hasWidth !== hasHeight) {
		throw new NodeOperationError(node, 'Screenshot Width and Height must be set together', { itemIndex });
	}
	if (hasWidth && hasHeight) {
		shot.viewport = { width: Number(o.width), height: Number(o.height) };
		if (isSet(o.deviceScaleFactor)) shot.viewport.device_scale_factor = Number(o.deviceScaleFactor);
	} else if (isSet(o.deviceScaleFactor)) {
		throw new NodeOperationError(node, 'Device Scale Factor needs Screenshot Width and Height', { itemIndex });
	}
	if (o.deviceMode === 'desktop' || o.deviceMode === 'mobile') shot.device_mode = o.deviceMode;

	const actions = o.actionsBefore?.action ?? [];
	if (actions.length > 5) {
		throw new NodeOperationError(node, 'Actions Before allows at most 5 actions', { itemIndex });
	}
	if (actions.length > 0) {
		shot.actions_before = actions.map<ScreenshotBeforeAction>((a) =>
			a.type === 'wait' ? { type: 'wait', ms: Number(a.value) } : { type: 'scroll', pixels: Number(a.value) },
		);
	}
	if (isSet(o.sliceHeight)) {
		const height = Number(o.sliceHeight);
		if (height < 500) throw new NodeOperationError(node, 'Slice Height must be at least 500 pixels', { itemIndex });
		shot.actions_after = [{ type: 'slice', height }];
	}
	return shot;
}

export function buildScrapeBody(node: INode, itemIndex: number, p: ScrapeParams): ScrapeRequest {
	const chosen = new Set(p.extract ?? []);
	if (chosen.size === 0 && p.screenshotType === 'none') {
		throw new NodeOperationError(node, 'Pick at least one Extract output or a Screenshot', {
			itemIndex,
			description: 'The request would ask for nothing.',
		});
	}
	const extract: ScrapeExtract = {};
	for (const key of EXTRACT_KEYS) extract[key] = chosen.has(key);
	const screenshot = buildScreenshot(node, itemIndex, p);
	if (screenshot) extract.screenshot = screenshot;

	const body: ScrapeRequest = { url: p.url, extract };
	const o = p.options ?? {};

	if (o.proxy) body.proxy = o.proxy;
	if (o.requireJs === true) body.require_js = true;

	const cleanup: ScrapeCleanup = {};
	if (typeof o.removeAdsAndPopups === 'boolean') cleanup.ads_and_popups = o.removeAdsAndPopups;
	const selectors = (o.excludeSelectors ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
	if (selectors.length > 0) cleanup.exclude_selectors = selectors;
	if (Object.keys(cleanup).length > 0) body.cleanup = cleanup;

	const maxAge = parseCacheMaxAge(o.cacheMaxAge);
	if (maxAge !== undefined) body.cache = { max_age: maxAge };

	const location: ScrapeLocation = {};
	if (isSet(o.locale)) location.locale = String(o.locale).trim();
	if (isSet(o.country)) location.country = String(o.country).trim();
	if (Object.keys(location).length > 0) body.location = location;

	return body;
}

function parseMetadata(node: INode, itemIndex: number, raw: ScrapeParams['webhookMetadata']): Record<string, unknown> | undefined {
	if (raw === undefined || raw === null || raw === '') return undefined;
	if (typeof raw === 'object') return raw;
	let parsed: unknown;
	let ok = true;
	try {
		parsed = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) ok = false;
	} catch {
		ok = false;
	}
	if (!ok) throw new NodeOperationError(node, 'Webhook Metadata must be a JSON object', { itemIndex });
	return parsed as Record<string, unknown>;
}

export function buildAsyncScrapeBody(node: INode, itemIndex: number, p: ScrapeParams): AsyncScrapeRequest {
	const body: AsyncScrapeRequest = buildScrapeBody(node, itemIndex, p);
	const url = (p.webhookUrl ?? '').trim();
	const metadata = parseMetadata(node, itemIndex, p.webhookMetadata);
	if (!url) {
		if (metadata) throw new NodeOperationError(node, 'Webhook Metadata needs a Webhook URL', { itemIndex });
		return body;
	}
	body.webhook = metadata ? { url, metadata } : { url };
	return body;
}
