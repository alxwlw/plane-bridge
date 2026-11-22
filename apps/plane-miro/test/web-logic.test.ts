import { describe, expect, test } from 'bun:test';
import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';

import { CONVERTIBLE as serverConvertible, MAX_ITEMS } from '../src/convert.ts';
import { messages } from '../src/i18n.ts';
import {
	apiResult,
	BATCH_SIZE,
	bindableId,
	CONVERTIBLE as webConvertible,
	chunk,
	convertInBatches,
	currentSelection,
	convertibleIds,
	errorText,
	localeFrom,
	mergeBatch,
	summary,
} from '../web/logic.ts';

const RU = messages('ru');
const EN = messages('en');

describe('convertibleIds', () => {
	test('стикер, карточка, фигура, текст — да; фрейм, коннектор, app_card — нет', () => {
		expect(
			convertibleIds([
				{ id: '1', type: 'sticky_note' },
				{ id: '2', type: 'frame' },
				{ id: '3', type: 'text' },
				{ id: '4', type: 'app_card' },
				{ id: '5', type: 'connector' },
				{ id: '6', type: 'card' },
				{ id: '7', type: 'shape' },
			]),
		).toEqual(['1', '3', '6', '7']);
	});

	test('CONVERTIBLE фронта и бэкенда совпадают', () => {
		expect(webConvertible).toEqual(serverConvertible);
	});
});

describe('bindableId', () => {
	test('ровно одна конвертируемая запись — её id; иначе null', () => {
		const sticky = { id: '1', type: 'sticky_note' };
		expect(bindableId([sticky])).toBe('1');
		expect(bindableId([])).toBeNull();
		expect(bindableId([sticky, { id: '2', type: 'text' }])).toBeNull();
		expect(bindableId([{ id: '2', type: 'frame' }])).toBeNull();
		expect(bindableId([sticky, { id: '2', type: 'frame' }])).toBe('1');
	});
});

describe('summary', () => {
	test('ключи и ошибки', () => {
		expect(
			summary(RU, [
				{ ok: true, key: 'LAB-1' },
				{ ok: true, key: 'LAB-2' },
				{ ok: false, error: 'empty_text' },
			]),
		).toBe('Готово: LAB-1, LAB-2. Не вышло: 1 — пустой стикер.');
	});

	test('только успех и только неудача', () => {
		expect(summary(RU, [{ ok: true, key: 'LAB-7' }])).toBe('Готово: LAB-7.');
		expect(summary(RU, [{ ok: false, error: 'not_found' }])).toBe(
			'Не вышло: 1 — элемент не найден.',
		);
	});

	test('разные причины перечисляются один раз, точка в конце причины не двоится', () => {
		expect(
			summary(RU, [
				{ ok: false, error: 'plane_failed' },
				{ ok: false, error: 'empty_text' },
				{ ok: false, error: 'plane_failed' },
				{ ok: false, error: 'zzz' },
				{ ok: false, error: 'yyy' },
			]),
		).toBe(
			'Не вышло: 5 — Plane не ответил — попробуйте ещё раз, пустой стикер, Что-то пошло не так.',
		);
	});

	test('пусто — пустая строка', () => {
		expect(summary(RU, [])).toBe('');
	});
});

describe('errorText', () => {
	test('известный код и неизвестный', () => {
		expect(errorText(RU, 'board_no_access')).toContain('Служебный аккаунт');
		expect(errorText(RU, 'zzz')).toBe('Что-то пошло не так.');
	});

	test('каждый код из таблицы', () => {
		const table: Record<string, string> = {
			unauthorized: 'Сессия Miro устарела — перезагрузите доску.',
			unknown_team: 'Эта команда Miro не подключена к Plane.',
			board_no_access:
				'Служебный аккаунт не может писать на эту доску. Откройте доступ к доске команде и повторите; на плане Free редактируются только три последние доски команды.',
			miro_not_connected: 'Сервис ещё не подключён к Miro. Напишите администратору.',
			unknown_project: 'Проект не найден или скрыт.',
			unknown_card: 'Карточка не связана с задачей.',
			plane_failed: 'Plane не ответил — попробуйте ещё раз.',
			miro_failed: 'Miro не ответил — попробуйте ещё раз.',
			not_found: 'элемент не найден',
			unsupported_type: 'этот тип элемента не переносится',
			empty_text: 'пустой стикер',
			already_linked: 'стикер уже связан с другой задачей',
		};
		for (const [code, text] of Object.entries(table)) expect(errorText(RU, code)).toBe(text);
	});

	test('ключи прототипа — не коды', () => {
		expect(errorText(RU, 'constructor')).toBe('Что-то пошло не так.');
		expect(errorText(RU, 'toString')).toBe('Что-то пошло не так.');
	});
});

