import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';
import { CYRILLIC, expectEnglishOnly } from '@alxwlw/plane-kit/testing';
import { describe, expect, test } from 'bun:test';

import { DEFAULT_AREA_PREFIX, type Config, type TenantConfig } from '../src/config.ts';
import type { GraphJson } from '../src/contract.ts';
import { createHandler } from '../src/server.ts';
import { Store } from '../src/store.ts';
import { copyOf, type CopySpec } from './copy-builder.ts';

const NOW = 1_800_000_000_000;
const READ = 'read-key-1111';

/** A tenant without `locale` and `areaPrefix` (the loader fills the two defaults). */
const tenant: TenantConfig = {
	id: 'acme',
	workspaceSlug: 'acme-ws',
	workspaceId: '00000000-0000-4000-8000-000000000001',
	clientId: 'client',
	installationId: 'inst',
	planeSecret: 'plane-secret',
	webhookSecret: 'hook-secret',
	readKey: READ,
	agentKey: 'agent-key-2222',
	locale: DEFAULT_LOCALE,
	areaPrefix: DEFAULT_AREA_PREFIX,
};

function setup(spec: CopySpec) {
	const config: Config = {
		planeUrl: 'https://plane.example.com',
		publicUrl: 'https://plane-graph.example.com',
		dbPath: ':memory:',
		port: 8080,
		tenants: new Map([[tenant.id, tenant]]),
	};
	const store = new Store(':memory:');
	const { syncedAt, ...data } = copyOf(spec);
	store.replaceCopy('acme', data, syncedAt as string);
	const handler = createHandler({
		config,
		store,
		log: () => {},
		now: () => NOW,
		enqueue: () => {},
		assets: new Map([['graph', 'console.log("graph")']]),
		acceptRun: async () => true,
	});
	const get = (path: string) => handler(new Request(`http://localhost${path}`));
	return { get };
}

describe('a tenant without locale sends no Cyrillic', () => {
	test('graph: the page is English', async () => {
		const { get } = setup({ tasks: [{ key: 'ABC-1' }] });
		const res = await get(`/t/acme/graph?k=${READ}`);
		const html = await res.text();
		expect(res.status).toBe(200);
		expect(html).toContain('<html lang="en">');
		expectEnglishOnly([html], '<title>Work item graph</title>');
	});

	test('graph: only area: labels are areas, in items and in the wave groups', async () => {
		const { get } = setup({
			tasks: [
				{ key: 'ABC-9' },
				{ key: 'ABC-1', labels: ['area:payments'] },
				{ key: 'ABC-2', labels: ['код:payments'] },
				{ key: 'ABC-3', labels: ['area:payments', 'код:payments'] },
			],
			edges: [
				['ABC-9', 'blocks', 'ABC-1'],
				['ABC-9', 'blocks', 'ABC-2'],
				['ABC-9', 'blocks', 'ABC-3'],
			],
		});
		const res = await get(`/t/acme/graph.json?k=${READ}`);
		const graph = (await res.json()) as GraphJson;
		expect(graph.locale).toBe('en');
		const areas = Object.fromEntries(graph.items.map((i) => [i.key, i.areas]));
		expect(areas).toEqual({
			'ABC-9': [],
			'ABC-1': ['area:payments'],
			'ABC-2': [],
			'ABC-3': ['area:payments'],
		});
		// The wave group of ABC-1 and ABC-3 is the one area; ABC-2 shares no group with them.
		expect(graph.conflicts).toEqual([
			{ wave: 1, area: 'area:payments', items: ['item:ABC-1', 'item:ABC-3'] },
		]);
		expect(graph.canStart).toEqual([{ area: null, items: ['item:ABC-9'] }]);
	});

	// Exempt from the DEFAULT_LOCALE mutation: both replies are fixed English outside the catalog
	// (src/server.ts:70 `{ error: 'unauthorized' }`, src/server.ts:244 `'not found'`).
	test('graph: an unknown tenant and a wrong key get replies without Cyrillic', async () => {
		const { get } = setup({ tasks: [{ key: 'ABC-1' }] });
		const unknown = await get('/t/nobody/graph.json?k=x');
		const wrong = await get('/t/acme/graph.json?k=wrong');
		expect([unknown.status, wrong.status]).toEqual([404, 401]);
		const bodies = [await unknown.text(), await wrong.text()];
		expectEnglishOnly(bodies, 'not found');
		expect(bodies.some((b) => b.includes('unauthorized'))).toBe(true);
	});
});
