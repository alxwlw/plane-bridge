// DOM-free on purpose (a structural document type): the root tsconfig and the tests reach it without the browser SDK.
import { DEFAULT_LOCALE, type Locale } from '@alxwlw/plane-kit/locale';

import { type Messages, messages } from '../src/i18n.ts';
import { type ApiResult, localeFrom } from './logic.ts';

/** The catalog a page uses until its tenant's locale arrives. */
export const DEFAULT_MESSAGES: Messages = messages(DEFAULT_LOCALE);

/** The part of a DOM element a text slot needs. */
export type Slot = {
	dataset: Record<string, string | undefined>;
	textContent: string | null;
	placeholder?: string;
};
/** The part of `Document` `applyTexts` touches. */
export type SlotDocument = {
	documentElement: { lang: string };
	querySelectorAll(selector: string): Iterable<Slot>;
};

/**
 * Fills the page's text slots: `data-text="<key>"` gets `textContent`, `data-placeholder="<key>"` gets
 * `placeholder`. A key that is not a plain string entry of the catalog is left alone.
 */
export function applyTexts(doc: SlotDocument, m: Messages, locale: Locale): void {
	const entry = (key: string | undefined): string | null => {
		if (key === undefined || !Object.hasOwn(m, key)) return null;
		const value = (m as Record<string, unknown>)[key];
		return typeof value === 'string' ? value : null;
	};
	for (const el of doc.querySelectorAll('[data-text]')) {
		const text = entry(el.dataset.text);
		if (text !== null) el.textContent = text;
	}
	for (const el of doc.querySelectorAll('[data-placeholder]')) {
		const text = entry(el.dataset.placeholder);
		if (text !== null) el.placeholder = text;
	}
	doc.documentElement.lang = locale;
}

/**
 * The one place a client picks its catalog: asks the server for the tenant's locale (`call`), fills the
 * page's slots and returns the catalog. A failed call gives the default locale.
 */
export async function loadTenantTexts(
	call: () => Promise<ApiResult<unknown>>,
	doc: SlotDocument,
): Promise<Messages> {
	const locale = localeFrom(await call());
	const m = messages(locale);
	applyTexts(doc, m, locale);
	return m;
}
