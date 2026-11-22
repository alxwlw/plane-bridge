import { assess, floatingTags, releasedVersions } from './assess.ts';
import { notesFor } from './changelog.ts';
import { readApps } from './repo.ts';
import { parseVersion } from './semver.ts';

type Result = { code: number; stdout: string; stderr: string };

const USAGE = 'usage: release check | plan | notes <app> <version> | floating <app> <version>\n';

const fail = (message: string): Result => ({
	code: 1,
	stdout: '',
	stderr: `release: ${message}\n`,
});

export function run(args: string[], root: string): Result {
	const [command, app, version] = args;

	if ((command === 'check' || command === 'plan') && args.length === 1) {
		const assessed = readApps(root).map(assess);
		const problems = assessed.flatMap((a) => a.problems.map((p) => `release: ${a.app}: ${p}\n`));
		if (problems.length > 0) return { code: 1, stdout: '', stderr: problems.join('') };
		if (command === 'check') {
			return {
				code: 0,
				stdout: assessed.map((a) => `${a.app} ${a.version} ${a.status}\n`).join(''),
				stderr: '',
			};
		}
		const include = assessed
			.filter((a) => a.status === 'pending')
			.map((a) => ({ app: a.app, version: a.version, prerelease: a.prerelease }));
		return {
			code: 0,
			stdout: `matrix=${JSON.stringify({ include })}\ncount=${include.length}\n`,
			stderr: '',
		};
	}

	if ((command === 'notes' || command === 'floating') && args.length === 3 && app && version) {
		const input = readApps(root).find((a) => a.app === app);
		if (!input) return fail(`unknown app '${app}'`);
		const parsed = parseVersion(version);
		if (!parsed) return fail(`invalid version '${version}'`);
		if (command === 'notes') {
			const notes = input.changelog === undefined ? undefined : notesFor(input.changelog, parsed);
			if (notes === undefined) return fail(`${app}: no notes for ${version}`);
			return { code: 0, stdout: `${notes}\n`, stderr: '' };
		}
		const tags = floatingTags(parsed, releasedVersions(app, input.tags));
		return { code: 0, stdout: tags.map((t) => `${t}\n`).join(''), stderr: '' };
	}

	return { code: 2, stdout: '', stderr: USAGE };
}

if (import.meta.main) {
	const result = run(process.argv.slice(2), process.cwd());
	process.stdout.write(result.stdout);
	process.stderr.write(result.stderr);
	process.exit(result.code);
}
