// Commands of the current phase: message commands (phase 1, design §3 «1c») `/plane KEY` (phase 2) and `/plane-link KEY` (phase 3).
import { LOCALES } from '@alxwlw/plane-kit/locale';

import { type Tenant } from '../config.ts';
import { type Messages, messages } from '../i18n.ts';

export const PLANE_COMMAND = 'plane';
export const PLANE_LINK_COMMAND = 'plane-link';
export const PLANE_KEY_OPTION = 'key';

const CHAT_INPUT_COMMAND = 1;
const MESSAGE_COMMAND = 3;
const STRING_OPTION = 3;
const GUILD_CONTEXT = 0;
const GUILD_INSTALL = 0;

/** Every command of the current phase: the body of a per-guild bulk overwrite. */
export function commandDefinitions(m: Messages): unknown[] {
	const messageCommands = [m.createCommand, m.appendCommand].map((name) => ({
		name,
		type: MESSAGE_COMMAND,
		contexts: [GUILD_CONTEXT],
		integration_types: [GUILD_INSTALL],
	}));
	return [
		...messageCommands,
		{
			name: PLANE_COMMAND,
			type: CHAT_INPUT_COMMAND,
			description: m.planeCommandDescription,
			options: [
				{
					name: PLANE_KEY_OPTION,
					type: STRING_OPTION,
					description: m.keyOptionDescription,
					required: true,
				},
			],
			contexts: [GUILD_CONTEXT],
			integration_types: [GUILD_INSTALL],
		},
		{
			name: PLANE_LINK_COMMAND,
			type: CHAT_INPUT_COMMAND,
			description: m.planeLinkCommandDescription,
			options: [
				{
					name: PLANE_KEY_OPTION,
					type: STRING_OPTION,
					description: m.keyOptionDescription,
					required: true,
				},
			],
			contexts: [GUILD_CONTEXT],
			integration_types: [GUILD_INSTALL],
		},
	];
}

/** The commands of one guild, in the language of its tenant. */
export function guildCommands(tenant: Tenant): unknown[] {
	return commandDefinitions(messages(tenant.locale));
}

/** Which message command a name is, in any locale: guilds keep the names they were registered with. */
export function messageCommandKind(name: unknown): 'create' | 'append' | null {
	if (LOCALES.some((l) => messages(l).createCommand === name)) return 'create';
	if (LOCALES.some((l) => messages(l).appendCommand === name)) return 'append';
	return null;
}
