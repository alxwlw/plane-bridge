import { formatVersion, type Version } from './semver.ts';

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The body of the section a version's notes live in: `## [Unreleased]` for a
// pre-release, `## [X.Y.Z] - YYYY-MM-DD` for a stable version.
export function notesFor(changelog: string, version: Version): string | undefined {
	const lines = changelog.split(/\r?\n/);
	const heading =
		version.prerelease.length > 0
			? /^## \[Unreleased\] *$/
			: new RegExp(`^## \\[${escape(formatVersion(version))}\\] - \\d{4}-\\d{2}-\\d{2} *$`);
	const start = lines.findIndex((l) => heading.test(l));
	if (start === -1) return undefined;
	const body: string[] = [];
	for (const line of lines.slice(start + 1)) {
		if (/^#{1,2} /.test(line) || /^\[[^\]]+\]:\s/.test(line)) break;
		body.push(line);
	}
	while (body.length > 0 && body[0]!.trim() === '') body.shift();
	while (body.length > 0 && body[body.length - 1]!.trim() === '') body.pop();
	return body.length === 0 ? undefined : body.join('\n');
}
