import { notesFor } from './changelog.ts';
import { compareVersions, formatVersion, parseVersion, type Version } from './semver.ts';

export type AppInput = {
	app: string;
	version: string | undefined;
	changelog: string | undefined;
	tags: string[];
};

export type Assessment = {
	app: string;
	version: string;
	status: 'unreleased' | 'released' | 'pending';
	prerelease: boolean;
	problems: string[];
};

export const releaseTag = (app: string, version: string): string => `${app}-v${version}`;

export function releasedVersions(app: string, tags: string[]): Version[] {
	const prefix = `${app}-v`;
	const found: Version[] = [];
	for (const tag of tags) {
		if (!tag.startsWith(prefix)) continue;
		const v = parseVersion(tag.slice(prefix.length));
		if (v) found.push(v);
	}
	return found;
}

export function assess(input: AppInput): Assessment {
	const { app, version, changelog, tags } = input;
	const fail = (v: string, problem: string): Assessment => ({
		app,
		version: v,
		status: 'pending',
		prerelease: false,
		problems: [problem],
	});
	if (version === undefined) return fail('', 'package.json has no version');
	const parsed = parseVersion(version);
	if (!parsed)
		return fail(version, `invalid version '${version}' (want X.Y.Z or X.Y.Z-<pre-release>)`);
	const prerelease = parsed.prerelease.length > 0;
	const done = (status: Assessment['status'], problems: string[] = []): Assessment => ({
		app,
		version,
		status,
		prerelease,
		problems,
	});
	if (version === '0.0.0') return done('unreleased');
	if (tags.includes(releaseTag(app, version))) return done('released');
	const released = releasedVersions(app, tags);
	const max = released.reduce<Version | undefined>(
		(top, v) => (top === undefined || compareVersions(v, top) > 0 ? v : top),
		undefined,
	);
	if (max !== undefined && compareVersions(max, parsed) > 0) {
		return done('pending', [`version ${version} is below the released ${formatVersion(max)}`]);
	}
	if (changelog === undefined) return done('pending', ['no CHANGELOG.md']);
	if (notesFor(changelog, parsed) === undefined) {
		const heading = prerelease ? '## [Unreleased]' : `## [${version}] - YYYY-MM-DD`;
		return done('pending', [`CHANGELOG.md has no notes under ${heading}`]);
	}
	return done('pending');
}

export function floatingTags(version: Version, released: Version[]): string[] {
	if (version.prerelease.length > 0) return [];
	const stable = released.filter((v) => v.prerelease.length === 0);
	const sameLine = stable.some(
		(v) =>
			v.major === version.major && v.minor === version.minor && compareVersions(v, version) > 0,
	);
	const newer = stable.some((v) => compareVersions(v, version) > 0);
	const tags: string[] = [];
	if (!sameLine) tags.push(`${version.major}.${version.minor}`);
	if (!newer) tags.push('latest');
	return tags;
}
