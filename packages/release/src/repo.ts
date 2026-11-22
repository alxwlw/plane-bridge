import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AppInput } from './assess.ts';

function gitTags(root: string, app: string): string[] {
	const r = Bun.spawnSync(['git', '-C', root, 'tag', '--list', `${app}-v*`]);
	if (r.exitCode !== 0) throw new Error(r.stderr.toString().trim());
	return r.stdout
		.toString()
		.split('\n')
		.filter((t) => t !== '');
}

export function readApps(root: string): AppInput[] {
	const appsDir = join(root, 'apps');
	if (!existsSync(appsDir)) return [];
	const names = readdirSync(appsDir, { withFileTypes: true })
		.filter((d) => d.isDirectory() && existsSync(join(appsDir, d.name, 'package.json')))
		.map((d) => d.name)
		.sort();
	return names.map((app) => {
		const pkg: unknown = JSON.parse(readFileSync(join(appsDir, app, 'package.json'), 'utf8'));
		const version =
			typeof pkg === 'object' && pkg !== null && 'version' in pkg && typeof pkg.version === 'string'
				? pkg.version
				: undefined;
		const changelogPath = join(appsDir, app, 'CHANGELOG.md');
		return {
			app,
			version,
			changelog: existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : undefined,
			tags: gitTags(root, app),
		};
	});
}
