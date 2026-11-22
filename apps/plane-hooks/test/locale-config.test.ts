import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';
import { loadServiceConfig } from '../src/config.ts';
import { TEST_KEY_PEM } from './config-fixture.ts';

const EXAMPLE = readFileSync(new URL('../tenants.example.json', import.meta.url), 'utf8');
const ENV: Record<string, string> = {
	PLANE_HOOKS_PLANE_URL: 'https://plane.example.com/',
	PLANE_HOOKS_PUBLIC_URL: 'https://hooks.example.com',
	PLANE_HOOKS_ACME_PLANE_SECRET: 'plane-secret',
	PLANE_HOOKS_ACME_GRAFANA_TOKEN: `ph_${'a'.repeat(48)}`,
	PLANE_HOOKS_ACME_VERCEL_SECRET: 'vercel-secret',
	PLANE_HOOKS_ACME_DOKPLOY_SECRET: 'dokploy-secret',
	PLANE_HOOKS_GH_ACME_PRIVATE_KEY: Buffer.from(TEST_KEY_PEM).toString('base64'),
	PLANE_HOOKS_GH_ACME_WEBHOOK_SECRET: 'gh-secret',
};

/** The example file with `extra` merged into its first tenant. */
function load(extra: Record<string, unknown>) {
	const file = JSON.parse(EXAMPLE);
	Object.assign(file.tenants[0], extra);
	return loadServiceConfig(ENV, () => JSON.stringify(file));
}

test('a tenant without locale gets the default locale', () => {
	expect(load({}).tenants[0]?.locale).toBe('en');
	expect(DEFAULT_LOCALE).toBe('en');
});
test('a tenant takes locale en or ru', () => {
	expect(load({ locale: 'en' }).tenants[0]?.locale).toBe('en');
	expect(load({ locale: 'ru' }).tenants[0]?.locale).toBe('ru');
});
test.each(['RU', 'en-US', '', null, 1])('locale %p fails startup', (locale) => {
	expect(() => load({ locale })).toThrow('tenants[0].locale must be one of en, ru');
});
