import { expect, test } from 'bun:test';
import { en, messages, ru } from '../src/i18n.ts';

test('both catalogs have the same keys', () => {
	expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
});
test('messages returns the catalog of the locale', () => {
	expect(messages('en')).toBe(en);
	expect(messages('ru')).toBe(ru);
});
