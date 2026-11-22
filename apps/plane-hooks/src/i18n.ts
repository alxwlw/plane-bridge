import { type Catalog, type Locale } from '@alxwlw/plane-kit/locale';

/** The English catalog: the keys and shapes every locale must have. Texts move in from the modules that send them. */
export const en = {};

export type Messages = Catalog<typeof en>;

export const ru: Messages = {};

export function messages(locale: Locale): Messages {
	return locale === 'en' ? en : ru;
}
