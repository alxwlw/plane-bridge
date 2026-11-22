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
	});
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
