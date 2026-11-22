import { describe, expect, test } from 'bun:test';

import { createApi } from '../src/api.ts';
import { BOARD, jwt, NOW_SEC, seedItem, world } from './world.ts';

const EN_TEAM = '3458764500000000002';
const RU_TEAM = '3458764500000000003';

const convertBody = (over: Record<string, unknown> = {}) => ({
	boardId: BOARD,
	projectId: 'p1',
	author: 'Аня',
	itemIds: ['101'],
	...over,
});
const bindBody = (over: Record<string, unknown> = {}) => ({
	boardId: BOARD,
	itemId: '101',
	workItemId: 'w-ex',
	projectId: 'p1',
	author: 'Аня',
	...over,
});

/** One api over two tenants of different languages, each with its own Plane. */
function twoTeams() {
	const en = world({ id: 'enteam', locale: 'en', miroTeamId: EN_TEAM });
	const ru = world({ id: 'ruteam', locale: 'ru', miroTeamId: RU_TEAM });
	const api = createApi({
		config: { ...en.config, tenants: [en.tenant, ru.tenant] },
		runtimes: new Map([
			[en.tenant.id, en.rt],
			[ru.tenant.id, ru.rt],
		]),
		store: en.store,
		log: en.log,
		nowSec: () => NOW_SEC,
	});
	const call = async (method: string, path: string, token: string | null, body?: unknown) => {
		const url = new URL(`http://x${path}`);
		const res = await api(
			new Request(url.href, {
				method,
				...(token === null ? {} : { headers: { authorization: `Bearer ${token}` } }),
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			}),
			url,
		);
		return { status: res.status, body: (await res.json()) as unknown };
	};
	return { en, ru, call };
}

describe('GET /miro/api/locale', () => {
	test('the locale route answers the tenant locale', async () => {
		const { call } = twoTeams();
		const get = (token: string | null, method = 'GET') => call(method, '/miro/api/locale', token);
		expect(await get(jwt({ team: EN_TEAM }))).toEqual({ status: 200, body: { locale: 'en' } });
		expect(await get(jwt({ team: RU_TEAM }))).toEqual({ status: 200, body: { locale: 'ru' } });
		expect(await get(null)).toEqual({ status: 401, body: { error: 'unauthorized' } });
		expect(await get(jwt({ team: '999' }))).toEqual({
			status: 403,
			body: { error: 'unknown_team' },
		});
		expect(await get(jwt({ team: EN_TEAM }), 'POST')).toEqual({
			status: 405,
			body: { error: 'method_not_allowed' },
		});
	});
});

describe('texts written to Plane follow the tenant locale', () => {
	test('an empty author is the Miro user in English', async () => {
		const w = world({ locale: 'en' });
		await w.call('POST', '/miro/api/convert', { body: convertBody({ author: '   ' }) });
		expect(w.plane.createdItems[0]?.item.description_html).toBe(
			'<p>Первый стикер</p><p>From the Miro board: Miro user</p>',
		);
	});

	test('two teams, two languages', async () => {
		const { en, ru, call } = twoTeams();
		for (const team of [EN_TEAM, RU_TEAM]) {
			const res = await call(
				'POST',
				'/miro/api/convert',
				jwt({ team }),
				convertBody({ author: '   ' }),
			);
			expect(res.status).toBe(200);
		}
		expect(en.plane.createdItems[0]?.item.description_html).toBe(
			'<p>Первый стикер</p><p>From the Miro board: Miro user</p>',
		);
		expect(ru.plane.createdItems[0]?.item.description_html).toBe(
			'<p>Первый стикер</p><p>С доски Miro: участник Miro</p>',
		);
	});

	test('an empty author is the Miro user in the bind comment, in English', async () => {
		const w = world({ locale: 'en' });
		seedItem(w.plane, 'w-ex');
		await w.call('POST', '/miro/api/bind', { body: bindBody({ author: '   ' }) });
		expect(w.plane.createdComments[0]?.comment.comment_html).toBe(
			'<p>From the Miro board (Miro user):</p><p>Первый стикер</p>',
		);
	});

	test('bind, two teams, two languages', async () => {
		const { en, ru, call } = twoTeams();
		seedItem(en.plane, 'w-ex');
		seedItem(ru.plane, 'w-ex');
		for (const team of [EN_TEAM, RU_TEAM]) {
			const res = await call('POST', '/miro/api/bind', jwt({ team }), bindBody({ author: '   ' }));
			expect(res.status).toBe(200);
		}
		expect(en.plane.createdComments[0]?.comment.comment_html).toBe(
			'<p>From the Miro board (Miro user):</p><p>Первый стикер</p>',
		);
		expect(ru.plane.createdComments[0]?.comment.comment_html).toBe(
			'<p>С доски Miro (участник Miro):</p><p>Первый стикер</p>',
		);
	});
});
