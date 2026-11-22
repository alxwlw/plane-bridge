import { esc } from '@alxwlw/plane-kit/html';
import { LOCALES } from '@alxwlw/plane-kit/locale';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

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

test('the graph catalog has no Html entries', () => {
	expect(Object.keys(en).filter((k) => k.endsWith('Html'))).toEqual([]);
});

test('plain entries are HTML-safe', () => {
	for (const locale of LOCALES)
		for (const [key, v] of Object.entries(messages(locale)))
			if (typeof v === 'string') expect(esc(v), `${locale}.${key}`).toBe(v);
});

test('English copy', () => {
	const plain = Object.fromEntries(Object.entries(en).filter(([, v]) => typeof v === 'string'));
	expect(plain).toEqual({
		title: 'Work item graph',
		allProjects: 'All projects',
		allAreas: 'All areas',
		showClosed: 'Show closed',
		fit: 'Fit',
		cycle: 'Cycle in “blocks”, the order is undefined:',
		canStart: 'Can start now',
		noArea: 'no area',
		notParallel: 'not in parallel',
		offline: 'No connection to plane-graph',
		d3Failed: 'The graph library did not load (cdnjs)',
		noMatches: 'No work items match the selected filters',
		canStartColumn: 'CAN START NOW',
		hintMouse: 'Ctrl/⌘+click or middle mouse button — open in a new tab',
		hintTouch: 'long press — open in a new tab',
		agentNotRun: 'the agent has not run yet',
	});
});

test('count sentences in English', () => {
	expect(en.hiddenOpen(1)).toBe('1 more open work item without relations');
	expect(en.hiddenOpen(3)).toBe('3 more open work items without relations');
	expect(en.agentRun('12:30', 1, 0)).toBe('agent: 12:30, +1 relation, +0 labels');
	expect(en.agentRun('12:30', 2, 1)).toBe('agent: 12:30, +2 relations, +1 label');
});

test('Russian templates are unchanged', () => {
	expect(ru.hiddenOpen(1)).toBe('ещё 1 открытых задач без связей');
	expect(ru.agentRun('12:30', 1, 0)).toBe('агент: 12:30, +1 связей, +0 меток');
	expect(ru.dataAsOf('12:30')).toBe('данные на 12:30');
});

test('tooltip and wave column in both languages', () => {
	expect(en.tooltip('LAB-1', 'x', true)).toBe('LAB-1 · x (closed)');
	expect(ru.tooltip('LAB-1', 'x', true)).toBe('LAB-1 · x (закрыта)');
	expect(en.tooltip('LAB-1', 'x', false)).toBe('LAB-1 · x');
	expect(ru.tooltip('LAB-1', 'x', false)).toBe('LAB-1 · x');
	expect(en.waveColumn(2)).toBe('WAVE 2');
	expect(ru.waveColumn(2)).toBe('ВОЛНА 2');
	expect(en.offlineSince('12:30:05')).toBe('No connection to plane-graph, data as of 12:30:05');
	expect(ru.offlineSince('12:30:05')).toBe('Нет связи с plane-graph, данные на 12:30:05');
	expect(en.dataAsOf('12:30')).toBe('data as of 12:30');
});

test('Russian title is today’s literal', () => {
	expect(ru.title).toBe('Граф задач');
});

test('Russian plain copy is the text of f209417', () => {
	const plain = Object.fromEntries(Object.entries(ru).filter(([, v]) => typeof v === 'string'));
	expect(plain).toEqual({
		title: 'Граф задач',
		allProjects: 'Все проекты',
		allAreas: 'Все области',
		showClosed: 'Показать закрытые',
		fit: 'Вписать',
		cycle: 'Цикл в «блокирует», порядок не определён:',
		canStart: 'Можно сейчас',
		noArea: 'без области',
		notParallel: 'не параллельно',
		offline: 'Нет связи с plane-graph',
		d3Failed: 'Не загрузилась библиотека графа (cdnjs)',
		noMatches: 'Нет задач под выбранные фильтры',
		canStartColumn: 'МОЖНО СЕЙЧАС',
		hintMouse: 'Ctrl/⌘+клик или колёсико мыши — открыть в новой вкладке',
		hintTouch: 'долгое нажатие — открыть в новой вкладке',
		agentNotRun: 'агент ещё не работал',
	});
});
