// Overwrites the guild commands of every tenant with guildCommands(tenant). Run in the container:
//   docker exec <container> bun scripts/register-commands.ts
import { readFileSync } from 'node:fs';
import { loadConfig, type Tenant } from '../src/config.ts';
import { guildCommands } from '../src/discord/commands.ts';
import { DiscordRest } from '../src/discord/rest.ts';

/** Registers each tenant's commands in its own guild, in the tenant's language; prints one line per tenant. */
export async function registerCommands(
	tenants: readonly Tenant[],
	discord: {
		bulkOverwriteGuildCommands(guildId: string, commands: readonly unknown[]): Promise<void>;
	},
	log: (line: string) => void = console.log,
): Promise<void> {
	for (const tenant of tenants) {
		const commands = guildCommands(tenant);
		await discord.bulkOverwriteGuildCommands(tenant.guildId, commands);
		log(`✓ ${tenant.id} ${tenant.locale} ${commands.length} commands`);
	}
}

if (import.meta.main) {
	const config = loadConfig(process.env, (path) => readFileSync(path, 'utf8'));
	const discord = new DiscordRest({
		botToken: config.discord.botToken,
		applicationId: config.discord.applicationId,
	});
	await registerCommands(config.tenants, discord);
}
