import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { esc } from '@alxwlw/plane-kit/html';
import { LOCALES } from '@alxwlw/plane-kit/locale';

import { en, messages, ru } from '../src/i18n.ts';

test('both catalogs have the same keys', () => {
	expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
});

test('messages returns the catalog of the locale', () => {
	expect(messages('en')).toBe(en);
	expect(messages('ru')).toBe(ru);
});

test('the catalog imports only browser-safe modules', () => {
	const source = readFileSync(new URL('../src/i18n.ts', import.meta.url), 'utf8');
	const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1] ?? '');
	expect(specifiers.length).toBeGreaterThan(0);
	for (const s of specifiers)
		expect(['@alxwlw/plane-kit/locale', '@alxwlw/plane-kit/html']).toContain(s);
});

const HOSTILE = 'a<b&"c';
const HOSTILE_ESCAPED = 'a&lt;b&amp;&quot;c';
const HTML_ENTRIES: Record<string, (m: typeof en) => string> = {
	fromBoardByHtml: (m) => m.fromBoardByHtml(HOSTILE),
	fromBoardHtml: (m) => m.fromBoardHtml(HOSTILE),
	miroTagsHtml: (m) => m.miroTagsHtml(HOSTILE),
};

test('every Html entry escapes its text parameters', () => {
	expect(Object.keys(HTML_ENTRIES).sort()).toEqual(
		Object.keys(en)
			.filter((k) => k.endsWith('Html'))
			.sort(),
	);
	for (const locale of LOCALES) {
		for (const [key, call] of Object.entries(HTML_ENTRIES)) {
			const out = call(messages(locale));
			expect(out, `${locale}.${key}`).toContain(HOSTILE_ESCAPED);
			expect(out, `${locale}.${key}`).not.toContain(HOSTILE);
		}
	}
});

test('plain entries are HTML-safe', () => {
	for (const locale of LOCALES)
		for (const [key, v] of Object.entries(messages(locale)))
			if (typeof v === 'string') expect(esc(v), `${locale}.${key}`).toBe(v);
});

test('English copy', () => {
	const plain = Object.fromEntries(Object.entries(en).filter(([, v]) => typeof v === 'string'));
	expect(plain).toEqual({
		defaultAuthor: 'Miro user',
		unknownTenant: 'Unknown tenant',
		missingCode: 'Missing code parameter',
		miroTokenFailed: 'Could not get a Miro token',
		wrongMiroTeam: 'This is not the expected Miro team',
		errorUnauthorized: 'The Miro session has expired — reload the board.',
		errorUnknownTeam: 'This Miro team is not connected to Plane.',
		errorBoardNoAccess:
			'The service account cannot write to this board. Share the board with the team and try again; on the Free plan only the team’s three most recent boards can be edited.',
		errorMiroNotConnected: 'The service is not connected to Miro yet. Contact your administrator.',
		errorUnknownProject: 'Project not found or hidden.',
		errorUnknownCard: 'This card is not linked to a work item.',
		errorPlaneFailed: 'Plane did not answer — try again.',
		errorMiroFailed: 'Miro did not answer — try again.',
		errorNotFound: 'item not found',
		errorUnsupportedType: 'this item type cannot be converted',
		errorEmptyText: 'empty sticky note',
		errorAlreadyLinked: 'the sticky note is already linked to another work item',
		errorFallback: 'Something went wrong.',
		nothingFound: 'Nothing found.',
		projectLabel: 'Project',
		toPlane: 'To Plane',
		bindHeading: 'Link to a work item',
		searchPlaceholder: 'Key or words from the title',
		bind: 'Link',
		cardTitle: 'Plane work item',
		loading: 'Loading…',
		openInPlane: 'Open in Plane',
		stateField: 'State',
		assigneesField: 'Assignees',
	});
	expect(en.fromBoardByHtml('Ann')).toBe('From the Miro board (Ann):');
	expect(en.fromBoardHtml('Ann')).toBe('From the Miro board: Ann');
	expect(en.miroTagsHtml('a, b')).toBe('Miro tags: a, b');
	expect(en.done('LAB-1, LAB-2')).toBe('Done: LAB-1, LAB-2.');
	expect(en.failed(2, 'empty sticky note')).toBe('Failed: 2 — empty sticky note.');
	expect(en.selected(3)).toBe('Selected for Plane: 3');
	expect(en.converting(4, 10)).toBe('Converting: 4 of 10…');
});

test("Russian copy is today's text", () => {
	expect(ru.defaultAuthor).toBe('участник Miro');
	expect(ru.fromBoardByHtml('Аня')).toBe('С доски Miro (Аня):');
	expect(ru.fromBoardHtml('Аня')).toBe('С доски Miro: Аня');
	expect(ru.miroTagsHtml('a, b')).toBe('Теги Miro: a, b');
});
