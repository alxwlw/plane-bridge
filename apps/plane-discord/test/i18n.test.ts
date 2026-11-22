import { expect, test } from 'bun:test';
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
	});
});

test('the sentences with values carry them, in both locales', () => {
	expect(en.planeSilent(5, 'ws')).toBe('Plane has been silent for 5 h (ws): check the webhook');
	expect(ru.planeSilent(5, 'ws')).toBe(
		'Plane молчит 5 ч (ws): проверь вебхук — runbook plane-discord',
	);
});
