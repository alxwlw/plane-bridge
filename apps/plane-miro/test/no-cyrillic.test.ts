import { expect, test } from 'bun:test';

import { findCyrillic } from '@alxwlw/plane-kit/testing';

const ROOT = new URL('..', import.meta.url).pathname;
const CATALOG = 'src/i18n.ts';
const ALLOWED: readonly { path: string; line: number; reason: string }[] = [];

test('no Cyrillic outside the catalog', () => {
	const hits = findCyrillic(ROOT, ['src', 'scripts', 'web'])
		.filter((h) => h.path !== CATALOG)
		.filter((h) => !ALLOWED.some((a) => a.path === h.path && a.line === h.line));
	expect(hits).toEqual([]);
});
test('the guard sees the Russian catalog', () => {
	expect(findCyrillic(ROOT, ['src']).some((h) => h.path === CATALOG)).toBe(true);
});
test('every allowed place still holds Cyrillic: a stale entry fails the guard', () => {
	const hits = findCyrillic(ROOT, ['src', 'scripts', 'web']);
	const stale = ALLOWED.filter((a) => !hits.some((h) => h.path === a.path && h.line === a.line));
	expect(stale).toEqual([]);
});
