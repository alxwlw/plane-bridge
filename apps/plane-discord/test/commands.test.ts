import { expect, test } from 'bun:test';
import { LOCALES } from '@alxwlw/plane-kit/locale';
import { commandDefinitions, guildCommands, messageCommandKind } from '../src/discord/commands.ts';
import { messages } from '../src/i18n.ts';
import { configOf } from './config-fixture.ts';

const keyOption = (description: string) => [{ name: 'key', type: 3, description, required: true }];
const listOf = (names: [string, string], descriptions: [string, string, string]) => [
	{ name: names[0], type: 3, contexts: [0], integration_types: [0] },
	{ name: names[1], type: 3, contexts: [0], integration_types: [0] },
	{
		name: 'plane',
		type: 1,
		description: descriptions[0],
		options: keyOption(descriptions[2]),
		contexts: [0],
		integration_types: [0],
	},
	{
		name: 'plane-link',
		type: 1,
		description: descriptions[1],
		options: keyOption(descriptions[2]),
		contexts: [0],
		integration_types: [0],
	},
];

test('the Russian command list is unchanged', () => {
	expect(commandDefinitions(messages('ru'))).toEqual(
		listOf(
			['Создать задачу в Plane', 'Добавить в задачу'],
			['Карточка задачи Plane', 'Привязать тред к задаче Plane', 'Ключ задачи, например LAB-40'],
		),
	);
});

test('commands in English', () => {
	expect(commandDefinitions(messages('en'))).toEqual(
		listOf(
			['Create Plane work item', 'Add to work item'],
			[
				'Plane work item card',
				'Link this thread to a Plane work item',
				'Work item key, e.g. LAB-40',
			],
		),
	);
});

test('each guild gets the commands of its tenant locale', () => {
	const tenant = configOf().tenants[0]!;
	const names = (locale: 'en' | 'ru') =>
		(guildCommands({ ...tenant, locale }) as { name: string }[]).map((c) => c.name);
	expect(names('en')).toContain('Create Plane work item');
	expect(names('en')).not.toContain('Создать задачу в Plane');
	expect(names('ru')).toContain('Создать задачу в Plane');
	expect(names('ru')).not.toContain('Create Plane work item');
});

test("command names and descriptions fit Discord's limits", () => {
	for (const locale of LOCALES) {
		const defs = commandDefinitions(messages(locale)) as {
			name: string;
			description?: string;
			options?: { description: string }[];
		}[];
		expect(defs).toHaveLength(4);
		for (const d of defs) {
			expect(d.name.length).toBeGreaterThanOrEqual(1);
			expect(d.name.length).toBeLessThanOrEqual(32);
			if (d.description !== undefined) {
				expect(d.description.length).toBeGreaterThanOrEqual(1);
				expect(d.description.length).toBeLessThanOrEqual(100);
			}
			for (const o of d.options ?? []) {
				expect(o.description.length).toBeGreaterThanOrEqual(1);
				expect(o.description.length).toBeLessThanOrEqual(100);
			}
		}
	}
});

test('a message command name is recognised in every locale', () => {
	for (const locale of LOCALES) {
		expect(messageCommandKind(messages(locale).createCommand)).toBe('create');
		expect(messageCommandKind(messages(locale).appendCommand)).toBe('append');
	}
	for (const other of ['plane', '', null, 'Do something', undefined, 7]) {
		expect(messageCommandKind(other)).toBeNull();
	}
	const create = new Set(LOCALES.map((l) => messages(l).createCommand));
	const append = new Set(LOCALES.map((l) => messages(l).appendCommand));
	expect([...create].filter((n) => append.has(n))).toEqual([]);
});
