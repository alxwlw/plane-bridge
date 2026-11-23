/**
 * The statuses of `POST /releases/` that make probe-plane.ts skip the release section instead of failing it:
 * 402 — the workspace plan has no releases (Free); 403 — an App bot token cannot write releases (Plane
 * exposes no releases scope to Apps), which is what the README documents. Returns the "actual" text of the
 * skipped row, or null when the section must run.
 */
export function releaseSectionSkip(status: number): string | null {
	if (status === 402) return '402, the releases section skipped';
	if (status === 403)
		return '403, the releases section skipped (an App bot token has no releases scope)';
	return null;
}
