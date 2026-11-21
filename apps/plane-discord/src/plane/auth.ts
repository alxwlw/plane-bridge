import {
	botTokenAuth as planeBotTokenAuth,
	type Fetch,
	type PlaneAuth,
	PlaneAuthError,
} from '@alxwlw/plane-app';

export { type Fetch, type PlaneAuth, PlaneAuthError };

/** The 13 scopes of the Plane App registration (Global Constraints), sent space-separated as `scope`. */
export const PLANE_SCOPES: readonly string[] = [
	'projects:read',
	'projects.work_items:read',
	'projects.work_items:write',
	'projects.work_items.comments:read',
	'projects.work_items.comments:write',
	'projects.states:read',
	'projects.members:read',
	'projects.modules:read',
	'workspaces.members:read',
	'agents.runs:read',
	'agents.runs:write',
	'agents.run_activities:read',
	'agents.run_activities:write',
];

/** Bot token of a workspace-level Plane App installation, requested with the app's `PLANE_SCOPES`. */
export function botTokenAuth(opts: {
	planeUrl: string;
	clientId: string;
	clientSecret: string;
	appInstallationId: string;
	fetch?: Fetch;
	now?: () => number;
}): PlaneAuth {
	return planeBotTokenAuth({ ...opts, scopes: PLANE_SCOPES });
}
