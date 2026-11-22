export type Version = { major: number; minor: number; patch: number; prerelease: string[] };

const PATTERN =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;

export function parseVersion(text: string): Version | undefined {
	const m = PATTERN.exec(text);
	if (!m) return undefined;
	return {
		major: Number(m[1]),
		minor: Number(m[2]),
		patch: Number(m[3]),
		prerelease: m[4] === undefined ? [] : m[4].split('.'),
	};
}

export function formatVersion(v: Version): string {
	const core = `${v.major}.${v.minor}.${v.patch}`;
	return v.prerelease.length === 0 ? core : `${core}-${v.prerelease.join('.')}`;
}

const isNumeric = (id: string): boolean => /^\d+$/.test(id);

function compareIdentifiers(a: string, b: string): number {
	const an = isNumeric(a);
	const bn = isNumeric(b);
	if (an && bn) {
		const x = BigInt(a);
		const y = BigInt(b);
		return x < y ? -1 : x > y ? 1 : 0;
	}
	if (an) return -1;
	if (bn) return 1;
	return a < b ? -1 : a > b ? 1 : 0;
}

// SemVer 2.0.0 section 11.
export function compareVersions(a: Version, b: Version): number {
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	if (a.patch !== b.patch) return a.patch - b.patch;
	if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
	if (a.prerelease.length === 0) return 1;
	if (b.prerelease.length === 0) return -1;
	const n = Math.min(a.prerelease.length, b.prerelease.length);
	for (let i = 0; i < n; i++) {
		const c = compareIdentifiers(a.prerelease[i]!, b.prerelease[i]!);
		if (c !== 0) return c;
	}
	return a.prerelease.length - b.prerelease.length;
}
