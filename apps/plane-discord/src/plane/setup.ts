import { planeOauthCallback, planeSetupRedirect } from '@alxwlw/plane-app';
import type { Log } from '@alxwlw/plane-kit/log';

import type { Config } from '../config.ts';
import { PLANE_SCOPES } from './auth.ts';

/** GET /plane/setup?tenant=<id> → 302 to the Plane consent screen; unknown tenant → 404. */
export function setupRedirect(config: Config, url: URL): Response {
	const id = url.searchParams.get('tenant');
	const tenant = config.tenants.find((t) => t.id === id);
	if (tenant === undefined) {
		return new Response('not found', {
			status: 404,
			headers: { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' },
		});
	}
	return planeSetupRedirect({
		planeUrl: config.planeUrl,
		publicUrl: config.publicUrl,
		clientId: tenant.auth.clientId,
		scopes: PLANE_SCOPES,
	});
}

/**
 * GET /plane/oauth/callback → 200 text/plain echoing app_installation_id for tenants.json; logs plane.installed.
 * Exchanges nothing: the `code` parameter is neither read nor logged. No id → 400.
 */
export function oauthCallback(url: URL, log: Log): Response {
	return planeOauthCallback(url, log);
}
