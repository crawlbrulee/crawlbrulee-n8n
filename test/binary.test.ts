import { describe, expect, it, vi } from 'vitest';
import { attachPdf, attachScreenshots } from '../nodes/Crawlbrulee/binary';

function ctx() {
	const httpRequest = vi.fn().mockResolvedValue(new ArrayBuffer(4));
	const prepareBinaryData = vi
		.fn()
		.mockImplementation(async (_buf: Buffer, fileName: string, mime: string) => ({
			data: 'AAAA',
			fileName,
			mimeType: mime,
		}));
	return {
		self: { helpers: { httpRequest, prepareBinaryData } } as never,
		httpRequest,
		prepareBinaryData,
	};
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
				url: 'https://cdn.example.com/full.png',
				type: 'full_page',
				properties: {
					file_name: 'full.png',
					mime: 'image/png',
					width: 1,
					height: 1,
					viewport: { width: 1, height: 1, device_scale_factor: 1 },
				},
				slices: [
					{
						row_nr: 0,
						url: 'https://cdn.example.com/s0.png',
						type: 'slice',
						properties: {
							file_name: 's0.png',
							mime: 'image/png',
							width: 1,
							height: 1,
							viewport: { width: 1, height: 1, device_scale_factor: 1 },
						},
					},
					{
						row_nr: 1,
						url: 'https://cdn.example.com/s1.png',
						type: 'slice',
						properties: {
							file_name: 's1.png',
							mime: 'image/png',
							width: 1,
							height: 1,
							viewport: { width: 1, height: 1, device_scale_factor: 1 },
						},
					},
				],
			},
		};
		const binary = await attachScreenshots.call(self, json);
		expect(Object.keys(binary!)).toEqual([
			'screenshot',
			'screenshot_slice_0',
			'screenshot_slice_1',
		]);
		expect(httpRequest).toHaveBeenCalledWith({
			url: 'https://cdn.example.com/full.png',
			method: 'GET',
			encoding: 'arraybuffer',
		});
		expect(prepareBinaryData).toHaveBeenCalledWith(expect.any(Buffer), 's1.png', 'image/png');
	});

	it('keeps the item and reports the failure when a download rejects', async () => {
		const { self, httpRequest } = ctx();
		httpRequest.mockRejectedValueOnce(new Error('403 Forbidden'));
		const json = {
			markdown: '# hi',
			screenshot: {
				url: 'https://cdn.example.com/full.png',
				type: 'full_page',
				properties: {
					file_name: 'full.png',
					mime: 'image/png',
					width: 1,
					height: 1,
					viewport: { width: 1, height: 1, device_scale_factor: 1 },
				},
				slices: [
					{
						row_nr: 0,
						url: 'https://cdn.example.com/s0.png',
						type: 'slice',
						properties: {
							file_name: 's0.png',
							mime: 'image/png',
							width: 1,
							height: 1,
							viewport: { width: 1, height: 1, device_scale_factor: 1 },
						},
					},
				],
			},
		};
		const binary = await attachScreenshots.call(self, json);
		expect(json.markdown).toBe('# hi');
		expect((json as Record<string, unknown>).screenshot_download_error).toBe(
			'screenshot: 403 Forbidden',
		);
		expect(Object.keys(binary!)).toEqual(['screenshot_slice_0']);
	});
});

describe('attachPdf', () => {
	it('returns undefined when there is no pdf', async () => {
		const { self, httpRequest } = ctx();
		expect(await attachPdf.call(self, { url: 'https://example.com/' })).toBeUndefined();
		expect(httpRequest).not.toHaveBeenCalled();
	});

	it('downloads the PDF under the pdf key, named after the page host', async () => {
		const { self, httpRequest, prepareBinaryData } = ctx();
		const json = {
			url: 'https://example.com/report',
			pdf: { url: 'https://cdn.example.com/page.pdf', bytes: 4 },
		};
		const binary = await attachPdf.call(self, json);
		expect(Object.keys(binary!)).toEqual(['pdf']);
		expect(httpRequest).toHaveBeenCalledWith({
			url: 'https://cdn.example.com/page.pdf',
			method: 'GET',
			encoding: 'arraybuffer',
		});
		expect(prepareBinaryData).toHaveBeenCalledWith(
			expect.any(Buffer),
			'example.com.pdf',
			'application/pdf',
		);
	});

	it('falls back to page.pdf when the page url cannot be read', async () => {
		const { self, prepareBinaryData } = ctx();
		await attachPdf.call(self, { pdf: { url: 'https://cdn.example.com/page.pdf', bytes: 4 } });
		expect(prepareBinaryData).toHaveBeenCalledWith(
			expect.any(Buffer),
			'page.pdf',
			'application/pdf',
		);
	});

	it('keeps the item and reports the failure when the download rejects', async () => {
		const { self, httpRequest } = ctx();
		httpRequest.mockRejectedValueOnce(new Error('403 Forbidden'));
		const json: Record<string, unknown> = {
			markdown: '# hi',
			pdf: { url: 'https://cdn.example.com/page.pdf', bytes: 4 },
		};
		expect(await attachPdf.call(self, json as never)).toBeUndefined();
		expect(json.markdown).toBe('# hi');
		expect(json.pdf_download_error).toBe('pdf: 403 Forbidden');
	});
});
