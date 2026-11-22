import { expect, test } from 'bun:test';
import { LOCALES } from '@alxwlw/plane-kit/locale';
import { en, messages, ru } from '../src/i18n.ts';

test('both catalogs have the same keys', () => {
	expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
});
test('messages returns the catalog of the locale', () => {
	expect(messages('en')).toBe(en);
	expect(messages('ru')).toBe(ru);
});

test('the English plain strings, pinned literally', () => {
	const plain = Object.fromEntries(Object.entries(en).filter(([, v]) => typeof v === 'string'));
	expect(plain).toEqual({
		someone: 'someone',
		openInPlane: 'Open in Plane',
		assigned: 'You were assigned',
		mentionedInDescription: 'You were mentioned in the description',
		mentionedInComment: 'You were mentioned in a comment',
		itemCreated: 'Work item created',
		itemClosed: 'Work item closed',
		itemCancelled: 'Work item cancelled',
		botMentioned: 'Bot mentioned',
		runInThread: '→ Discord: to the work item thread',
		runNoChannel: 'No channel is set up for this project',
		runNoProject: 'Could not send to Discord: project not found in Plane',
		runHidden: 'Forwarding to Discord is turned off for this project',
		planeBack: 'Plane is sending events again',
		user: 'user',
		message: 'message',
		messageInDiscord: 'message in Discord',
		file: 'file',
		unknownAuthor: 'unknown',
		role: '@role',
		channel: '#channel',
		notConfigured: 'This server is not set up.',
		alreadyHandled: 'Already handled.',
		brokenRequest: 'Could not read the Discord request.',
		unknownCommand: 'Unknown command.',
		noMessage: 'Could not read the message.',
		noChannel: 'Could not determine the channel.',
		coldCache: 'Plane is unavailable, try again in a minute.',
		noProjects: 'There is no project to create a work item in.',
		creationHidden: 'Creating work items from Discord is turned off for this project.',
		formExpired: 'The form has expired, run the command again.',
		itemMissing: 'Work item not found.',
		internal: 'Internal error, try again in a minute.',
		titleRequired: 'A title is required.',
		noProjectChosen: 'No project selected.',
		projectNotOffered: 'This project is not in the list, run the command again.',
		noPostPermission: 'no permission to post in the channel',
		keyFormat: 'Use a key like LAB-40.',
		internalError: 'internal error',
		projectNotInPlane: 'project not found in Plane',
		appendModalTitle: 'Comment on a work item',
		keyLabel: 'Work item key',
		textLabel: 'Text',
		createModalTitle: 'Plane work item',
		createCommand: 'Create Plane work item',
		appendCommand: 'Add to work item',
		planeCommandDescription: 'Plane work item card',
		planeLinkCommandDescription: 'Link this thread to a Plane work item',
		keyOptionDescription: 'Work item key, e.g. LAB-40',
		titleLabel: 'Title',
		descriptionLabel: 'Description',
		projectLabel: 'Project',
		notThread: 'This command works in a thread.',
		cannotJoinThread: 'Cannot join the thread: add @Plane to the thread and try again.',
		threadLinkedElsewhere: 'This thread is already linked to another work item.',
		stateField: 'State',
		assigneesField: 'Assignees',
		priorityField: 'Priority',
		priorityUrgent: 'Urgent',
		priorityHigh: 'High',
		priorityMedium: 'Medium',
		priorityLow: 'Low',
	});
});

test('the thread link sentences carry their values, in both locales', () => {
	expect(en.threadLinkedTo('LAB-1')).toBe('This thread is already linked to LAB-1.');
	expect(ru.threadLinkedTo('LAB-1')).toBe('Тред уже привязан к LAB-1.');
	expect(en.threadLinked('[T](<u>)')).toBe('Thread linked to [T](<u>).');
	expect(ru.threadLinked('[T](<u>)')).toBe('Тред привязан к [T](<u>).');
});

test('the sentences with values carry them, in both locales', () => {
	expect(en.planeSilent(5, 'ws')).toBe('Plane has been silent for 5 h (ws): check the webhook');
	expect(ru.planeSilent(5, 'ws')).toBe(
		'Plane молчит 5 ч (ws): проверь вебхук — runbook plane-discord',
	);
});

// Every entry that returns Plane HTML. `fromDiscordHtml` takes only ready HTML, so every argument must arrive verbatim.
const HTML_ENTRIES: Record<string, (m: typeof en) => string> = {
	fromDiscordHtml: (m) => m.fromDiscordHtml('<a href="u">LINK</a>', '<b>AUTHOR</b>'),
};

test('every Html entry escapes its text parameters', () => {
	expect(Object.keys(HTML_ENTRIES).sort()).toEqual(
		Object.keys(en)
			.filter((k) => k.endsWith('Html'))
			.sort(),
	);
	for (const locale of LOCALES) {
		for (const [key, call] of Object.entries(HTML_ENTRIES)) {
			const out = call(messages(locale));
			expect(out, `${locale}.${key}`).toContain('<a href="u">LINK</a>');
			expect(out, `${locale}.${key}`).toContain('<b>AUTHOR</b>');
		}
	}
});

test('the message-command sentences carry their values, in both locales', () => {
	expect([en.quoted('x'), ru.quoted('x')]).toEqual(['“x”', '«x»']);
	expect([en.alreadyExists('T'), ru.alreadyExists('T')]).toEqual([
		'Already exists: T',
		'Уже есть: T',
	]);
	expect([en.createdWithProblem('T', 'why'), ru.createdWithProblem('T', 'why')]).toEqual([
		'Work item created: T — why.',
		'Задача создана: T — why.',
	]);
	expect([en.keyNotFound('LAB-1'), ru.keyNotFound('LAB-1')]).toEqual([
		'Work item LAB-1 not found',
		'Задача LAB-1 не найдена',
	]);
	expect([en.alreadyAdded('W'), ru.alreadyAdded('W')]).toEqual([
		'Already added: W',
		'Уже добавлено: W',
	]);
	expect([en.commentAdded('W'), ru.commentAdded('W')]).toEqual([
		'→ comment in W',
		'→ комментарий в W',
	]);
	expect([en.failed('r'), ru.failed('r')]).toEqual(['Failed: r.', 'Не получилось: r.']);
	expect([en.planeAnswered(500), ru.planeAnswered(500)]).toEqual([
		'Plane answered 500',
		'Plane ответил 500',
	]);
	expect([en.discordAnswered(500), ru.discordAnswered(500)]).toEqual([
		'Discord answered 500',
		'Discord ответил 500',
	]);
});

test("modal titles and labels fit Discord's limit", () => {
	for (const locale of LOCALES) {
		const m = messages(locale);
		for (const text of [
			m.appendModalTitle,
			m.createModalTitle,
			m.keyLabel,
			m.textLabel,
			m.titleLabel,
			m.descriptionLabel,
			m.projectLabel,
		])
			expect(Array.from(text).length, `${locale}: ${text}`).toBeLessThanOrEqual(45);
	}
});
