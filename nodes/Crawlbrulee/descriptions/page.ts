import type { INodeProperties } from 'n8n-workflow';
import { cacheMaxAgeOption, countryOption, localeOption, proxyOption } from './shared';

const pageShow = { resource: ['page'] };
const scrapeShow = { resource: ['page'], operation: ['scrape', 'scrapeAsync'] };
const screenshotShow = { ...scrapeShow, screenshotType: ['full_page', 'viewport'] };

export const pageOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: pageShow },
	options: [
		{
			name: 'Scrape',
			value: 'scrape',
			action: 'Scrape a page',
			description: 'Fetch one URL and return the requested content',
		},
		{
			name: 'Scrape (Async)',
			value: 'scrapeAsync',
			action: 'Start an async scrape',
			description:
				'Submit a background scrape job and return its job ID. Pair it with the Crawlbrulee Trigger.',
		},
	],
	default: 'scrape',
};

export const pageFields: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com',
		description: 'The URL to scrape',
		displayOptions: { show: scrapeShow },
	},
	{
		displayName: 'Extract',
		name: 'extract',
		type: 'multiOptions',
		options: [
			{ name: 'Cleaned HTML', value: 'cleaned_html', description: 'The main page content as HTML' },
			{ name: 'Images', value: 'images', description: 'Inline images found on the page' },
			{ name: 'Links', value: 'links', description: 'Links found on the page' },
			{ name: 'Markdown', value: 'markdown', description: 'The page as clean Markdown' },
			{
				name: 'Metadata',
				value: 'metadata',
				description: 'Title, description and OG/Twitter tags',
			},
			{ name: 'Raw HTML', value: 'raw_html', description: 'The page HTML exactly as it arrived' },
		],
		default: ['cleaned_html', 'metadata'],
		description: 'Which outputs to return',
		displayOptions: { show: scrapeShow },
	},
	{
		displayName: 'Screenshot',
		name: 'screenshotType',
		type: 'options',
		options: [
			{ name: 'Full Page', value: 'full_page', description: 'The whole scrollable page' },
			{ name: 'None', value: 'none', description: 'No screenshot' },
			{ name: 'Viewport', value: 'viewport', description: 'The visible part of the page' },
		],
		default: 'none',
		description: 'Capture a screenshot. Uses a headless browser; adds latency and credits.',
		displayOptions: { show: scrapeShow },
	},
	{
		displayName: 'Screenshot Options',
		name: 'screenshotOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: screenshotShow },
		options: [
			{
				displayName: 'Actions Before',
				name: 'actionsBefore',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Action',
				default: {},
				description: 'Waits and scrolls performed before the capture, at most 5',
				options: [
					{
						name: 'action',
						displayName: 'Action',
						values: [
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: [
									{
										name: 'Scroll',
										value: 'scroll',
										description: 'Scroll by a number of pixels. Negative scrolls up.',
									},
									{
										name: 'Wait',
										value: 'wait',
										description: 'Pause for a number of milliseconds',
									},
								],
								default: 'wait',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'number',
								default: 1000,
								description: 'Milliseconds for Wait, pixels for Scroll',
							},
						],
					},
				],
			},
			{
				displayName: 'Device Mode',
				name: 'deviceMode',
				type: 'options',
				options: [
					{ name: 'Desktop', value: 'desktop' },
					{ name: 'Mobile', value: 'mobile' },
				],
				default: 'desktop',
				description: 'Emulate a desktop or a mobile browser',
			},
			{
				displayName: 'Device Scale Factor',
				name: 'deviceScaleFactor',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 3 },
				default: 1,
				description: 'Device pixel ratio, e.g. 2 for retina. Needs Width and Height.',
			},
			{
				displayName: 'Height',
				name: 'height',
				type: 'number',
				typeOptions: { minValue: 16, maxValue: 10000 },
				default: 800,
				description: 'Viewport height in pixels. Set together with Width.',
			},
			{
				displayName: 'Slice Height',
				name: 'sliceHeight',
				type: 'number',
				typeOptions: { minValue: 500 },
				default: 1000,
				description:
					'Cut the screenshot into horizontal tiles of this height in pixels, at least 500',
			},
			{
				displayName: 'Width',
				name: 'width',
				type: 'number',
				typeOptions: { minValue: 16, maxValue: 10000 },
				default: 1280,
				description: 'Viewport width in pixels. Set together with Height.',
			},
		],
	},
	{
		displayName: 'Download Screenshot',
		name: 'downloadScreenshot',
		type: 'boolean',
		default: false,
		description: 'Whether to download the screenshot (and its slices) into binary data on the item',
		// Only the sync scrape returns an image; an async submit returns a job id, so the job
		// resource has its own Download Screenshot field for Get Scrape Result.
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['scrape'],
				screenshotType: ['full_page', 'viewport'],
			},
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: scrapeShow },
		options: [
			cacheMaxAgeOption('2 days'),
			countryOption,
			{
				displayName: 'Exclude Selectors',
				name: 'excludeSelectors',
				type: 'string',
				typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Selector' },
				default: [],
				placeholder: 'e.g. .cookie-banner',
				description:
					'CSS selectors removed before anything is extracted. Sending any skips the cache.',
			},
			localeOption,
			proxyOption,
			{
				displayName: 'Remove Ads & Popups',
				name: 'removeAdsAndPopups',
				type: 'boolean',
				default: true,
				description:
					'Whether to remove ads, cookie banners, consent dialogs and chat widgets before extracting',
			},
			{
				displayName: 'Require JS',
				name: 'requireJs',
				type: 'boolean',
				default: false,
				description:
					'Whether to render JavaScript in a headless browser first. Adds latency and credits.',
			},
		],
	},
	{
		displayName: 'Webhook URL',
		name: 'webhookUrl',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://your-n8n.example/webhook/…',
		description:
			'Receives a signed scrape.complete POST when the job finishes. Paste the URL shown by a Crawlbrulee Trigger node.',
		displayOptions: { show: { resource: ['page'], operation: ['scrapeAsync'] } },
	},
	{
		displayName: 'Webhook Metadata',
		name: 'webhookMetadata',
		type: 'json',
		default: '',
		description: 'JSON object echoed back in the webhook as data.metadata, up to 2048 bytes',
		displayOptions: { show: { resource: ['page'], operation: ['scrapeAsync'] } },
	},
];
