import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
