import type { IBinaryKeyData, IDataObject, IExecuteFunctions, IWebhookFunctions } from 'n8n-workflow';
import type { ScreenshotResult } from '@crawlbrulee/sdk';

type BinaryContext = IExecuteFunctions | IWebhookFunctions;

async function download(this: BinaryContext, url: string, fileName: string, mime: string) {
	// signed urls need no auth, so the plain helper is right here
	const data = (await this.helpers.httpRequest({ url, method: 'GET', encoding: 'arraybuffer' })) as ArrayBuffer;
	return this.helpers.prepareBinaryData(Buffer.from(data), fileName, mime);
}

/** Pull the screenshot and its slices from a scrape response into binary data. */
export async function attachScreenshots(this: BinaryContext, json: IDataObject): Promise<IBinaryKeyData | undefined> {
	const shot = json.screenshot as ScreenshotResult | undefined;
	if (!shot?.url) return undefined;
	const binary: IBinaryKeyData = {};
	binary.screenshot = await download.call(this, shot.url, shot.properties.file_name, shot.properties.mime);
	for (const slice of shot.slices ?? []) {
		binary[`screenshot_slice_${slice.row_nr}`] = await download.call(
			this,
			slice.url,
			slice.properties.file_name,
			slice.properties.mime,
		);
	}
	return binary;
}
