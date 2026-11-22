import { compareVersions, formatVersion, parseVersion } from '@alxwlw/release/semver';
import { describe, expect, test } from 'bun:test';

describe('parseVersion', () => {
	test.each(['0.0.0', '0.1.0-rc.1', '10.20.30', '1.0.0-alpha-a.b-c'])(
		'accepts %s and formats it back',
		(text) => {
			const v = parseVersion(text);
			expect(v).toBeDefined();
			expect(formatVersion(v!)).toBe(text);
		},
	);

	test('reads the parts', () => {
		expect(parseVersion('10.20.30-rc.1')).toEqual({
			major: 10,
			minor: 20,
			patch: 30,
			prerelease: ['rc', '1'],
		});
	});

	test.each([
		'1.0',
		'01.0.0',
		'1.0.0+build',
		'v1.0.0',
		'1.0.0-',
		'1.0.0-rc..1',
		'1.0.0-01',
		' 1.0.0',
		'1.0.0 ',
	])('rejects %j', (text) => {
		expect(parseVersion(text)).toBeUndefined();
	});
});

describe('compareVersions', () => {
	const ascending = [
		'1.0.0-alpha',
		'1.0.0-alpha.1',
		'1.0.0-alpha.beta',
		'1.0.0-beta',
		'1.0.0-beta.2',
		'1.0.0-beta.11',
		'1.0.0-rc.1',
		'1.0.0',
		'1.0.1',
		'1.1.0',
		'2.0.0',
	];
	const parse = (t: string) => parseVersion(t)!;

	test('orders the SemVer 2.0.0 section 11 example strictly ascending', () => {
		for (let i = 0; i < ascending.length; i++) {
			for (let j = 0; j < ascending.length; j++) {
				const c = compareVersions(parse(ascending[i]!), parse(ascending[j]!));
				expect(Math.sign(c)).toBe(Math.sign(i - j));
			}
		}
	});

	test('compares numeric identifiers numerically', () => {
		expect(compareVersions(parse('0.1.0-rc.2'), parse('0.1.0-rc.10'))).toBeLessThan(0);
	});

	test('a version equals itself', () => {
		expect(compareVersions(parse('1.2.3'), parse('1.2.3'))).toBe(0);
		expect(compareVersions(parse('1.2.3-rc.1'), parse('1.2.3-rc.1'))).toBe(0);
	});
});
