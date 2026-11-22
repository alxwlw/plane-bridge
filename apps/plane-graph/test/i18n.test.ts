import { esc } from '@alxwlw/plane-kit/html';
import { LOCALES } from '@alxwlw/plane-kit/locale';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { en, messages, ru } from '../src/i18n.ts';

test('both catalogs have the same keys', () => {
	expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
});

test('messages returns the catalog of the locale', () => {
	expect(messages('en')).toBe(en);
	expect(messages('ru')).toBe(ru);
});

test('the catalog imports only browser-safe modules', () => {
	const source = readFileSync(new URL('../src/i18n.ts', import.meta.url), 'utf8');
	const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1] ?? '');
	expect(specifiers.length).toBeGreaterThan(0);
	for (const s of specifiers)
		expect(['@alxwlw/plane-kit/locale', '@alxwlw/plane-kit/html']).toContain(s);
});

test('the graph catalog has no Html entries', () => {
	expect(Object.keys(en).filter((k) => k.endsWith('Html'))).toEqual([]);
});

test('plain entries are HTML-safe', () => {
	for (const locale of LOCALES)
		for (const [key, v] of Object.entries(messages(locale)))
			if (typeof v === 'string') expect(esc(v), `${locale}.${key}`).toBe(v);
});

test('English copy', () => {
	const plain = Object.fromEntries(Object.entries(en).filter(([, v]) => typeof v === 'string'));
	expect(plain).toEqual({ title: 'Work item graph' });
});

test('Russian title is today’s literal', () => {
	expect(ru.title).toBe('Граф задач');
});
