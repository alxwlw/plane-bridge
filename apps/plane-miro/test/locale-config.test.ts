import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';
import { describe, expect, test } from 'bun:test';

import { loadConfig } from '../src/config.ts';
import { env, read } from './config-fixture.ts';

const tenantJson = (extra: Record<string, unknown>) => ({
	tenants: [
		{
			id: 'acme',
			workspace: 'example-ws',
			workspaceId: '00000000-0000-4000-8000-000000000001',
			plane: { clientId: 'cid', appInstallationId: 'inst' },
			miro: { teamId: '3458764500000000001' },
			embed: true,
			...extra,
		},
	],
});
const load = (extra: Record<string, unknown>) =>
	loadConfig(env(), read(JSON.stringify(tenantJson(extra)))).tenants[0];

describe('tenant locale', () => {
	test('a tenant without locale gets the default, which is en', () => {
		expect(DEFAULT_LOCALE).toBe('en');
		expect(load({})?.locale).toBe('en');
	});

	test('en and ru are taken', () => {
		expect(load({ locale: 'en' })?.locale).toBe('en');
		expect(load({ locale: 'ru' })?.locale).toBe('ru');
	});

	test.each(['RU', 'en-US', '', null, 1])('locale %p fails startup', (bad) => {
		expect(() => load({ locale: bad })).toThrow('tenants[0].locale must be one of en, ru');
	});
});
