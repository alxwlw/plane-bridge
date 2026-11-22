import { run } from '@alxwlw/release/cli';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let root = '';

const git = (...args: string[]) => {
	const r = Bun.spawnSync([
		'git',
		'-C',
		root,
		'-c',
		'user.name=t',
		'-c',
		'user.email=t@example.invalid',
		'-c',
		'commit.gpgsign=false',
		...args,
	]);
	if (r.exitCode !== 0) throw new Error(r.stderr.toString());
};

// update-ref, not `git tag`: a user config that annotates or signs tags cannot break the fixture.
const tag = (name: string) => git('update-ref', `refs/tags/${name}`, 'HEAD');

const app = (name: string, version: string, changelog?: string) => {
	mkdirSync(join(root, 'apps', name), { recursive: true });
	writeFileSync(
		join(root, 'apps', name, 'package.json'),
		JSON.stringify({ name: `@x/${name}`, version }),
	);
	if (changelog !== undefined) writeFileSync(join(root, 'apps', name, 'CHANGELOG.md'), changelog);
};

const notes = '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- a thing\n';
const USAGE = 'usage: release check | plan | notes <app> <version> | floating <app> <version>\n';

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'release-cli-'));
	git('init', '-q');
	git('commit', '--allow-empty', '-qm', 'init');
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('check and plan', () => {
	test('apps at 0.0.0 are unreleased, listed sorted', () => {
		for (const name of ['plane-d', 'plane-b', 'plane-e', 'plane-a', 'plane-c']) app(name, '0.0.0');
		expect(run(['check'], root)).toEqual({
			code: 0,
			stdout: ['a', 'b', 'c', 'd', 'e'].map((x) => `plane-${x} 0.0.0 unreleased\n`).join(''),
			stderr: '',
		});
	});

	test('plan lists the pending app only', () => {
		app('plane-a', '0.1.0-rc.1', notes);
		app('plane-b', '0.0.0');
		expect(run(['plan'], root)).toEqual({
			code: 0,
			stdout:
				'matrix={"include":[{"app":"plane-a","version":"0.1.0-rc.1","prerelease":true}]}\ncount=1\n',
			stderr: '',
		});
		expect(run(['check'], root).stdout).toBe(
			'plane-a 0.1.0-rc.1 pending\nplane-b 0.0.0 unreleased\n',
		);
	});

	test('a tagged version is released and not planned', () => {
		app('plane-a', '0.1.0-rc.1', notes);
		app('plane-b', '0.0.0');
		tag('plane-a-v0.1.0-rc.1');
		expect(run(['check'], root).stdout).toBe(
			'plane-a 0.1.0-rc.1 released\nplane-b 0.0.0 unreleased\n',
		);
		expect(run(['plan'], root)).toEqual({
			code: 0,
			stdout: 'matrix={"include":[]}\ncount=0\n',
			stderr: '',
		});
	});

	test('empty notes fail check and plan with nothing on stdout', () => {
		app('plane-a', '0.1.0-rc.1', '## [Unreleased]\n\n');
		const expected = {
			code: 1,
			stdout: '',
			stderr: 'release: plane-a: CHANGELOG.md has no notes under ## [Unreleased]\n',
		};
		expect(run(['check'], root)).toEqual(expected);
		expect(run(['plan'], root)).toEqual(expected);
	});

	test('problems of several apps are listed one per line', () => {
		app('plane-a', '0.1', notes);
		app('plane-b', '0.1.0-rc.1');
		expect(run(['check'], root).stderr).toBe(
			"release: plane-a: invalid version '0.1' (want X.Y.Z or X.Y.Z-<pre-release>)\nrelease: plane-b: no CHANGELOG.md\n",
		);
	});
});

describe('notes', () => {
	test('prints the body and a newline', () => {
		app('plane-a', '0.1.0-rc.1', notes);
		expect(run(['notes', 'plane-a', '0.1.0-rc.1'], root)).toEqual({
			code: 0,
			stdout: '### Added\n\n- a thing\n',
			stderr: '',
		});
	});

	test('an unknown app', () => {
		app('plane-a', '0.1.0-rc.1', notes);
		expect(run(['notes', 'plane-z', '0.1.0'], root)).toEqual({
			code: 1,
			stdout: '',
			stderr: "release: unknown app 'plane-z'\n",
		});
	});

	test('an invalid version', () => {
		app('plane-a', '0.1.0-rc.1', notes);
		expect(run(['notes', 'plane-a', '0.1'], root)).toEqual({
			code: 1,
			stdout: '',
			stderr: "release: invalid version '0.1'\n",
		});
	});

	test('a version without notes', () => {
		app('plane-a', '0.1.0-rc.1', notes);
		expect(run(['notes', 'plane-a', '0.1.0'], root)).toEqual({
			code: 1,
			stdout: '',
			stderr: 'release: plane-a: no notes for 0.1.0\n',
		});
	});
});

