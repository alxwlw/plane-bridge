import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from 'bun:test';

/** Test-only helpers: no `src/` file of any app imports this module. */

export type CyrillicHit = { path: string; line: number; text: string };

/** Matches a character of U+0400–U+04FF: the one definition every Cyrillic check in tests shares. */
export const CYRILLIC = /[\u0400-\u04FF]/;

/**
 * Every line holding a character of U+0400–U+04FF in the `*.ts` and `*.html` files under `root/<dir>`
 * for each `dir` that exists, comments included. `path` is relative to `root`, `line` is 1-based;
 * the result is sorted by path, then line.
 */
export function findCyrillic(root: string, dirs: readonly string[]): CyrillicHit[] {
	const hits: CyrillicHit[] = [];
	const glob = new Bun.Glob('**/*.{ts,html}');
	for (const dir of dirs) {
		const base = join(root, dir);
		if (!existsSync(base)) continue;
		for (const file of glob.scanSync({ cwd: base })) {
			const path = join(dir, file);
			const lines = readFileSync(join(root, path), 'utf8').split('\n');
			lines.forEach((text, i) => {
				if (CYRILLIC.test(text)) hits.push({ path, line: i + 1, text });
			});
		}
	}
	return hits.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line));
}

/**
 * Every line of the catalog file `root/<catalog>` that holds Cyrillic and lies outside the `ru` object.
 * The `ru` object runs from the first line starting with `export const ru` to the first later line
 * that is exactly `};` (both included). With the guard's `no Cyrillic outside the catalog` it leaves
 * the `ru` object as the only Russian text an app holds. `line` is 1-based, the result is in line order.
 */
export function findCyrillicOutsideRu(root: string, catalog = 'src/i18n.ts'): CyrillicHit[] {
	const lines = readFileSync(join(root, catalog), 'utf8').split('\n');
	const start = lines.findIndex((l) => l.startsWith('export const ru'));
	if (start < 0) throw new Error(`${catalog}: no \`export const ru\` object`);
	const end = lines.findIndex((l, i) => i > start && l === '};');
	if (end < 0)
		throw new Error(`${catalog}: the \`export const ru\` object has no closing \`};\` line`);
	const hits: CyrillicHit[] = [];
	lines.forEach((text, i) => {
		if ((i < start || i > end) && CYRILLIC.test(text))
			hits.push({ path: catalog, line: i + 1, text });
	});
	return hits;
}

/** The checks every English-default scenario ends with: something was sent, none of it is Russian, a named English text is in it. */
export function expectEnglishOnly(bodies: string[], english: string): void {
	expect(bodies.length).toBeGreaterThan(0);
	expect(bodies.filter((b) => CYRILLIC.test(b))).toEqual([]);
	expect(bodies.some((b) => b.includes(english))).toBe(true);
}
