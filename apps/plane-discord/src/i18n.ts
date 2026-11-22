import { type Catalog, type Locale } from '@alxwlw/plane-kit/locale';

/** The English catalog: the keys and shapes every locale must have. Texts move in from the modules that send them. */
export const en = {};

export type Messages = Catalog<typeof en>;

export const ru: Messages = {};

/** One catalog per locale: a new `Locale` without a catalog is a type error here. */
const CATALOGS: Record<Locale, Messages> = { en, ru };

export function messages(locale: Locale): Messages {
	return CATALOGS[locale];
}
