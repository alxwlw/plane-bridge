import { expect, test } from 'bun:test';

import { findCyrillic, findCyrillicOutsideRu } from '@alxwlw/plane-kit/testing';

const ROOT = new URL('..', import.meta.url).pathname;
const CATALOG = 'src/i18n.ts';
const ALLOWED: readonly { path: string; line: number; reason: string }[] = [
	{
		path: 'scripts/demo.ts',
		line: 13,
		reason: 'the demo labels come from the Russian test/fixtures/demo-copy.json',
	},
	{
		path: 'scripts/sanitize-fixture.ts',
		line: 105,
		reason:
			'the replacement name inside sanitized Russian fixtures, pinned by test/sanitize.test.ts',
	},
];

test('no Cyrillic outside the catalog', () => {
	const hits = findCyrillic(ROOT, ['src', 'scripts', 'web'])
		.filter((h) => h.path !== CATALOG)
		.filter((h) => !ALLOWED.some((a) => a.path === h.path && a.line === h.line));
	expect(hits).toEqual([]);
});
test('in the catalog, Cyrillic only inside the ru object', () => {
	expect(findCyrillicOutsideRu(ROOT)).toEqual([]);
});
test('the guard sees the Russian catalog', () => {
	expect(findCyrillic(ROOT, ['src']).some((h) => h.path === CATALOG)).toBe(true);
});
test('every allowed place still holds Cyrillic: a stale entry fails the guard', () => {
	const hits = findCyrillic(ROOT, ['src', 'scripts', 'web']);
	const stale = ALLOWED.filter((a) => !hits.some((h) => h.path === a.path && h.line === a.line));
	expect(stale).toEqual([]);
});
