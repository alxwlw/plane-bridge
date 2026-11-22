import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';
import { describeTenants, loadConfig } from '../src/config.ts';

const EXAMPLE = readFileSync(new URL('../tenants.example.json', import.meta.url), 'utf8');

const BASE_ENV: Record<string, string> = {
	PLANE_DISCORD_PLANE_URL: 'https://plane.example.com/',
	PLANE_DISCORD_PUBLIC_URL: 'https://plane-discord.example.com',
	PLANE_DISCORD_DISCORD_APPLICATION_ID: '555555555555555555',
	PLANE_DISCORD_DISCORD_PUBLIC_KEY: 'ab'.repeat(32),
	PLANE_DISCORD_DISCORD_BOT_TOKEN: 'bot-token-value',
	PLANE_DISCORD_ACME_PLANE_SECRET: 'client-secret-value',
	PLANE_DISCORD_ACME_WEBHOOK_SECRET: 'webhook-secret-value',
};

const example = () => JSON.parse(EXAMPLE) as { tenants: Array<Record<string, unknown>> };
const load = (file: unknown) => loadConfig(BASE_ENV, () => JSON.stringify(file));

const withLocale = (extra: Record<string, unknown>) => {
	const file = example();
	file.tenants[0] = { ...file.tenants[0], ...extra };
	return load(file);
};

describe('tenant locale', () => {
	test('a tenant without locale gets the default locale', () => {
		expect(withLocale({}).tenants[0]?.locale).toBe('en');
		expect(DEFAULT_LOCALE).toBe('en');
	});
	test('a tenant takes locale en or ru', () => {
		expect(withLocale({ locale: 'en' }).tenants[0]?.locale).toBe('en');
		expect(withLocale({ locale: 'ru' }).tenants[0]?.locale).toBe('ru');
	});
	test.each(['RU', 'en-US', '', null, 1])('locale %p fails startup', (locale) => {
		expect(() => withLocale({ locale })).toThrow('tenants[0].locale must be one of en, ru');
	});
	test('the startup summary names each tenant locale', () => {
		expect(describeTenants(withLocale({ locale: 'en' }))[0]?.locale).toBe('en');
	});
});
