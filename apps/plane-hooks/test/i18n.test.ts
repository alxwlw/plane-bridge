import { expect, test } from 'bun:test';
import { en, messages, ru } from '../src/i18n.ts';

test('both catalogs have the same keys', () => {
	expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
});
test('messages returns the catalog of the locale', () => {
	expect(messages('en')).toBe(en);
	expect(messages('ru')).toBe(ru);
});

test('setupIntroHtml escapes both of its values in both locales', () => {
	for (const locale of ['en', 'ru'] as const) {
		const html = messages(locale).setupIntroHtml('a<b&"c', 'd<e&"f');
		expect(html).toContain('a&lt;b&amp;&quot;c');
		expect(html).toContain('d&lt;e&amp;&quot;f');
		expect(html).not.toContain('<b');
		expect(html).not.toContain('<e');
	}
});