describe('chunk и пакеты', () => {
	test('BATCH_SIZE — 10', () => {
		expect(BATCH_SIZE).toBe(10);
		expect(BATCH_SIZE).toBeLessThanOrEqual(MAX_ITEMS);
	});

	test('chunk режет по размеру, остаток — последним, пустой вход — пусто', () => {
		const ids = Array.from({ length: 25 }, (_, i) => String(i));
		const parts = chunk(ids, BATCH_SIZE);
		expect(parts.map((p) => p.length)).toEqual([10, 10, 5]);
		expect(parts.flat()).toEqual(ids);
		expect(chunk(ids.slice(0, 10), 10)).toEqual([ids.slice(0, 10)]);
		expect(chunk([], 10)).toEqual([]);
	});

	test('mergeBatch: ответ бэкенда отдаёт результаты как есть', () => {
		const results = [
			{ itemId: '1', ok: true as const, key: 'LAB-1', cardId: 'c1' },
			{ itemId: '2', ok: false as const, error: 'empty_text' },
		];
		expect(mergeBatch(['1', '2'], { ok: true, data: { results } })).toEqual(results);
	});

	test('mergeBatch: упавший запрос — каждая запись пакета с этой ошибкой', () => {
		expect(mergeBatch(['1', '2', '3'], { ok: false, error: 'plane_failed' })).toEqual([
			{ ok: false, error: 'plane_failed' },
			{ ok: false, error: 'plane_failed' },
			{ ok: false, error: 'plane_failed' },
		]);
	});

	test('mergeBatch: 2xx без results — неудача каждой записи пакета', () => {
		const bad = { ok: true, data: {} } as never;
		expect(mergeBatch(['1', '2'], bad)).toEqual([
			{ ok: false, error: 'unknown' },
			{ ok: false, error: 'unknown' },
		]);
	});
});

describe('convertInBatches', () => {
	const ids = Array.from({ length: 25 }, (_, i) => String(i));
	const good = (batch: string[]) => ({
		ok: true as const,
		data: { results: batch.map((id) => ({ ok: true as const, key: `LAB-${id}` })) },
	});

	test('второй пакет упал: размеры [10,10,5], 25 исходов, 10 неудач, третий всё равно ушёл', async () => {
		const sizes: number[] = [];
		const out = await convertInBatches(ids, async (batch) => {
			sizes.push(batch.length);
			return sizes.length === 2 ? { ok: false as const, error: 'network' } : good(batch);
		});
		expect(sizes).toEqual([10, 10, 5]);
		expect(out).toHaveLength(25);
		expect(out.slice(10, 20)).toEqual(
			Array.from({ length: 10 }, () => ({ ok: false, error: 'network' })),
		);
		expect(out.slice(20).every((o) => o.ok)).toBe(true);
		expect(summary(RU, out)).toContain('Не вышло: 10 —');
		expect(summary(RU, out)).toStartWith('Готово: LAB-0, LAB-1');
	});

	test('пакеты уходят по очереди, а не вместе', async () => {
		let running = 0;
		let peak = 0;
		await convertInBatches(ids, async (batch) => {
			running += 1;
			peak = Math.max(peak, running);
			await Promise.resolve();
			running -= 1;
			return good(batch);
		});
		expect(peak).toBe(1);
	});

	test('2xx без results — неудача пакета, прежние исходы сохранены', async () => {
		let calls = 0;
		const out = await convertInBatches(ids.slice(0, 20), async (batch) => {
			calls += 1;
			return calls === 2 ? ({ ok: true, data: {} } as never) : good(batch);
		});
		expect(out).toHaveLength(20);
		expect(out.slice(0, 10).every((o) => o.ok)).toBe(true);
		expect(out.slice(10)).toEqual(
			Array.from({ length: 10 }, () => ({ ok: false, error: 'unknown' })),
		);
	});

	test('прогресс: сделано и всего перед каждым пакетом; пустой список — без вызовов', async () => {
		const seen: [number, number][] = [];
		await convertInBatches(
			ids,
			async (batch) => good(batch),
			(d, t) => seen.push([d, t]),
		);
		expect(seen).toEqual([
			[0, 25],
			[10, 25],
			[20, 25],
		]);
		let calls = 0;
		expect(await convertInBatches([], async (b) => (calls++, good(b)))).toEqual([]);
		expect(calls).toBe(0);
	});
});

