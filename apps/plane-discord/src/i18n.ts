import { type Catalog, type Locale } from '@alxwlw/plane-kit/locale';

/** The English catalog: the keys and shapes every locale must have. Texts move in from the modules that send them. */
export const en = {
	// An unknown actor, assignee or mentioned person.
	someone: 'someone',
	// Posts and DMs about a work item: the link text, the DM reasons and the channel headlines.
	openInPlane: 'Open in Plane',
	assigned: 'You were assigned',
	mentionedInDescription: 'You were mentioned in the description',
	mentionedInComment: 'You were mentioned in a comment',
	itemCreated: 'Work item created',
	itemClosed: 'Work item closed',
	itemCancelled: 'Work item cancelled',
	botMentioned: 'Bot mentioned',
	// Answers to an agent run (shown in Plane).
	runInThread: '→ Discord: to the work item thread',
	runNoChannel: 'No channel is set up for this project',
	runNoProject: 'Could not send to Discord: project not found in Plane',
	// Neutral on purpose: no channel names, no hint of what the tenant's map holds.
	runHidden: 'Forwarding to Discord is turned off for this project',
	// Watchdog messages to the service channel (no runbook named: the runbook is private).
	planeBack: 'Plane is sending events again',
	planeSilent: (hours: number, workspace: string) =>
		`Plane has been silent for ${hours} h (${workspace}): check the webhook`,
	// Written into Plane: plain words for an unmapped mention, a nameless file, a link text and the unknown author.
	user: 'user',
	message: 'message',
	messageInDiscord: 'message in Discord',
	file: 'file',
	unknownAuthor: 'unknown',
	role: '@role',
	channel: '#channel',
	// Plane HTML: both parts arrive as ready HTML (a link, an author mention or an escaped name).
	fromDiscordHtml: (linkHtml: string, authorHtml: string) =>
		`From Discord: ${linkHtml} · author: ${authorHtml}`,
};

export type Messages = Catalog<typeof en>;

export const ru: Messages = {
	someone: 'кто-то',
	openInPlane: 'Открыть в Plane',
	assigned: 'Тебя назначили',
	mentionedInDescription: 'Тебя упомянули в описании',
	mentionedInComment: 'Тебя упомянули в комментарии',
	itemCreated: 'Задача создана',
	itemClosed: 'Задача закрыта',
	itemCancelled: 'Задача отменена',
	botMentioned: 'Упомянули бота',
	runInThread: '→ Discord: в тред задачи',
	runNoChannel: 'Канал для проекта не настроен',
	runNoProject: 'Не удалось отправить в Discord: проект не найден в Plane',
	runHidden: 'Пересылка в Discord для этого проекта отключена',
	planeBack: 'Plane снова на связи',
	planeSilent: (hours, workspace) =>
		`Plane молчит ${hours} ч (${workspace}): проверь вебхук — runbook plane-discord`,
	user: 'пользователь',
	message: 'сообщение',
	messageInDiscord: 'сообщение в Discord',
	file: 'файл',
	unknownAuthor: 'неизвестный',
	role: '@роль',
	channel: '#канал',
	fromDiscordHtml: (linkHtml, authorHtml) => `Из Discord: ${linkHtml} · автор: ${authorHtml}`,
};

/** One catalog per locale: a new `Locale` without a catalog is a type error here. */
const CATALOGS: Record<Locale, Messages> = { en, ru };

export function messages(locale: Locale): Messages {
	return CATALOGS[locale];
}
