import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type {
	AsyncScrapeRequest,
	ScrapeCleanup,
	ScrapeElementLeafSpec,
	ScrapeElementOutput,
	ScrapeElements,
	ScrapeExtract,
	ScrapeLocation,
	ScrapeRequest,
	ScreenshotBeforeAction,
	ScreenshotRequest,
} from '@crawlbrulee/sdk';

export type ExtractKey = 'markdown' | 'cleaned_html' | 'raw_html' | 'links' | 'images' | 'metadata';
export const EXTRACT_KEYS: ExtractKey[] = [
	'markdown',
	'cleaned_html',
	'raw_html',
	'links',
	'images',
	'metadata',
];

export type ProxyChoice = 'auto' | 'basic' | 'advanced';

/** One row of the Elements list in the UI. */
export interface ElementRow {
	name?: string;
	selector?: string;
	output?: ScrapeElementOutput;
	attribute?: string;
	all?: boolean;
}

export interface ScreenshotAction {
	type: 'wait' | 'scroll';
	value: number;
}

export interface ScrapeParams {
	url: string;
	extract: ExtractKey[];
	elements?: { element?: ElementRow[] };
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
		zeroDataRetention?: boolean;
		elementsJson?: string | Record<string, unknown>;
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

function buildScreenshot(
	node: INode,
	itemIndex: number,
	p: ScrapeParams,
): ScreenshotRequest | undefined {
	if (p.screenshotType === 'none') return undefined;
	const o = p.screenshotOptions ?? {};
	const shot: ScreenshotRequest = { type: p.screenshotType };

	const hasWidth = isSet(o.width);
	const hasHeight = isSet(o.height);
	if (hasWidth !== hasHeight) {
		throw new NodeOperationError(node, 'Screenshot Width and Height must be set together', {
			itemIndex,
		});
	}
	if (hasWidth && hasHeight) {
		shot.viewport = { width: Number(o.width), height: Number(o.height) };
		if (isSet(o.deviceScaleFactor)) shot.viewport.device_scale_factor = Number(o.deviceScaleFactor);
	} else if (isSet(o.deviceScaleFactor)) {
		throw new NodeOperationError(node, 'Device Scale Factor needs Screenshot Width and Height', {
			itemIndex,
		});
	}
	if (o.deviceMode === 'desktop' || o.deviceMode === 'mobile') shot.device_mode = o.deviceMode;

	const actions = o.actionsBefore?.action ?? [];
	if (actions.length > 5) {
		throw new NodeOperationError(node, 'Actions Before allows at most 5 actions', { itemIndex });
	}
	if (actions.length > 0) {
		shot.actions_before = actions.map<ScreenshotBeforeAction>((a) =>
			a.type === 'wait'
				? { type: 'wait', ms: Number(a.value) }
				: { type: 'scroll', pixels: Number(a.value) },
		);
	}
	if (isSet(o.sliceHeight)) {
		const height = Number(o.sliceHeight);
		if (height < 500)
			throw new NodeOperationError(node, 'Slice Height must be at least 500 pixels', { itemIndex });
		shot.actions_after = [{ type: 'slice', height }];
	}
	return shot;
}

/**
 * Parses JSON typed as text. Bad JSON gets its own error, with the parser's reason when it is
 * short and does not quote the input back.
 */
function parseJsonText(node: INode, itemIndex: number, text: string, field: string): unknown {
	try {
		return JSON.parse(text);
	} catch (error) {
		const reason = error instanceof Error ? error.message : '';
		const safe = reason !== '' && reason.length <= 120 && !reason.includes('"');
		throw new NodeOperationError(node, `${field} is not valid JSON`, {
			itemIndex,
			description: safe ? `${reason}.` : 'Check for a missing quote, comma or bracket.',
		});
	}
}

function parseElementsJson(
	node: INode,
	itemIndex: number,
	raw: string | Record<string, unknown> | undefined,
): Record<string, unknown> {
	if (raw === undefined || raw === null) return {};
	if (typeof raw === 'string' && raw.trim() === '') return {};
	const parsed: unknown =
		typeof raw === 'string' ? parseJsonText(node, itemIndex, raw, 'Elements (JSON)') : raw;
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new NodeOperationError(node, 'Elements (JSON) must be a JSON object', {
			itemIndex,
			description: 'Each key is a name, each value a CSS selector or an object.',
		});
	}
	for (const [name, value] of Object.entries(parsed)) {
		const ok = typeof value === 'string' || (typeof value === 'object' && value !== null);
		if (!ok || Array.isArray(value)) {
			throw new NodeOperationError(
				node,
				`Element "${name}" in Elements (JSON) must be a CSS selector or an object`,
				{ itemIndex },
			);
		}
	}
	return parsed as Record<string, unknown>;
}

