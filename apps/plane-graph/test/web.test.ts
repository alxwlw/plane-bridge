import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { buildWeb, createWeb } from '../src/web.ts';

const WEB_DIR = new URL('../web', import.meta.url).pathname;

const dir = mkdtempSync(join(tmpdir(), 'plane-graph-web-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('web', () => {
	test('buildWeb собирает только graph из web/graph.ts', async () => {
		writeFileSync(join(dir, 'graph.ts'), 'console.log("marker-" + (1 + 1));\n');
		writeFileSync(join(dir, 'app.ts'), 'console.log("not-built");\n');
		const assets = await buildWeb(dir);
		expect([...assets.keys()]).toEqual(['graph']);
		expect(assets.get('graph')).toContain('marker-');
	});

	test('the client bundle carries the catalog', async () => {
		const bundle = (await buildWeb(WEB_DIR)).get('graph') ?? '';
		for (const text of ['Work item graph', 'Граф задач']) expect(bundle).toContain(text);
		// The whole string literal, so a longer sentence with the same start does not stand in for it.
		for (const text of ['No connection to plane-graph', 'Нет связи с plane-graph'])
			expect(bundle).toMatch(new RegExp(`["'\`]${text}["'\`]`));
	});

	test('buildWeb падает на ошибке сборки', async () => {
		const bad = mkdtempSync(join(tmpdir(), 'plane-graph-web-bad-'));
		try {
			writeFileSync(join(bad, 'graph.ts'), 'const = ;\n');
			await expect(buildWeb(bad)).rejects.toThrow();
		} finally {
			rmSync(bad, { recursive: true, force: true });
		}
	});

	test('createWeb отдаёт только /assets/<имя>.js собранного', async () => {
		const serve = createWeb(new Map([['graph', 'code()']]));
		const res = serve(new URL('http://x/assets/graph.js?v=1'));
		expect(await res?.text()).toBe('code()');
		expect(serve(new URL('http://x/assets/app.js'))).toBeNull();
		expect(serve(new URL('http://x/graph.js'))).toBeNull();
		expect(serve(new URL('http://x/assets/graph.js/x'))).toBeNull();
	});
});
