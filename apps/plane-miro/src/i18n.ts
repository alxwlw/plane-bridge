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
	// Panel and card viewer texts, written to the page through textContent, placeholder or the title.
	errorUnauthorized: 'The Miro session has expired — reload the board.',
	errorUnknownTeam: 'This Miro team is not connected to Plane.',
	errorBoardNoAccess:
		'The service account cannot write to this board. Share the board with the team and try again; on the Free plan only the team’s three most recent boards can be edited.',
	errorMiroNotConnected: 'The service is not connected to Miro yet. Contact your administrator.',
	errorUnknownProject: 'Project not found or hidden.',
	errorUnknownCard: 'This card is not linked to a work item.',
	errorPlaneFailed: 'Plane did not answer — try again.',
	errorMiroFailed: 'Miro did not answer — try again.',
	errorNotFound: 'item not found',
	errorUnsupportedType: 'this item type cannot be converted',
	errorEmptyText: 'empty sticky note',
	errorAlreadyLinked: 'the sticky note is already linked to another work item',
	errorFallback: 'Something went wrong.',
	done: (keys: string) => `Done: ${keys}.`,
	failed: (count: number, reasons: string) => `Failed: ${count} — ${reasons}.`,
	selected: (count: number) => `Selected for Plane: ${count}`,
	nothingFound: 'Nothing found.',
	converting: (done: number, total: number) => `Converting: ${done} of ${total}…`,
	projectLabel: 'Project',
	toPlane: 'To Plane',
	bindHeading: 'Link to a work item',
	searchPlaceholder: 'Key or words from the title',
	bind: 'Link',
	cardTitle: 'Plane work item',
	loading: 'Loading…',
	openInPlane: 'Open in Plane',
	stateField: 'State',
	assigneesField: 'Assignees',
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
	errorUnauthorized: 'Сессия Miro устарела — перезагрузите доску.',
	errorUnknownTeam: 'Эта команда Miro не подключена к Plane.',
	errorBoardNoAccess:
		'Служебный аккаунт не может писать на эту доску. Откройте доступ к доске команде и повторите; на плане Free редактируются только три последние доски команды.',
	errorMiroNotConnected: 'Сервис ещё не подключён к Miro. Напишите администратору.',
	errorUnknownProject: 'Проект не найден или скрыт.',
	errorUnknownCard: 'Карточка не связана с задачей.',
	errorPlaneFailed: 'Plane не ответил — попробуйте ещё раз.',
	errorMiroFailed: 'Miro не ответил — попробуйте ещё раз.',
	errorNotFound: 'элемент не найден',
	errorUnsupportedType: 'этот тип элемента не переносится',
	errorEmptyText: 'пустой стикер',
	errorAlreadyLinked: 'стикер уже связан с другой задачей',
	errorFallback: 'Что-то пошло не так.',
	done: (keys) => `Готово: ${keys}.`,
	failed: (count, reasons) => `Не вышло: ${count} — ${reasons}.`,
	selected: (count) => `Выделено для Plane: ${count}`,
	nothingFound: 'Ничего не найдено.',
	converting: (done, total) => `Переношу: ${done} из ${total}…`,
	projectLabel: 'Проект',
	toPlane: 'В Plane',
	bindHeading: 'Привязать к задаче',
	searchPlaceholder: 'Ключ или слова из названия',
	bind: 'Привязать',
	cardTitle: 'Задача Plane',
	loading: 'Загрузка…',
	openInPlane: 'Открыть в Plane',
	stateField: 'Статус',
	assigneesField: 'Исполнители',
};

/** One catalog per locale: a new `Locale` without a catalog is a type error here. */
const CATALOGS: Record<Locale, Messages> = { en, ru };

export function messages(locale: Locale): Messages {
	return CATALOGS[locale];
}