function elementFromRow(
	node: INode,
	itemIndex: number,
	row: ElementRow,
	name: string,
): string | ScrapeElementLeafSpec {
	const selector = String(row.selector ?? '').trim();
	if (selector === '') {
		throw new NodeOperationError(node, `Element "${name}" needs a CSS Selector`, { itemIndex });
	}
	const output = row.output ?? 'text';
	const all = row.all === true;
	if (output === 'text' && !all) return selector;
	const spec: ScrapeElementLeafSpec = { selector };
	if (output !== 'text') spec.output = output;
	if (output === 'attribute') {
		const attribute = String(row.attribute ?? '').trim();
		if (attribute === '') {
			throw new NodeOperationError(node, `Element "${name}" needs an Attribute`, {
				itemIndex,
				description: 'Set the attribute to read, for example href.',
			});
		}
		spec.attribute = attribute;
	}
	if (all) spec.all = true;
	return spec;
}

/** The Elements list and Elements (JSON), merged into `extract.elements`. Undefined when both are empty. */
export function buildElements(
	node: INode,
	itemIndex: number,
	p: ScrapeParams,
): ScrapeElements | undefined {
	const elements: ScrapeElements = {};
	const twice = (name: string) =>
		new NodeOperationError(node, `Element name "${name}" is used twice`, {
			itemIndex,
			description: 'Each name in Elements and Elements (JSON) must be different.',
		});
	for (const row of p.elements?.element ?? []) {
		const name = String(row.name ?? '').trim();
		// a fully blank row is skipped, like a blank Exclude Selector
		if (name === '' && String(row.selector ?? '').trim() === '') continue;
		if (name === '') {
			throw new NodeOperationError(node, 'Each Element needs a Name', { itemIndex });
		}
		if (Object.prototype.hasOwnProperty.call(elements, name)) throw twice(name);
		elements[name] = elementFromRow(node, itemIndex, row, name);
	}
	// the api checks the rest of each spec; after our own checks it is passed on as is
	const fromJson = parseElementsJson(node, itemIndex, p.options?.elementsJson) as ScrapeElements;
	for (const [name, value] of Object.entries(fromJson)) {
		if (Object.prototype.hasOwnProperty.call(elements, name)) throw twice(name);
		elements[name] = value;
	}
	return Object.keys(elements).length > 0 ? elements : undefined;
}

export function buildScrapeBody(node: INode, itemIndex: number, p: ScrapeParams): ScrapeRequest {
	const chosen = new Set(p.extract ?? []);
	const elements = buildElements(node, itemIndex, p);
	if (chosen.size === 0 && !elements && p.screenshotType === 'none') {
		throw new NodeOperationError(
			node,
			'Pick at least one Extract output, an Element or a Screenshot',
			{
				itemIndex,
				description: 'The request would ask for nothing.',
			},
		);
	}
	const extract: ScrapeExtract = {};
	for (const key of EXTRACT_KEYS) extract[key] = chosen.has(key);
	if (elements) extract.elements = elements;
	const screenshot = buildScreenshot(node, itemIndex, p);
	if (screenshot) extract.screenshot = screenshot;

	const body: ScrapeRequest = { url: p.url, extract };
	const o = p.options ?? {};

	if (o.proxy) body.proxy = o.proxy;
	if (o.requireJs === true) body.require_js = true;
	if (o.zeroDataRetention === true) body.zero_data_retention = true;

	const cleanup: ScrapeCleanup = {};
	if (typeof o.removeAdsAndPopups === 'boolean') cleanup.ads_and_popups = o.removeAdsAndPopups;
	const selectors = (o.excludeSelectors ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
	if (selectors.length > 0) cleanup.exclude_selectors = selectors;
	if (Object.keys(cleanup).length > 0) body.cleanup = cleanup;

	const maxAge = parseCacheMaxAge(o.cacheMaxAge);
	if (maxAge !== undefined) body.cache = { max_age: maxAge };

	const location: ScrapeLocation = {};
	const locale = String(o.locale ?? '').trim();
	const country = String(o.country ?? '').trim();
	if (locale !== '') location.locale = locale;
	if (country !== '') location.country = country;
	if (Object.keys(location).length > 0) body.location = location;

	return body;
}

function parseMetadata(
	node: INode,
	itemIndex: number,
	raw: ScrapeParams['webhookMetadata'],
): Record<string, unknown> | undefined {
	if (raw === undefined || raw === null || raw === '') return undefined;
	if (typeof raw === 'object') return raw;
	const parsed = parseJsonText(node, itemIndex, raw, 'Webhook Metadata');
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
		throw new NodeOperationError(node, 'Webhook Metadata must be a JSON object', { itemIndex });
	return parsed as Record<string, unknown>;
}

export function buildAsyncScrapeBody(
	node: INode,
	itemIndex: number,
	p: ScrapeParams,
): AsyncScrapeRequest {
	const body: AsyncScrapeRequest = buildScrapeBody(node, itemIndex, p);
	const url = (p.webhookUrl ?? '').trim();
	const metadata = parseMetadata(node, itemIndex, p.webhookMetadata);
	if (!url) {
		if (metadata)
			throw new NodeOperationError(node, 'Webhook Metadata needs a Webhook URL', { itemIndex });
		return body;
	}
	body.webhook = metadata ? { url, metadata } : { url };
	return body;
}
