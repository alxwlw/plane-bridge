import { notesFor } from '@alxwlw/release/changelog';
import { parseVersion } from '@alxwlw/release/semver';
import { describe, expect, test } from 'bun:test';

const fixture = `# Changelog

All notable changes are listed here.

## [Unreleased]

### Added

- the first thing
- the second thing

## [0.1.10] - 2026-12-01

- ten

## [0.1.0] - 2026-11-30

### Fixed

- zero

[Unreleased]: https://example.invalid/compare/v0.1.10...HEAD
[0.1.0]: https://example.invalid/releases/tag/v0.1.0
`;

const v = (t: string) => parseVersion(t)!;

describe('notesFor', () => {
	test('a pre-release takes exactly the Unreleased body', () => {
		expect(notesFor(fixture, v('0.2.0-rc.1'))).toBe(
			'### Added\n\n- the first thing\n- the second thing',
		);
	});

	test('a stable version takes its body without the link references', () => {
		expect(notesFor(fixture, v('0.1.0'))).toBe('### Fixed\n\n- zero');
	});

	test('0.1.1 does not match the 0.1.10 heading', () => {
		expect(notesFor(fixture, v('0.1.1'))).toBeUndefined();
		expect(notesFor(fixture, v('0.1.10'))).toBe('- ten');
	});

	test('a stable heading without a date or with another date format is no heading', () => {
		expect(notesFor('## [0.1.0]\n\n- a\n', v('0.1.0'))).toBeUndefined();
		expect(notesFor('## [0.1.0] - 30.11.2026\n\n- a\n', v('0.1.0'))).toBeUndefined();
		expect(notesFor('## [0.1.0]2026-11-30\n\n- a\n', v('0.1.0'))).toBeUndefined();
	});

	test('the dots of a version match only dots', () => {
		expect(notesFor('## [0x1x0] - 2026-11-30\n\n- a\n', v('0.1.0'))).toBeUndefined();
	});

	test('trailing spaces on the heading are allowed', () => {
		expect(notesFor('## [0.1.0] - 2026-11-30  \n- a\n', v('0.1.0'))).toBe('- a');
		expect(notesFor('## [Unreleased]  \n- a\n', v('0.1.0-rc.1'))).toBe('- a');
	});

	test('an Unreleased section of blank lines is no notes', () => {
		expect(
			notesFor('## [Unreleased]\n\n\n## [0.1.0] - 2026-11-30\n\n- a\n', v('0.1.0-rc.1')),
		).toBeUndefined();
	});

	test('no Unreleased heading is no notes', () => {
		expect(notesFor('## [0.1.0] - 2026-11-30\n\n- a\n', v('0.1.0-rc.1'))).toBeUndefined();
	});

	test('a first-level heading ends the section', () => {
		expect(notesFor('## [Unreleased]\n- a\n# Other\n- b\n', v('0.1.0-rc.1'))).toBe('- a');
	});

	test('CRLF line ends give the same body', () => {
		const crlf = fixture.replace(/\n/g, '\r\n');
		expect(notesFor(crlf, v('0.2.0-rc.1'))).toBe(notesFor(fixture, v('0.2.0-rc.1')!));
		expect(notesFor(crlf, v('0.1.0'))).toBe('### Fixed\n\n- zero');
	});
});
