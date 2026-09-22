// Same scheme the api documents (and the js sdk implements): the signed payload is
// `${t}.${rawBody}`, the signature is HMAC-SHA256 hex, the header is `t=<unix>,v1=<hex>`.
// Built on the Web Crypto global so the package needs no `node:crypto` import.

export const SIGNATURE_HEADER = 'x-cwbl-signature';
export const ROTATED_HEADER = 'x-cwbl-signature-rotated';
export const EVENT_ID_HEADER = 'x-cwbl-event-id';
export const DEFAULT_TOLERANCE_SECONDS = 300;

export type SignatureFailure =
	| 'missing_signature'
	| 'malformed_signature'
	| 'timestamp_out_of_tolerance'
	| 'signature_mismatch';

export type SignatureResult =
	| { verified: true; signedWith: 'primary' | 'rotated' }
	| { verified: false; reason: SignatureFailure };

export type HeaderBag = Record<string, string | string[] | undefined>;

export interface VerifySignatureArgs {
	payload: string;
	headers: HeaderBag;
	secret: string;
	toleranceSeconds?: number;
	nowSeconds?: number;
}

const FORMAT = /^t=(\d+),v1=([0-9a-f]{64})$/;
const RANK: Record<SignatureFailure, number> = {
	missing_signature: 0,
	malformed_signature: 1,
	timestamp_out_of_tolerance: 2,
	signature_mismatch: 3,
};

export function getHeader(headers: HeaderBag, name: string): string | undefined {
	const target = name.toLowerCase();
	for (const key of Object.keys(headers)) {
		if (key.toLowerCase() !== target) continue;
		const value = headers[key];
		return Array.isArray(value) ? value[0] : value;
	}
	return undefined;
}

function toHex(bytes: Uint8Array): string {
	let hex = '';
	for (const b of bytes) hex += b.toString(16).padStart(2, '0');
	return hex;
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
	return toHex(new Uint8Array(digest));
}

export async function verifySignature(args: VerifySignatureArgs): Promise<SignatureResult> {
	const tolerance = args.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
	const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
	const candidates: Array<['primary' | 'rotated', string | undefined]> = [
		['primary', getHeader(args.headers, SIGNATURE_HEADER)],
		['rotated', getHeader(args.headers, ROTATED_HEADER)],
	];
	if (candidates.every(([, v]) => v === undefined))
		return { verified: false, reason: 'missing_signature' };

	let failure: SignatureFailure = 'malformed_signature';
	const worse = (candidate: SignatureFailure) => {
		if (RANK[candidate] > RANK[failure]) failure = candidate;
	};

	for (const [source, raw] of candidates) {
		if (raw === undefined) continue;
		const match = FORMAT.exec(raw.trim());
		if (!match) continue;
		const t = Number(match[1]);
		if (!Number.isSafeInteger(t)) continue;
		if (tolerance && Math.abs(now - t) > tolerance) {
			worse('timestamp_out_of_tolerance');
			continue;
		}
		const expected = await hmacHex(args.secret, `${t}.${args.payload}`);
		if (constantTimeEqual(expected, match[2])) return { verified: true, signedWith: source };
		worse('signature_mismatch');
	}
	return { verified: false, reason: failure };
}