describe('floating', () => {
	beforeEach(() => {
		app('plane-a', '0.0.0');
		tag('plane-a-v0.2.0');
	});

	test('a backport gets only X.Y', () => {
		expect(run(['floating', 'plane-a', '0.1.1'], root)).toEqual({
			code: 0,
			stdout: '0.1\n',
			stderr: '',
		});
	});

	test('a newer version gets X.Y and latest', () => {
		expect(run(['floating', 'plane-a', '0.3.0'], root)).toEqual({
			code: 0,
			stdout: '0.3\nlatest\n',
			stderr: '',
		});
	});

	test('an older version gets nothing', () => {
		expect(run(['floating', 'plane-a', '0.2.0'], root)).toEqual({
			code: 0,
			stdout: '0.2\nlatest\n',
			stderr: '',
		});
		expect(run(['floating', 'plane-a', '0.1.0-rc.1'], root)).toEqual({
			code: 0,
			stdout: '',
			stderr: '',
		});
		tag('plane-a-v0.1.1');
		expect(run(['floating', 'plane-a', '0.1.0'], root)).toEqual({
			code: 0,
			stdout: '',
			stderr: '',
		});
	});

	test('unknown app and invalid version', () => {
		expect(run(['floating', 'plane-z', '0.1.0'], root).stderr).toBe(
			"release: unknown app 'plane-z'\n",
		);
		expect(run(['floating', 'plane-a', 'v0.1.0'], root).stderr).toBe(
			"release: invalid version 'v0.1.0'\n",
		);
	});
});

describe('repository layout', () => {
	test('a root without apps has nothing to release', () => {
		expect(run(['check'], root)).toEqual({ code: 0, stdout: '', stderr: '' });
		expect(run(['plan'], root)).toEqual({
			code: 0,
			stdout: 'matrix={"include":[]}\ncount=0\n',
			stderr: '',
		});
	});

	test('only directories with a package.json are apps', () => {
		app('plane-a', '0.0.0');
		mkdirSync(join(root, 'apps', 'plane-empty'), { recursive: true });
		writeFileSync(join(root, 'apps', 'README.md'), 'not an app');
		expect(run(['check'], root).stdout).toBe('plane-a 0.0.0 unreleased\n');
	});

	test('a package.json without a string version is a problem', () => {
		mkdirSync(join(root, 'apps', 'plane-a'), { recursive: true });
		writeFileSync(
			join(root, 'apps', 'plane-a', 'package.json'),
			JSON.stringify({ name: 'x', version: 1 }),
		);
		mkdirSync(join(root, 'apps', 'plane-b'), { recursive: true });
		writeFileSync(join(root, 'apps', 'plane-b', 'package.json'), 'null');
		expect(run(['check'], root).stderr).toBe(
			'release: plane-a: package.json has no version\nrelease: plane-b: package.json has no version\n',
		);
	});

	test('a failing git is an error, not an empty tag list', () => {
		const bare = mkdtempSync(join(tmpdir(), 'release-nogit-'));
		try {
			mkdirSync(join(bare, 'apps', 'plane-a'), { recursive: true });
			writeFileSync(join(bare, 'apps', 'plane-a', 'package.json'), '{"version":"0.0.0"}');
			expect(() => run(['check'], bare)).toThrow();
		} finally {
			rmSync(bare, { recursive: true, force: true });
		}
	});
});

describe('entry point', () => {
	const cli = join(import.meta.dir, '..', 'src', 'cli.ts');
	const spawn = (...args: string[]) => Bun.spawnSync(['bun', cli, ...args], { cwd: root });

	test('writes stdout and exits 0', () => {
		app('plane-a', '0.0.0');
		const r = spawn('check');
		expect(r.exitCode).toBe(0);
		expect(r.stdout.toString()).toBe('plane-a 0.0.0 unreleased\n');
	});

	test('writes stderr and exits with the code', () => {
		const r = spawn('ship');
		expect(r.exitCode).toBe(2);
		expect(r.stdout.toString()).toBe('');
		expect(r.stderr.toString()).toBe(USAGE);
	});

	test('passes the arguments after the script', () => {
		app('plane-a', '0.1.0-rc.1', notes);
		expect(spawn('notes', 'plane-a', '0.1.0-rc.1').stdout.toString()).toBe(
			'### Added\n\n- a thing\n',
		);
	});
});

describe('usage', () => {
	test.each([
		[[]],
		[['ship']],
		[['notes', 'plane-a']],
		[['check', 'extra']],
		[['notes', 'plane-a', '0.1.0', 'x']],
	])('%j', (args) => {
		expect(run(args, root)).toEqual({ code: 2, stdout: '', stderr: USAGE });
	});
});