describe('currentSelection', () => {
	test('обновление, пришедшее раньше стартового чтения, не затирается им', () => {
		const initial = [{ id: '1', type: 'text' }];
		const updated = [{ id: '2', type: 'text' }];
		expect(currentSelection(updated, initial)).toEqual(updated);
		expect(currentSelection([], initial)).toEqual([]);
		expect(currentSelection(null, initial)).toEqual(initial);
	});
});

describe('apiResult', () => {
	const reply = (status: number, body: string) => async () => new Response(body, { status });

	test('fetch отклонён (сети нет) → network', async () => {
		expect(
			await apiResult(async () => {
				throw new TypeError('Failed to fetch');
			}),
		).toEqual({ ok: false, error: 'network' });
	});

	test('ошибка с кодом в JSON → этот код; тело не JSON, без кода или с не-строкой → unknown', async () => {
		expect(await apiResult(reply(409, '{"error":"board_no_access"}'))).toEqual({
			ok: false,
			error: 'board_no_access',
		});
		expect(await apiResult(reply(502, '<html>Bad Gateway</html>'))).toEqual({
			ok: false,
			error: 'unknown',
		});
		expect(await apiResult(reply(500, '{}'))).toEqual({ ok: false, error: 'unknown' });
		expect(await apiResult(reply(500, '{"error":5}'))).toEqual({ ok: false, error: 'unknown' });
		expect(await apiResult(reply(500, 'null'))).toEqual({ ok: false, error: 'unknown' });
	});

	test('2xx без тела или не JSON → unknown; 2xx с JSON → данные', async () => {
		expect(await apiResult(reply(200, ''))).toEqual({ ok: false, error: 'unknown' });
		expect(await apiResult(reply(200, 'ok'))).toEqual({ ok: false, error: 'unknown' });
		expect(await apiResult(reply(200, '{"projects":[]}'))).toEqual({
			ok: true,
			data: { projects: [] },
		});
	});
});

describe('English texts', () => {
	test('error texts in English', () => {
		const table: Record<string, string> = {
			unauthorized: 'The Miro session has expired — reload the board.',
			unknown_team: 'This Miro team is not connected to Plane.',
			board_no_access:
				'The service account cannot write to this board. Share the board with the team and try again; on the Free plan only the team’s three most recent boards can be edited.',
			miro_not_connected: 'The service is not connected to Miro yet. Contact your administrator.',
			unknown_project: 'Project not found or hidden.',
			unknown_card: 'This card is not linked to a work item.',
			plane_failed: 'Plane did not answer — try again.',
			miro_failed: 'Miro did not answer — try again.',
			not_found: 'item not found',
			unsupported_type: 'this item type cannot be converted',
			empty_text: 'empty sticky note',
			already_linked: 'the sticky note is already linked to another work item',
		};
		for (const [code, text] of Object.entries(table)) expect(errorText(EN, code)).toBe(text);
	});

	test('an unknown code, __proto__ and constructor are the fallback in English', () => {
		for (const code of ['zzz', '__proto__', 'constructor', 'toString'])
			expect(errorText(EN, code)).toBe('Something went wrong.');
	});

	test('summary in English', () => {
		expect(
			summary(EN, [
				{ ok: true, key: 'LAB-1' },
				{ ok: true, key: 'LAB-2' },
				{ ok: false, error: 'empty_text' },
			]),
		).toBe('Done: LAB-1, LAB-2. Failed: 1 — empty sticky note.');
		expect(summary(EN, [{ ok: true, key: 'LAB-7' }])).toBe('Done: LAB-7.');
		expect(summary(EN, [{ ok: false, error: 'not_found' }])).toBe('Failed: 1 — item not found.');
		expect(
			summary(EN, [
				{ ok: false, error: 'plane_failed' },
				{ ok: false, error: 'empty_text' },
				{ ok: false, error: 'plane_failed' },
				{ ok: false, error: 'zzz' },
				{ ok: false, error: 'yyy' },
			]),
		).toBe(
			'Failed: 5 — Plane did not answer — try again, empty sticky note, Something went wrong.',
		);
	});
});

describe('localeFrom', () => {
	test('a valid locale is taken, anything else is the default', () => {
		expect(localeFrom({ ok: true, data: { locale: 'en' } })).toBe('en');
		expect(localeFrom({ ok: true, data: { locale: 'ru' } })).toBe('ru');
		for (const data of [{ locale: 'fr' }, {}, null, { locale: 1 }])
			expect(localeFrom({ ok: true, data })).toBe(DEFAULT_LOCALE);
		expect(localeFrom({ ok: false, error: 'unauthorized' })).toBe(DEFAULT_LOCALE);
	});
});
