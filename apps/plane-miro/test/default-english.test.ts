import { join } from 'node:path';

import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';
import { CYRILLIC } from '@alxwlw/plane-kit/testing';
import { describe, expect, test } from 'bun:test';

import { messages } from '../src/i18n.ts';
import { miroOauthCallback, miroSetupRedirect, signState } from '../src/miro/oauth.ts';
import { createWeb } from '../src/web.ts';
import { configOf } from './config-fixture.ts';
import { Store } from '../src/store.ts';
import { BOARD, frame, sticky, world } from './world.ts';

/** The checks every scenario ends with: something was sent, none of it is Russian, a named English text is in it. */
function expectEnglishOnly(bodies: string[], english: string) {
	expect(bodies.length).toBeGreaterThan(0);
	expect(bodies.filter((b) => CYRILLIC.test(b))).toEqual([]);
	expect(bodies.some((b) => b.includes(english))).toBe(true);
}

/** A world of a tenant without `locale` (the loader fills DEFAULT_LOCALE) whose board, items and members are ASCII. */
function englishWorld() {
	const w = world({ locale: DEFAULT_LOCALE, keepSource: false });
	w.board.name = 'Board';
	w.board.items.set('77', frame('77', 'Frame'));
	w.board.items.set('101', sticky('101', '<p>First sticky</p>', 10, 20));
	w.board.items.set('102', sticky('102', '<p>Second</p>', 300, 20));
	w.plane.projects = [{ id: 'p1', identifier: 'LAB', name: 'Lab', archived: false }];
	w.plane.members = [{ id: 'u1', displayName: 'Anna', avatarUrl: null }];
	return w;
}

/** Everything the world's Plane and Miro recorded, one JSON body each. */
const recorded = (w: ReturnType<typeof englishWorld>): string[] => [
	...w.plane.createdItems.map((c) => JSON.stringify(c)),
	...w.plane.createdComments.map((c) => JSON.stringify(c)),
	...[...w.plane.links].map((l) => JSON.stringify(l)),
	...[...w.plane.descriptions].map((d) => JSON.stringify(d)),
	...w.miro.cardsOn(BOARD).map((c) => JSON.stringify(c)),
];

describe('a tenant without locale sends no Cyrillic', () => {
	test('miro: converting a sticky note with an empty author names the English default author', async () => {
		const w = englishWorld();
		const res = await w.call('POST', '/miro/api/convert', {
			body: { boardId: BOARD, projectId: 'p1', author: '  ', itemIds: ['101'] },
		});
		expect(res.status).toBe(200);
		expect(w.plane.createdItems).toHaveLength(1);
		const bodies = [...recorded(w), JSON.stringify(await res.json())];
		expectEnglishOnly(bodies, `From the Miro board: ${messages(DEFAULT_LOCALE).defaultAuthor}`);
	});

	test('miro: binding a sticky note writes the English bind comment', async () => {
		const w = englishWorld();
		w.plane.items.set('w-ex', {
			id: 'w-ex',
			projectId: 'p1',
			sequenceId: 7,
			name: 'Existing',
			stateId: 's-backlog',
			assignees: [],
			descriptionHtml: '<p>Was</p>',
		});
		const res = await w.call('POST', '/miro/api/bind', {
			body: { boardId: BOARD, itemId: '101', workItemId: 'w-ex', projectId: 'p1', author: '' },
		});
		expect(res.status).toBe(200);
		expect(w.plane.createdComments).toHaveLength(1);
		const bodies = [...recorded(w), JSON.stringify(await res.json())];
		expectEnglishOnly(bodies, 'From the Miro board (Miro user):');
	});

	test('miro: the OAuth callback answers in English for a resolved tenant and before a tenant is known', async () => {
		const base = configOf();
		const config = { ...base, tenants: [{ ...base.tenants[0]!, locale: DEFAULT_LOCALE }] };
		const secret = config.miro.clientSecret;
		const NOW = 1_000_000;
		const deps = {
			config,
			store: new Store(':memory:'),
			fetch: async () => new Response('{}'),
			log: () => {},
			nowMs: NOW,
		};
		const url = (query: string) =>
			new URL(`https://plane-miro.example.com/miro/oauth/callback?${query}`);
		const resolved = await miroOauthCallback(
			url(`state=${signState('acme', NOW + 60_000, secret)}`),
			deps,
		);
		const unknown = await miroOauthCallback(url('state=nobody.1.x'), deps);
		const setup = miroSetupRedirect(config, new URL('https://x/miro/setup?tenant=nope'), NOW);
		const bodies = await Promise.all([resolved, unknown, setup].map((r) => r.text()));
		expect([resolved.status, unknown.status, setup.status]).toEqual([400, 400, 404]);
		expectEnglishOnly(bodies, 'Missing code parameter');
		expect(bodies.some((b) => b === 'Unknown tenant')).toBe(true);
	});

	test('miro: GET /miro/api/locale answers en', async () => {
		const w = englishWorld();
		const res = await w.call('GET', '/miro/api/locale');
		expect(res.status).toBe(200);
		expect(await res.clone().json()).toEqual({ locale: 'en' });
		expectEnglishOnly([await res.text()], '"locale":"en"');
	});

	// Exempt from the DEFAULT_LOCALE mutation: the pages are static and carry no text of either catalog
	// (web/app.html:5 and web/panel.html:6 hold the fixed `<title>Plane</title>`); the client picks its texts from /miro/api/locale.
	test('miro: the served pages carry no Cyrillic', async () => {
		const web = createWeb(join(import.meta.dir, '../web'), new Map());
		const bodies: string[] = [];
		for (const name of ['app', 'panel', 'card']) {
			const res = web(new URL(`http://x/miro/${name}`));
			expect(res?.status).toBe(200);
			bodies.push(await (res as Response).text());
		}
		expectEnglishOnly(bodies, '<title>Plane</title>');
	});
});
