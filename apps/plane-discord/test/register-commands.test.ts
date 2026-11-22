import { expect, test } from 'bun:test';
import { registerCommands } from '../scripts/register-commands.ts';
import { configOf } from './config-fixture.ts';

test('each guild gets the commands of its own tenant, in that tenant language', async () => {
	const base = configOf().tenants[0]!;
	const tenants = [
		{ ...base, id: 'alpha', guildId: '111111111111111111', locale: 'en' as const },
		{ ...base, id: 'beta', guildId: '222222222222222222', locale: 'ru' as const },
	];
	const sent: { guildId: string; names: string[] }[] = [];
	const lines: string[] = [];
	await registerCommands(
		tenants,
		{
			async bulkOverwriteGuildCommands(guildId, commands) {
				sent.push({ guildId, names: (commands as { name: string }[]).map((c) => c.name) });
			},
		},
		(line) => lines.push(line),
	);
	expect(sent.map((s) => s.guildId)).toEqual(['111111111111111111', '222222222222222222']);
	expect(sent[0]!.names).toContain('Create Plane work item');
	expect(sent[0]!.names).not.toContain('Создать задачу в Plane');
	expect(sent[1]!.names).toContain('Создать задачу в Plane');
	expect(sent[1]!.names).not.toContain('Create Plane work item');
	expect(lines).toEqual(['✓ alpha en 4 commands', '✓ beta ru 4 commands']);
});
