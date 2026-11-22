import { expect, test } from 'bun:test';
import { type Catalog, DEFAULT_LOCALE, isLocale, LOCALES } from '../src/locale.ts';

test('isLocale accepts exactly en and ru', () => {
	expect(LOCALES.filter(isLocale)).toEqual(['en', 'ru']);
	for (const v of ['RU', 'en-US', '', null, undefined, 1]) expect(isLocale(v)).toBe(false);
});
test('the default locale is one of the locales', () => {
	expect(LOCALES).toContain(DEFAULT_LOCALE);
});
test('the default locale is en', () => {
	expect(DEFAULT_LOCALE).toBe('en');
});

// Type-level: `typecheck` fails when Catalog stops rejecting an extra or a missing key,
// or stops carrying a function entry's parameters.
// @ts-expect-error an extra key
const extra: Catalog<{ a: string }> = { a: 'x', b: 'y' };
// @ts-expect-error a missing key
const missing: Catalog<{ a: string }> = {};
// @ts-expect-error a string where a function is required
const notFn: Catalog<{ f: (n: number) => string }> = { f: 'x' };
// @ts-expect-error the parameter type of a function entry is kept
const badParam: Catalog<{ f: (n: number) => string }> = { f: (n: string) => n };
const okFn: Catalog<{ f: (n: number) => string; s: string }> = { f: (n) => `${n}`, s: 'x' };

test('the Catalog type checks are in place', () => {
	expect([extra, missing, notFn, badParam]).toHaveLength(4);
	expect(okFn.f(1)).toBe('1');
});
