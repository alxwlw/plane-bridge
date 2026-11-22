import { createCaptureHandler, limitsFromEnv, MAX_BODY_BYTES } from '@alxwlw/plane-kit/capture';

// Plane, GitHub and Vercel delivery headers are kept; Authorization and cookies never reach the capture volume.
export const KEEP_HEADER =
	/^(x-plane-.*|x-github-.*|x-hub-signature.*|x-vercel-.*|content-type|user-agent)$/;

// One-off receiver for the Plane App probe: records every request it gets, byte for byte.
// Run: bun scripts/capture.ts (CAPTURE_DIR defaults to /captures).
if (import.meta.main) {
	const dir = process.env.CAPTURE_DIR ?? '/captures';
	Bun.serve({
		port: 8080,
		development: false,
		maxRequestBodySize: MAX_BODY_BYTES,
		fetch: createCaptureHandler(dir, limitsFromEnv(process.env), KEEP_HEADER),
	});
}
