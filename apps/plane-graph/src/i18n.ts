import { type Catalog, type Locale } from '@alxwlw/plane-kit/locale';

/** The English catalog: the keys and shapes every locale must have. */
export const en = {
	// The title of the graph page.
	title: 'Work item graph',
};

export type Messages = Catalog<typeof en>;

export const ru: Messages = {
	title: 'Граф задач',
};

const CATALOGS: Record<Locale, Messages> = { en, ru };

export function messages(locale: Locale): Messages {
	return CATALOGS[locale];
}
