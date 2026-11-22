/**
 * Link to a work item in the Plane web app: `<web>/<workspace>/browse/<KEY>/`.
 * `webUrl` is the Plane web address (a trailing slash is dropped, a path prefix is kept), on Plane Cloud
 * `https://app.plane.so`, not the API host `https://api.plane.so`. Workspace and key are URL-encoded.
 */
export function workItemUrl(webUrl: string, workspace: string, key: string): string {
	return `${webUrl.replace(/\/+$/, '')}/${encodeURIComponent(workspace)}/browse/${encodeURIComponent(key)}/`;
}
