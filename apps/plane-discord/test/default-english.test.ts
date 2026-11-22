import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';
import type { LogEntry } from '@alxwlw/plane-kit/log';
import { CYRILLIC, expectEnglishOnly } from '@alxwlw/plane-kit/testing';
import { describe, expect, test } from 'bun:test';

import { registerCommands } from '../scripts/register-commands.ts';
import type { Tenant } from '../src/config.ts';
import { messages } from '../src/i18n.ts';
import { Store } from '../src/store.ts';
import { checkSilence } from '../src/watchdog.ts';
import { configOf } from './config-fixture.ts';
import { chatInputPayload, commandPayload } from './discord-harness.ts';
import { FakeDiscord } from './fake-discord.ts';
import {
	AUTHOR,
	GUILD as IX_GUILD,
	MAPPED,
	NOCONF_GUILD,
	open,
	P_LAB,
	msg,
	setup as interactionsSetup,
	submitCreate,
} from './interactions-world.ts';
import {
	BOB,
	comment,
	created,
	FORUM,
	ID,
	ITEM,
	mentionTag,
	PROJECT,
	route,
	runAll,
	setup as notifySetup,
	tenantOf as notifyTenantOf,
} from './notify-world.ts';

/** Every recorded Discord call as one JSON body (JSON.stringify keeps non-ASCII characters as they are). */
const calls = (discord: FakeDiscord): string[] => discord.calls.map((c) => JSON.stringify(c));

/** A notify world whose tenant has no `locale` (the loader fills DEFAULT_LOCALE) and whose texts are ASCII. */
function notifyWorld() {
	const channels = [route(FORUM)];
	const w = notifySetup(channels, { ...notifyTenantOf(channels), locale: DEFAULT_LOCALE });
	const item = w.plane.items.get(ITEM)!;
	w.plane.items.set(ITEM, { ...item, name: 'Title' });
	return w;
}

/** An interactions world of a tenant without `locale`, and a message with ASCII text only. */
const message = (id = '444444444444444441') =>
	msg({
		id,
		content: 'Fix login\nDetails below',
		author: { id: AUTHOR, username: 'mira' },
	});
const interactionsWorld = () => interactionsSetup({ locale: DEFAULT_LOCALE });

