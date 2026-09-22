import { describe, expect, it, vi } from 'vitest';
import { attachScreenshots } from '../nodes/Crawlbrulee/binary';

function ctx() {
	const httpRequest = vi.fn().mockResolvedValue(new ArrayBuffer(4));
	const prepareBinaryData = vi.fn().mockImplementation(async (_buf: Buffer, fileName: string, mime: string) => ({
		data: 'AAAA', fileName, mimeType: mime,
	}));
	return { self: { helpers: { httpRequest, prepareBinaryData } } as never, httpRequest, prepareBinaryData };
}

describe('attachScreenshots', () => {
	it('returns undefined when there is no screenshot', async () => {
		const { self } = ctx();
		expect(await attachScreenshots.call(self, { url: 'x' })).toBeUndefined();
	});

	it('downloads the main image and each slice', async () => {
		const { self, httpRequest, prepareBinaryData } = ctx();
		const json = {
			screenshot: {
				url: 'https://cdn/full.png', type: 'full_page',
				properties: { file_name: 'full.png', mime: 'image/png', width: 1, height: 1, viewport: { width: 1, height: 1, device_scale_factor: 1 } },
				slices: [
					{ row_nr: 0, url: 'https://cdn/s0.png', type: 'slice', properties: { file_name: 's0.png', mime: 'image/png', width: 1, height: 1, viewport: { width: 1, height: 1, device_scale_factor: 1 } } },
					{ row_nr: 1, url: 'https://cdn/s1.png', type: 'slice', properties: { file_name: 's1.png', mime: 'image/png', width: 1, height: 1, viewport: { width: 1, height: 1, device_scale_factor: 1 } } },
				],
			},
		};
		const binary = await attachScreenshots.call(self, json);
		expect(Object.keys(binary!)).toEqual(['screenshot', 'screenshot_slice_0', 'screenshot_slice_1']);
		expect(httpRequest).toHaveBeenCalledWith({ url: 'https://cdn/full.png', method: 'GET', encoding: 'arraybuffer' });
		expect(prepareBinaryData).toHaveBeenCalledWith(expect.any(Buffer), 's1.png', 'image/png');
	});

	it('keeps the item and reports the failure when a download rejects', async () => {
		const { self, httpRequest } = ctx();
		httpRequest.mockRejectedValueOnce(new Error('403 Forbidden'));
		const json = {
			markdown: '# hi',
			screenshot: {
				url: 'https://cdn/full.png', type: 'full_page',
				properties: { file_name: 'full.png', mime: 'image/png', width: 1, height: 1, viewport: { width: 1, height: 1, device_scale_factor: 1 } },
				slices: [
					{ row_nr: 0, url: 'https://cdn/s0.png', type: 'slice', properties: { file_name: 's0.png', mime: 'image/png', width: 1, height: 1, viewport: { width: 1, height: 1, device_scale_factor: 1 } } },
				],
			},
		};
		const binary = await attachScreenshots.call(self, json);
		expect(json.markdown).toBe('# hi');
		expect((json as Record<string, unknown>).screenshot_download_error).toBe('screenshot: 403 Forbidden');
		expect(Object.keys(binary!)).toEqual(['screenshot_slice_0']);
	});
});
