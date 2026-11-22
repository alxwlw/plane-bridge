import { assess, floatingTags, releasedVersions, releaseTag } from '@alxwlw/release/assess';
import { formatVersion, parseVersion } from '@alxwlw/release/semver';
import { describe, expect, test } from 'bun:test';

const unreleasedNotes = '# Changelog\n\n## [Unreleased]\n\n- something\n';

describe('assess', () => {
	test('no version', () => {
		expect(
			assess({ app: 'plane-a', version: undefined, changelog: undefined, tags: [] }),
		).toMatchObject({
			version: '',
			problems: ['package.json has no version'],
		});
	});

	test.each(['0.1', 'v0.1.0', '0.1.0+b1'])('invalid version %s', (version) => {
		const a = assess({ app: 'plane-a', version, changelog: unreleasedNotes, tags: [] });
		expect(a.version).toBe(version);
		expect(a.problems).toEqual([
			`invalid version '${version}' (want X.Y.Z or X.Y.Z-<pre-release>)`,
		]);
	});

	test('a pre-release with a single identifier is a pre-release', () => {
		const a = assess({ app: 'plane-a', version: '0.1.0-rc', changelog: unreleasedNotes, tags: [] });
		expect(a).toMatchObject({ status: 'pending', prerelease: true, problems: [] });
	});

	test('0.0.0 is unreleased and needs no changelog', () => {
		expect(assess({ app: 'plane-a', version: '0.0.0', changelog: undefined, tags: [] })).toEqual({
			app: 'plane-a',
			version: '0.0.0',
			status: 'unreleased',
			prerelease: false,
			problems: [],
		});
	});

	test('a tagged version is released', () => {
		expect(
			assess({
				app: 'plane-a',
				version: '0.1.0-rc.1',
				changelog: undefined,
				tags: ['plane-a-v0.1.0-rc.1'],
			}),
		).toEqual({
			app: 'plane-a',
			version: '0.1.0-rc.1',
			status: 'released',
			prerelease: true,
			problems: [],
		});
	});

	test('a pre-release with notes is pending', () => {
		expect(
			assess({ app: 'plane-a', version: '0.1.0-rc.1', changelog: unreleasedNotes, tags: [] }),
		).toEqual({
			app: 'plane-a',
			version: '0.1.0-rc.1',
			status: 'pending',
			prerelease: true,
			problems: [],
		});
	});

	test('a stable version with notes is pending and not a pre-release', () => {
		const changelog = '## [Unreleased]\n\n## [0.1.0] - 2026-11-30\n\n- a\n';
		expect(assess({ app: 'plane-a', version: '0.1.0', changelog, tags: [] })).toEqual({
			app: 'plane-a',
			version: '0.1.0',
			status: 'pending',
			prerelease: false,
			problems: [],
		});
	});

	test('pending without a CHANGELOG.md', () => {
		expect(
			assess({ app: 'plane-a', version: '0.1.0-rc.1', changelog: undefined, tags: [] }).problems,
		).toEqual(['no CHANGELOG.md']);
	});

	test('a pre-release with an empty Unreleased', () => {
		expect(
			assess({ app: 'plane-a', version: '0.1.0-rc.1', changelog: '## [Unreleased]\n\n', tags: [] })
				.problems,
		).toEqual(['CHANGELOG.md has no notes under ## [Unreleased]']);
	});

	test('a stable version with notes only under Unreleased', () => {
		expect(
			assess({ app: 'plane-a', version: '0.1.0', changelog: unreleasedNotes, tags: [] }).problems,
		).toEqual(['CHANGELOG.md has no notes under ## [0.1.0] - YYYY-MM-DD']);
	});

	test('a version below a released one', () => {
		expect(
			assess({
				app: 'plane-a',
				version: '0.1.0',
				changelog: unreleasedNotes,
				tags: ['plane-a-v0.2.0'],
			}).problems,
		).toEqual(['version 0.1.0 is below the released 0.2.0']);
	});

	test('the highest of several released versions is named', () => {
		const tags = ['plane-a-v0.2.0', 'plane-a-v0.3.0-rc.1', 'plane-a-v0.1.5'];
		expect(
			assess({ app: 'plane-a', version: '0.1.0', changelog: unreleasedNotes, tags }).problems,
		).toEqual(['version 0.1.0 is below the released 0.3.0-rc.1']);
	});

	test("another app's tag does not count", () => {
		const a = assess({
			app: 'plane-a',
			version: '0.1.0-rc.2',
			changelog: unreleasedNotes,
			tags: ['plane-a-v0.1.0-rc.1', 'plane-b-v9.0.0'],
		});
		expect(a.problems).toEqual([]);
		expect(a.status).toBe('pending');
	});
});

describe('releaseTag', () => {
	test('is <app>-v<version>', () => {
		expect(releaseTag('plane-a', '0.1.0-rc.1')).toBe('plane-a-v0.1.0-rc.1');
	});
});

describe('releasedVersions', () => {
	test('keeps only the app own, parsable tags', () => {
		const found = releasedVersions('plane-a', [
			'plane-a-v0.1.0',
			'plane-a-x-v1.0.0',
			'plane-a-v1.0',
			'plane-b-v2.0.0',
		]);
		expect(found.map(formatVersion)).toEqual(['0.1.0']);
	});
});

describe('floatingTags', () => {
	test.each([
		['0.1.0', [], ['0.1', 'latest']],
		['0.1.0-rc.1', [], []],
		['0.1.1', ['0.1.0'], ['0.1', 'latest']],
		['0.1.1', ['0.2.0'], ['0.1']],
		['0.1.0', ['0.1.1'], []],
		['0.1.0', ['0.2.0-rc.1'], ['0.1', 'latest']],
		['1.0.0', ['0.9.0'], ['1.0', 'latest']],
		['0.1.0', ['0.1.0'], ['0.1', 'latest']],
		['0.1.0', ['1.1.0'], ['0.1']],
	])('%s against %j gives %j', (version, released, expected) => {
		expect(
			floatingTags(
				parseVersion(version)!,
				released.map((r) => parseVersion(r)!),
			),
		).toEqual(expected);
	});
});