describe('a tenant without locale sends no Cyrillic', () => {
	test('discord: a Plane work item created webhook posts to the forum in English', async () => {
		const w = notifyWorld();
		await runAll(await w.notify(created({ name: 'Title' })));
		expect(w.discord.callsOf('createForumPost')).toHaveLength(1);
		expectEnglishOnly(calls(w.discord), 'Work item created');
	});

	test('discord: a Plane comment on a work item with a thread is relayed in English', async () => {
		const w = notifyWorld();
		w.store.putThread('initech', ITEM, FORUM, '140000000000000001', PROJECT);
		w.plane.members = [{ id: ID(98), displayName: '', avatarUrl: null }];
		await runAll(await w.notify(comment(`<p>Looks good ${mentionTag(ID(98))}</p>`, BOB)));
		expect(w.discord.callsOf('executeWebhook')).toHaveLength(1);
		expectEnglishOnly(calls(w.discord), '@someone');
	});

	test('discord: the English message command opens a modal, creates the work item and confirms', async () => {
		const w = await interactionsWorld();
		const { customId, body } = await open(w, {
			name: messages(DEFAULT_LOCALE).createCommand,
			message: message(),
		});
		const submit = await submitCreate(w, customId, { title: 'Fix login', description: 'Details' });
		await w.settle();
		expect(w.plane.createdItems).toHaveLength(1);
		expect(submit.status).toBe(200);
		const bodies = [
			JSON.stringify(body),
			JSON.stringify(submit.body),
			JSON.stringify(w.plane.createdItems),
			...calls(w.discord),
		];
		expectEnglishOnly(bodies, 'Plane work item');
		expect(bodies.some((b) => b.includes('From Discord'))).toBe(true);
		expect(w.plane.createdItems[0]?.projectId).toBe(P_LAB);
	});

	test('discord: a command registered in Russian before the default flipped dispatches and answers in English', async () => {
		const w = await interactionsWorld();
		// The one Cyrillic input of this file is the name Discord sends; the check covers what goes out.
		const { customId, body } = await open(w, {
			name: messages('ru').createCommand,
			message: message(),
		});
		expect(body.data.title).toBe('Plane work item');
		const submit = await submitCreate(w, customId, { title: 'Fix login', description: 'Details' });
		await w.settle();
		expect(w.plane.createdItems).toHaveLength(1);
		const bodies = [
			JSON.stringify(body),
			JSON.stringify(submit.body),
			JSON.stringify(w.plane.createdItems),
			...calls(w.discord),
		];
		expectEnglishOnly(bodies, 'From Discord');
	});

	test('discord: /plane answers with an English card', async () => {
		const w = await interactionsWorld();
		w.plane.states.set(P_LAB, [{ id: 's-doing', name: 'In Progress', group: 'started' }]);
		w.plane.items.set('w40', {
			id: 'w40',
			projectId: P_LAB,
			sequenceId: 40,
			name: 'Fix login',
			stateId: 's-doing',
			assignees: [],
			priority: 'urgent',
			descriptionHtml: null,
		});
		const res = await w.ask(
			chatInputPayload({
				id: w.ids.next(),
				guildId: IX_GUILD,
				name: 'plane',
				options: [{ name: 'key', type: 3, value: 'lab-40' }],
			}),
		);
		await w.settle();
		expect(w.discord.callsOf('editOriginal')).toHaveLength(1);
		expectEnglishOnly([JSON.stringify(res.body), ...calls(w.discord)], 'Assignees');
		expect(calls(w.discord).some((b) => b.includes('Urgent'))).toBe(true);
	});

	test('discord: the watchdog writes to the service channel in English when Plane stops answering and when it answers again', async () => {
		const HOUR = 3_600_000;
		const SERVICE = '222222222222222222';
		const tenant: Tenant = {
			id: 'initech',
			guildId: '111111111111111111',
			workspace: 'example-ws',
			locale: DEFAULT_LOCALE,
			workspaceId: '00000000-0000-4000-8000-000000000001',
			auth: { clientId: 'c', clientSecret: 's', appInstallationId: 'i' },
			webhookSecret: 'h',
			serviceChannelId: SERVICE,
			silenceHours: 72,
			hiddenProjects: [],
			channels: [],
			users: [],
		};
		const store = new Store(':memory:');
		const discord = new FakeDiscord();
		const logs: LogEntry[] = [];
		const check = (now: number) =>
			checkSilence({
				tenants: [tenant],
				store,
				discord,
				log: (e) => logs.push(e),
				now,
				startedAt: 0,
			});
		store.touchEvent('initech', 0);
		await check(73 * HOUR + 5);
		store.touchEvent('initech', 81 * HOUR);
		await check(82 * HOUR);
		expect(discord.callsOf('sendMessage')).toHaveLength(2);
		const bodies = calls(discord);
		expectEnglishOnly(bodies, 'Plane has been silent for 73 h');
		expect(bodies.some((b) => b.includes('Plane is sending events again'))).toBe(true);
	});

	test('discord: registering the commands of the tenant uses the English names and descriptions', async () => {
		const base = configOf().tenants[0]!;
		const sent: string[] = [];
		await registerCommands(
			[{ ...base, locale: DEFAULT_LOCALE }],
			{
				async bulkOverwriteGuildCommands(_guild, commands) {
					sent.push(JSON.stringify(commands));
				},
			},
			() => {},
		);
		expectEnglishOnly(sent, 'Create Plane work item');
		expect(sent[0]).toContain('Add to work item');
	});

	test('discord: an interaction from a guild no tenant owns gets notConfigured of the default locale', async () => {
		const w = await interactionsWorld();
		const res = await w.ask(
			commandPayload({
				id: w.ids.next(),
				guildId: NOCONF_GUILD,
				channel: { id: MAPPED, type: 0 },
				name: messages(DEFAULT_LOCALE).createCommand,
				message: message(),
			}),
		);
		expect(res.body.data.content).toBe('This server is not set up.');
		expectEnglishOnly([JSON.stringify(res.body)], 'This server is not set up.');
	});
});
