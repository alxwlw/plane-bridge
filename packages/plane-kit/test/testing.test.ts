import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CYRILLIC, findCyrillic, findCyrillicOutsideRu } from '../src/testing.ts';

let root: string;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'findcyr-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function put(rel: string, body: string): void {
	const path = join(root, rel);
	mkdirSync(join(path, '..'), { recursive: true });
	writeFileSync(path, body);
}

test('findCyrillic finds Cyrillic in code and comments', () => {
	put('src/a.ts', "const a = 1;\nconst x = 'привет';\n// комментарий\nconst b = 2;\n");
	expect(findCyrillic(root, ['src'])).toEqual([
		{ path: 'src/a.ts', line: 2, text: "const x = 'привет';" },
		{ path: 'src/a.ts', line: 3, text: '// комментарий' },
	]);
});
test('findCyrillic skips missing dirs and other extensions', () => {
	put('src/b.md', 'привет\n');
	put('src/c.ts', 'const ok = 1;\n');
	expect(findCyrillic(root, ['src', 'web'])).toEqual([]);
});
test('findCyrillic reads html files, nested dirs, and the ends of the range', () => {
	put('web/page.html', '<p>ok</p>\n<p>Ѐ</p>\n');
	put('src/deep/er/d.ts', '// ӿ\n');
	put('src/e.ts', '// ÿ Ԁ\n');
	expect(findCyrillic(root, ['src', 'web']).map((h) => `${h.path}:${h.line}`)).toEqual([
		'src/deep/er/d.ts:1',
		'web/page.html:2',
	]);
});
test('findCyrillic sorts by path, then by line, whatever the dir order', () => {
	put('src/b.ts', 'x\nпривет\nпока\n');
	put('src/a.ts', 'да\n');
	put('web/z.html', 'нет\n');
	const got = findCyrillic(root, ['web', 'src']).map((h) => `${h.path}:${h.line}`);
	expect(got).toEqual(['src/a.ts:1', 'src/b.ts:2', 'src/b.ts:3', 'web/z.html:1']);
});
test('findCyrillic orders by path even when the later path has the earlier line', () => {
	put('src/a.ts', 'x\nx\nда\n');
	put('src/m.ts', 'x\nда\n');
	put('src/z.ts', 'да\n');
	expect(findCyrillic(root, ['src']).map((h) => `${h.path}:${h.line}`)).toEqual([
		'src/a.ts:3',
		'src/m.ts:2',
		'src/z.ts:1',
	]);
});
test('CYRILLIC covers both ends of U+0400–U+04FF, capitals and small letters, and nothing outside', () => {
	for (const ch of ['\u0400', '\u04FF', 'А', 'я', 'Ё', 'ё', 'І', 'ї'])
		expect(CYRILLIC.test(ch)).toBe(true);
	for (const ch of ['\u03FF', '\u0500', 'a', 'Z', '0', ' ']) expect(CYRILLIC.test(ch)).toBe(false);
});

const EN = "export const en = { a: 'A' };\n";
test('findCyrillicOutsideRu: nothing outside the ru object: no hits', () => {
	put('src/i18n.ts', `${EN}export const ru = {\n\ta: 'А',\n};\n`);
	expect(findCyrillicOutsideRu(root)).toEqual([]);
});
test('findCyrillicOutsideRu: a Russian helper above the ru object is a hit', () => {
	const helper = 'const q = (s: string) => `код ${s}`;';
	put('src/i18n.ts', `${helper}\n${EN}export const ru = {\n\ta: 'А',\n};\n`);
	expect(findCyrillicOutsideRu(root)).toEqual([{ path: 'src/i18n.ts', line: 1, text: helper }]);
});
test('findCyrillicOutsideRu: Cyrillic in en or after the ru object is a hit', () => {
	put(
		'src/i18n.ts',
		"export const en = {\n\ta: 'А',\n};\nexport const ru = {\n\ta: 'Б',\n};\nconst z = 'В';\n",
	);
	expect(findCyrillicOutsideRu(root)).toEqual([
		{ path: 'src/i18n.ts', line: 2, text: "\ta: 'А'," },
		{ path: 'src/i18n.ts', line: 7, text: "const z = 'В';" },
	]);
});
test('findCyrillicOutsideRu: the ru object ends at the first line that is exactly };', () => {
	put(
		'src/i18n.ts',
		`${EN}export const ru = {\n\tn: {\n\t\ta: 'А',\n\t},\n\tb: 'Б',\n};\nconst z = 'В';\n`,
	);
	expect(findCyrillicOutsideRu(root).map((h) => h.line)).toEqual([8]);
});
test('findCyrillicOutsideRu: a catalog without export const ru throws', () => {
	put('src/i18n.ts', EN);
	expect(() => findCyrillicOutsideRu(root)).toThrow('src/i18n.ts: no `export const ru` object');
});
test('findCyrillicOutsideRu: a ru object without its closing }; throws', () => {
	put('src/i18n.ts', `${EN}export const ru = {\n\ta: 'А',\n`);
	expect(() => findCyrillicOutsideRu(root)).toThrow(
		'src/i18n.ts: the `export const ru` object has no closing `};` line',
	);
});
test('findCyrillicOutsideRu: a catalog path is relative to root', () => {
	put('web/texts.ts', "const z = 'В';\nexport const ru = {\n};\n");
	expect(findCyrillicOutsideRu(root, 'web/texts.ts')).toEqual([
		{ path: 'web/texts.ts', line: 1, text: "const z = 'В';" },
	]);
});
