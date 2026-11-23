import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { CYRILLIC } from '@alxwlw/plane-kit/testing';

import { areaPrefixOf, demoHandler, demoOptions } from '../scripts/demo.ts';
import type { CopyData, GraphJson } from '../src/contract.ts';

const ROOT = join(import.meta.dir, '..');
const load = async (f: string) => (await Bun.file(join(ROOT, f)).json()) as CopyData;

test('English by default, Russian behind --locale ru', () => {
	expect(demoOptions([])).toEqual({ locale: 'en', fixture: 'test/fixtures/demo-copy.en.json' });
	expect(demoOptions(['--locale', 'ru'])).toEqual({
		locale: 'ru',
		fixture: 'test/fixtures/demo-copy.json',
	});
	expect(() => demoOptions(['--locale', 'de'])).toThrow();
	expect(() => demoOptions(['--lang', 'ru'])).toThrow();
	expect(() => demoOptions(['--locale', 'ru', 'extra'])).toThrow();
});

test('the area prefix comes from the fixture', async () => {
	const ru = await load('test/fixtures/demo-copy.json');
	expect(areaPrefixOf(await load('test/fixtures/demo-copy.en.json'))).toBe('area:');
	expect(areaPrefixOf(ru)).toBe('код:');
	expect(() => areaPrefixOf({ ...ru, labels: [] })).toThrow();
	expect(() =>
		areaPrefixOf({ ...ru, labels: [{ id: 'l', projectId: 'p', name: 'api' }] }),
	).toThrow();
});

test('the English fixture is the Russian one with English names', async () => {
	const ru = await load('test/fixtures/demo-copy.json');
	const en = await load('test/fixtures/demo-copy.en.json');
	const swap = (s: string) => s.replaceAll('код:', 'area:');
	const shape = (c: CopyData, f = (s: string) => s) => ({
		projects: c.projects.map(({ id, identifier }) => ({ id, identifier })),
		states: c.states,
		labels: c.labels.map((l) => ({ ...l, id: f(l.id), name: f(l.name) })),
		modules: c.modules,
		items: c.items.map(({ name: _, ...rest }) => ({ ...rest, labelIds: rest.labelIds.map(f) })),
		edges: c.edges,
	});
	expect(shape(en)).toEqual(shape(ru, swap));
	expect(JSON.stringify(en)).not.toMatch(CYRILLIC);
	for (const [a, b] of en.items.map((it, i) => [it.name, ru.items[i]!.name])) expect(a).not.toBe(b);
});

test.each([
	['en', 'Catalog', 'area:'],
	['ru', 'Каталог', 'код:'],
] as const)(
	'the %s demo tenant serves its locale, names and area prefix',
	async (locale, name, prefix) => {
		const handler = await demoHandler(locale);
		const page = await handler(new Request('http://x/t/demo/graph?k=demo'));
		expect(page.status).toBe(200);
		expect(await page.text()).toContain(`<html lang="${locale}">`);
		const res = await handler(new Request('http://x/t/demo/graph.json?k=demo'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as GraphJson;
		expect(body.locale).toBe(locale);
		expect(body.projects.map((p) => p.name)).toContain(name);
		// The agent run the demo seeds shows up as the last run; the areas are the labels under the fixture's prefix.
		expect(body.lastAgentRun).toMatchObject({ kind: 'batch', relationsAdded: 1, labelsAdded: 1 });
		const areas = body.items.flatMap((it) => it.areas);
		expect(areas.length).toBeGreaterThan(0);
		for (const a of areas) expect(a.startsWith(prefix)).toBe(true);
	},
);
