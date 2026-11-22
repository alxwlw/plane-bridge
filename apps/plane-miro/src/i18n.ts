import { esc } from '@alxwlw/plane-kit/html';
import { type Catalog, type Locale } from '@alxwlw/plane-kit/locale';

/** The English catalog: the keys and shapes every locale must have. */
export const en = {
	// The author of a Miro item when the client sent none.
	defaultAuthor: 'Miro user',
	// Plane HTML written from Miro: parameters are escaped here, the tags stay in the builders.
	fromBoardByHtml: (author: string) => `From the Miro board (${esc(author)}):`,
	fromBoardHtml: (author: string) => `From the Miro board: ${esc(author)}`,
	miroTagsHtml: (tags: string) => `Miro tags: ${esc(tags)}`,
	// Plain-text replies of the Miro OAuth routes.
	unknownTenant: 'Unknown tenant',
	missingCode: 'Missing code parameter',
	miroTokenFailed: 'Could not get a Miro token',
	wrongMiroTeam: 'This is not the expected Miro team',
};

export type Messages = Catalog<typeof en>;

export const ru: Messages = {
	defaultAuthor: 'участник Miro',
	fromBoardByHtml: (author) => `С доски Miro (${esc(author)}):`,
	fromBoardHtml: (author) => `С доски Miro: ${esc(author)}`,
	miroTagsHtml: (tags) => `Теги Miro: ${esc(tags)}`,
	unknownTenant: 'Неизвестный тенант',
	missingCode: 'Нет параметра code',
	miroTokenFailed: 'Не удалось получить токен Miro',
	wrongMiroTeam: 'Это не та команда Miro',
};

/** One catalog per locale: a new `Locale` without a catalog is a type error here. */
const CATALOGS: Record<Locale, Messages> = { en, ru };

export function messages(locale: Locale): Messages {
	return CATALOGS[locale];
}
