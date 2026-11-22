import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { DEFAULT_AREA_PREFIX, loadConfig } from '../src/config.ts';

const EXAMPLE = readFileSync(new URL('../tenants.example.json', import.meta.url), 'utf8');
const ENV: Record<string, string | undefined> = {
	PLANE_GRAPH_PLANE_URL: 'https://plane.example.com',
	PLANE_GRAPH_PUBLIC_URL: 'https://g.example.com',
	PLANE_GRAPH_ACME_PLANE_SECRET: 'p',
	PLANE_GRAPH_ACME_WEBHOOK_SECRET: 'w',
	PLANE_GRAPH_ACME_READ_KEY: 'r',
	PLANE_GRAPH_ACME_AGENT_KEY: 'a',
};
const tenantWith = (extra: Record<string, unknown>) => {
	const root = JSON.parse(EXAMPLE) as { tenants: Record<string, unknown>[] };
	root.tenants[0] = { ...root.tenants[0], id: 'acme', ...extra };
	return JSON.stringify(root);
};
const load = (extra: Record<string, unknown>) =>
	loadConfig(ENV, () => tenantWith(extra)).tenants.get('acme');

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

describe('tenant areaPrefix', () => {
	test('a tenant without areaPrefix gets the default, which is area:', () => {
		expect(DEFAULT_AREA_PREFIX).toBe('area:');
		expect(load({})?.areaPrefix).toBe('area:');
	});

	test.each(['area:', 'Area.', ' x '])('prefix %p is kept as written', (prefix) => {
		expect(load({ areaPrefix: prefix })?.areaPrefix).toBe(prefix);
	});

	test.each([[''], ['   '], [null], [1], [['area:']]])('areaPrefix %p fails startup', (bad) => {
		expect(() => load({ areaPrefix: bad })).toThrow(
			'tenants[0].areaPrefix must be a non-empty string',
		);
	});
});
