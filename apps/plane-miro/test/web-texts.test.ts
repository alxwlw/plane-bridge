import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';
import { describe, expect, test } from 'bun:test';

import { en, messages } from '../src/i18n.ts';
import { applyTexts, loadTenantTexts, type SlotDocument } from '../web/apply-texts.ts';

type Slot = { dataset: Record<string, string>; textContent: string; placeholder: string };

const slot = (dataset: Record<string, string>): Slot => ({
	dataset,
	textContent: 'untouched',
	placeholder: 'untouched',
});

function fakeDoc(texts: Slot[], placeholders: Slot[]) {
	const documentElement = { lang: '' };
	const doc: SlotDocument = {
		documentElement,
		querySelectorAll: (selector) => (selector === '[data-text]' ? texts : placeholders),
	};
	return { doc, documentElement };
}

describe('applyTexts', () => {
	test('applyTexts fills text and placeholder slots', () => {
		for (const [locale, toPlane, placeholder] of [
			['en', 'To Plane', 'Key or words from the title'],
			['ru', 'В Plane', 'Ключ или слова из названия'],
		] as const) {
			const button = slot({ text: 'toPlane' });
			const fn = slot({ text: 'selected' });
			const unknown = slot({ text: 'nope' });
			const input = slot({ placeholder: 'searchPlaceholder' });
			const { doc, documentElement } = fakeDoc([button, fn, unknown], [input]);
			applyTexts(doc, messages(locale), locale);
			expect(button.textContent).toBe(toPlane);
			expect(input.placeholder).toBe(placeholder);
			expect(fn.textContent).toBe('untouched');
			expect(unknown.textContent).toBe('untouched');
			expect(documentElement.lang).toBe(locale);
		}
	});

	test('a prototype key is not a slot', () => {
		const el = slot({ text: 'constructor' });
		const { doc } = fakeDoc([el], []);
		applyTexts(doc, messages('en'), 'en');
		expect(el.textContent).toBe('untouched');
	});
});

describe('the pages', () => {
	const dir = new URL('../web/', import.meta.url).pathname;
	const pages = readdirSync(dir).filter((f) => f.endsWith('.html'));
	const read = (name: string) => readFileSync(join(dir, name), 'utf8');

	test('every slot of the pages names a plain catalog entry', () => {
		expect(pages.sort()).toEqual(['app.html', 'card.html', 'panel.html']);
		for (const page of pages) {
			const html = read(page);
			const keys = [...html.matchAll(/data-(?:text|placeholder)="([^"]+)"/g)].map(
				(m) => m[1] ?? '',
			);
			for (const key of keys) {
				expect(Object.hasOwn(en, key), `${page}: ${key}`).toBe(true);
				expect(typeof (en as Record<string, unknown>)[key], `${page}: ${key}`).toBe('string');
			}
			expect(html, page).not.toMatch(/<html[^>]*\blang=/);
		}
	});

	test('the panel and the card carry their slots', () => {
		const panel = read('panel.html');
		for (const slotAttr of [
			'data-text="projectLabel"',
			'data-text="toPlane"',
			'data-text="bindHeading"',
			'data-placeholder="searchPlaceholder"',
			'data-text="bind"',
		])
			expect(panel).toContain(slotAttr);
		expect(read('card.html')).toContain('<title data-text="cardTitle"></title>');
	});
});

describe('loadTenantTexts', () => {
	const run = async (answer: unknown) => {
		const button = slot({ text: 'toPlane' });
		const { doc, documentElement } = fakeDoc([button], []);
		const m = await loadTenantTexts(async () => answer as never, doc);
		return { m, button, lang: documentElement.lang };
	};

	test('the catalog and the slots follow the answered locale', async () => {
		const en = await run({ ok: true, data: { locale: 'en' } });
		expect(en.m.selected(1)).toBe('Selected for Plane: 1');
		expect(en.button.textContent).toBe('To Plane');
		expect(en.lang).toBe('en');
		const ru = await run({ ok: true, data: { locale: 'ru' } });
		expect(ru.m.selected(1)).toBe('Выделено для Plane: 1');
		expect(ru.button.textContent).toBe('В Plane');
		expect(ru.lang).toBe('ru');
	});

	test('a failed or unusable answer is the default locale', async () => {
		for (const answer of [
			{ ok: false, error: 'network' },
			{ ok: true, data: { locale: 'fr' } },
		]) {
			const out = await run(answer);
			expect(out.m).toBe(messages(DEFAULT_LOCALE));
			expect(out.lang).toBe(DEFAULT_LOCALE);
		}
	});
});

describe('the entry scripts', () => {
	test('panel and card take their catalog only from loadTenantTexts', () => {
		for (const name of ['panel', 'card']) {
			const source = readFileSync(new URL(`../web/${name}.ts`, import.meta.url), 'utf8');
			expect(source, name).toContain("loadTenantTexts(() => api('/miro/api/locale'), document)");
			expect(source, name).not.toMatch(/\bmessages\(/);
			expect(source, name).not.toContain('../src/i18n.ts');
		}
	});
});
