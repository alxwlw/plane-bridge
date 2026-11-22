import { describe, expect, test } from 'bun:test';

import { CREATE_COMMAND } from '../src/discord/commands.ts';
import { commandPayload, submitPayload } from './discord-harness.ts';
import {
	GUILD,
	HIDDEN,
	MAPPED,
	msg,
	P_LAB,
	SECRET_TEXT,
	setup,
	UNMAPPED,
} from './interactions-world.ts';

describe('createInteractionHandler: ix.refused', () => {
	const command = (id: string, over: { channel?: Record<string, unknown>; name?: string } = {}) =>
		commandPayload({
			id,
			guildId: GUILD,
			channel: over.channel ?? { id: UNMAPPED, type: 0 },
			name: over.name ?? CREATE_COMMAND,
			message: msg({ content: SECRET_TEXT }),
		});

	const cases: Array<{
		reason: string;
		world: Parameters<typeof setup>[0];
		payload: (id: string) => Record<string, unknown>;
		hide?: boolean;
	}> = [
		{ reason: 'cold_cache', world: { cached: null }, payload: (id) => command(id) },
		{ reason: 'no_projects', world: { cached: [HIDDEN] }, payload: (id) => command(id) },
		{
			reason: 'hidden_project',
			world: {},
			hide: true,
			payload: (id) => command(id, { channel: { id: MAPPED, type: 0 } }),
		},
		{ reason: 'unknown_command', world: {}, payload: (id) => command(id, { name: 'другая' }) },
		{
			reason: 'unknown_command',
			world: {},
			payload: (id) => ({ ...command(id), type: 3 }),
		},
		{
			reason: 'no_channel',
			world: {},
			payload: (id) => ({ ...command(id), channel: undefined, channel_id: undefined }),
		},
		{
			reason: 'no_message',
			world: {},
			payload: (id) => ({ ...command(id), data: { type: 3, name: CREATE_COMMAND } }),
		},
		{
			reason: 'expired_form',
			world: {},
			payload: (id) =>
				submitPayload({
					id,
					guildId: GUILD,
					customId: 'create:давно-забытая',
					texts: { title: 'X' },
				}),
		},
	];

	for (const c of cases) {
		test(`${c.reason}: одна строка лога с причиной, без текстов`, async () => {
			const w = await setup(c.world);
			if (c.hide === true) w.rt.tenant.hiddenProjects = [P_LAB];
			const id = w.ids.next();
			const res = await w.ask(c.payload(id));
			expect(res.body.type).toBe(4);
			expect(w.logs).toEqual([
				{
					event: 'ix.refused',
					level: 'warn',
					tenant: 'initech',
					interaction: id,
					reason: c.reason,
				},
			]);
			expect(JSON.stringify(w.logs)).not.toContain(SECRET_TEXT);
		});
	}
});

describe('createInteractionHandler: refusals in English', () => {
	test('refusals in English', async () => {
		const answer = async (
			world: Parameters<typeof setup>[0],
			payload: (id: string) => Record<string, unknown>,
		) => {
			const w = await setup({ ...world, locale: 'en' });
			const res = await w.ask(payload(w.ids.next()));
			return res.body.data.content;
		};
		const command = (id: string, over: { channel?: Record<string, unknown>; name?: string } = {}) =>
			commandPayload({
				id,
				guildId: GUILD,
				channel: over.channel ?? { id: UNMAPPED, type: 0 },
				name: over.name ?? CREATE_COMMAND,
				message: msg(),
			});
		expect(await answer({}, (id) => command(id, { name: 'other' }))).toBe('Unknown command.');
		expect(
			await answer({}, (id) => ({ ...command(id), data: { type: 3, name: CREATE_COMMAND } })),
		).toBe('Could not read the message.');
		expect(
			await answer({}, (id) => ({ ...command(id), channel: undefined, channel_id: undefined })),
		).toBe('Could not determine the channel.');
		expect(await answer({ cached: null }, (id) => command(id))).toBe(
			'Plane is unavailable, try again in a minute.',
		);
		expect(await answer({ cached: [HIDDEN] }, (id) => command(id))).toBe(
			'There is no project to create a work item in.',
		);
		const hidden = await setup({ locale: 'en' });
		hidden.rt.tenant.hiddenProjects = [P_LAB];
		const res = await hidden.ask(command(hidden.ids.next(), { channel: { id: MAPPED, type: 0 } }));
		expect(res.body.data.content).toBe(
			'Creating work items from Discord is turned off for this project.',
		);
		expect(await answer({}, (id) => ({ type: 5, id, guild_id: GUILD }))).toBe('Unknown command.');
		expect(
			await answer({}, (id) =>
				submitPayload({ id, guildId: GUILD, customId: 'create:forgotten', texts: { title: 'X' } }),
			),
		).toBe('The form has expired, run the command again.');
	});
});
