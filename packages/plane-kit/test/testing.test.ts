import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findCyrillic } from '../src/testing.ts';

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
