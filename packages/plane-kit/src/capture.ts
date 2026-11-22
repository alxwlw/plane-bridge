// Receiver for the Plane App probe: records every request it gets, byte for byte.
// Each app's scripts/capture.ts starts it (CAPTURE_DIR defaults to /captures).
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type CaptureLine = {
	ts: string;
	method: string;
	path: string;
	query: Record<string, string>;
	headers: Record<string, string>;
	bodyBase64: string | null;
	bodySha256: string | null;
};

// Headers a capture keeps unless the caller passes its own filter: Authorization and cookies never reach the capture volume.
export const PLANE_HEADERS = /^(x-plane-.*|content-type|user-agent)$/;

const sha256Hex = (bytes: Uint8Array): string =>
	new Bun.CryptoHasher('sha256').update(bytes).digest('hex');

export async function describeRequest(
	req: Request,
	now: Date,
	keepHeader: RegExp = PLANE_HEADERS,
): Promise<CaptureLine> {
	const url = new URL(req.url);
	const headers: Record<string, string> = {};
	for (const [name, value] of req.headers) {
		const key = name.toLowerCase();
		if (keepHeader.test(key)) headers[key] = value;
	}
	const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
	const bytes = hasBody ? new Uint8Array(await req.arrayBuffer()) : null;
	return {
		ts: now.toISOString(),
		method: req.method,
		path: url.pathname,
		query: Object.fromEntries(url.searchParams),
		headers,
		bodyBase64: bytes ? Buffer.from(bytes).toString('base64') : null,
		bodySha256: bytes ? sha256Hex(bytes) : null,
	};
}

export const MAX_BODY_BYTES = 1024 * 1024;

// A limit from the environment: a positive integer, otherwise the default.
// Number('') is 0 and Number('abc') is NaN, so both fall back instead of disabling the limit.
export function parseLimit(value: string | undefined, fallback: number): number {
	const n = Number(value);
	return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

export function limitsFromEnv(env: Record<string, string | undefined>): CaptureLimits {
	return {
		maxFiles: parseLimit(env.CAPTURE_MAX_FILES, 500),
		maxBytes: parseLimit(env.CAPTURE_MAX_BYTES, 50 * 1024 * 1024),
	};
}

export type CaptureLimits = { maxFiles: number; maxBytes: number };

// Handler that stores each request as N-<hash>.bin (raw body) and N-<hash>.json (metadata).
// N continues after the highest number already in the directory, so a restart never
// overwrites old files; writing stops once the directory holds maxFiles requests or maxBytes.
export function createCaptureHandler(
	dir: string,
	limits: CaptureLimits,
	keepHeader: RegExp = PLANE_HEADERS,
) {
	mkdirSync(dir, { recursive: true });
	let n = 0;
	let files = 0;
	let bytes = 0;
	for (const name of readdirSync(dir)) {
		const m = /^(\d+)-[0-9a-f]{8}\.(bin|json)$/.exec(name);
		if (!m) continue;
		n = Math.max(n, Number(m[1]));
		bytes += statSync(join(dir, name)).size;
		if (m[2] === 'bin') files += 1;
	}
	return async (req: Request): Promise<Response> => {
		const raw = new Uint8Array(await req.clone().arrayBuffer());
		const line = await describeRequest(req, new Date(), keepHeader);
		const summary = JSON.stringify({ ...line, bodyBase64: undefined });
		if (files >= limits.maxFiles || bytes + 2 * raw.length + 1024 > limits.maxBytes) {
			console.log(JSON.stringify({ dropped: 'limit', method: line.method, path: line.path }));
			return new Response('ok');
		}
		n += 1;
		files += 1;
		const base = `${n}-${sha256Hex(raw).slice(0, 8)}`;
		// The body lives in the .bin file; the .json carries metadata only.
		const meta = JSON.stringify({ ...line, bodyBase64: undefined });
		writeFileSync(join(dir, `${base}.bin`), raw);
		writeFileSync(join(dir, `${base}.json`), meta);
		bytes += raw.length + meta.length;
		console.log(summary);
		return new Response('ok');
	};
}
