import type { IBinaryKeyData, IDataObject, IExecuteFunctions } from 'n8n-workflow';
import type { ScreenshotResult } from '@crawlbrulee/sdk';

type BinaryContext = IExecuteFunctions;

async function download(this: BinaryContext, url: string, fileName: string, mime: string) {
	// signed urls need no auth, so the plain helper is right here
	const data = (await this.helpers.httpRequest({
		url,
		method: 'GET',
		encoding: 'arraybuffer',
	})) as ArrayBuffer;
	return this.helpers.prepareBinaryData(Buffer.from(data), fileName, mime);
}

/**
 * Pull the screenshot and its slices from a scrape response into binary data.
 *
 * A signed image url can expire or 404. Losing the whole item over that would throw
 * away page content the user already paid credits for, so each download is caught on
 * its own and the failures are reported on `json.screenshot_download_error`.
 */
export async function attachScreenshots(
	this: BinaryContext,
	json: IDataObject,
): Promise<IBinaryKeyData | undefined> {
	const shot = json.screenshot as ScreenshotResult | undefined;
	if (!shot?.url) return undefined;
	const binary: IBinaryKeyData = {};
	const failures: string[] = [];

	const attach = async (key: string, url: string, fileName: string, mime: string) => {
		try {
			binary[key] = await download.call(this, url, fileName, mime);
		} catch (error) {
			failures.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
		}
	};

	await attach('screenshot', shot.url, shot.properties.file_name, shot.properties.mime);
	for (const slice of shot.slices ?? []) {
		await attach(
			`screenshot_slice_${slice.row_nr}`,
			slice.url,
			slice.properties.file_name,
			slice.properties.mime,
		);
	}

	if (failures.length > 0) json.screenshot_download_error = failures.join('; ');
	return Object.keys(binary).length > 0 ? binary : undefined;
}
