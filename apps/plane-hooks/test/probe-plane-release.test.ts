import { expect, test } from 'bun:test';
import { releaseSectionSkip } from '../scripts/probe-plane-release.ts';

test('a plan without releases (402) skips the release section and says why', () => {
	expect(releaseSectionSkip(402)).toBe('402, the releases section skipped');
});

test('an App bot token refused for releases (403) skips the release section and says why', () => {
	expect(releaseSectionSkip(403)).toBe(
		'403, the releases section skipped (an App bot token has no releases scope)',
	);
});

test('a created release (201) and other answers do not skip the section', () => {
	for (const status of [201, 200, 400, 404, 409, 429, 500]) {
		expect(releaseSectionSkip(status)).toBeNull();
	}
});
