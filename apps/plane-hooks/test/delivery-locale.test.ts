import { CYRILLIC } from '@alxwlw/plane-kit/testing';
import { LOCALES } from '@alxwlw/plane-kit/locale';
import { describe, expect, test } from 'bun:test';

import { handleDeploy } from '../src/delivery/deploy.ts';
import { deployedHtml, rolledBackHtml } from '../src/delivery/notes.ts';
import { handlePreview } from '../src/delivery/preview.ts';
import { syncTask } from '../src/delivery/sync.ts';
import type { Pull } from '../src/github/client.ts';
import { messages } from '../src/i18n.ts';
import { tenantOf } from './config-fixture.ts';
import { fact, REPO, setup, squash } from './delivery-deploy-world.ts';
import { world } from './delivery-sync-world.ts';
import { deliveryWorld } from './delivery-world.ts';
const PULLS = [
	{ repo: 'acme/api', number: 1, url: 'https://github.com/acme/api/pull/1' },
] as Pull[];

describe('delivery notes by locale', () => {
	test('deploy note in English', () => {
		expect(deployedHtml(messages('en'), fact('a1'), PULLS)).toBe(
			'<p>Deployed: <code>acme/api</code> → staging · <code>a1</code> · <a href="https://github.com/acme/api/actions/runs/1">run</a> · PR: <a href="https://github.com/acme/api/pull/1">acme/api#1</a></p>',
		);
	});

	test('rollback note in English', () => {
		expect(rolledBackHtml(messages('en'), fact('a1'))).toBe(
			'<p>Rolled back: <code>acme/api</code> → staging · <code>a1</code> · <a href="https://github.com/acme/api/actions/runs/1">run</a></p>',
		);
	});

	test('notes escape interpolated values the same way in both languages', () => {
		const hostile = fact('a1', { environment: 'a<b&"c' });
		for (const l of LOCALES) {
			expect(deployedHtml(messages(l), hostile, PULLS)).toContain('a&lt;b&amp;&quot;c');
			expect(rolledBackHtml(messages(l), hostile)).toContain('a&lt;b&amp;&quot;c');
		}
	});
});

describe('preview note escapes the project name in both languages', () => {
	test('hostile project name', async () => {
		for (const locale of ['en', 'ru'] as const) {
			const w = deliveryWorld(tenantOf({ locale }));
			const id = w.item('ENG-1', 'In Progress');
			w.gh.pull({ repo: 'acme/api', number: 7, title: 'ENG-1 retries', head: 'feat/ENG-1-x' });
			await handlePreview(w.deps, {
				project: 'a<b',
				repo: 'acme/api',
				branch: 'feat/ENG-1-x',
				url: 'https://web.example.app',
				sha: null,
			});
			expect(w.plane.commentsOf(id)[0]?.comment_html).toContain('<code>a&lt;b</code>');
		}
	});
});

describe('comments keep their identity in every locale', () => {
	async function deployComments(locale: 'en' | 'ru') {
		const w = setup(tenantOf({ locale }));
		w.gh.commit('a0', [], 'init');
		squash(w, 'a1', 'a0', 1, 'ENG-1');
		w.gh.deploy(REPO, 'staging', 'a0', 'success');
		const id1 = w.gh.deploy(REPO, 'staging', 'a1', 'success');
		const id = w.item('ENG-1', 'In Review');
		await handleDeploy(w.deps, fact('a1', { deploymentId: id1 }));
		return w.plane.commentsOf(id);
	}

	test('deploy comments keep their external_id in every locale', async () => {
		const en = await deployComments('en');
		const ru = await deployComments('ru');
		expect(en.map((c) => [c.external_id.replace(/[^:]*:[^:]*:/, ''), c.external_source])).toEqual(
			ru.map((c) => [c.external_id.replace(/[^:]*:[^:]*:/, ''), c.external_source]),
		);
		expect(en).toHaveLength(2);
		// Deploy note and the state comment of the deploy cause.
		expect(en[0]?.comment_html).toStartWith('<p>Deployed: ');
		expect(en[1]?.comment_html).toBe(
			'<p>Status → <b>On staging</b>: deploy <code>a1</code> to <code>staging</code></p>',
		);
		for (const c of en) expect(c.comment_html).not.toMatch(CYRILLIC);
		expect(ru[1]?.comment_html).toBe(
			'<p>Статус → <b>On staging</b>: деплой <code>a1</code> в <code>staging</code></p>',
		);
	});

	test('state comments keep their external_id in every locale', async () => {
		const run = async (locale: 'en' | 'ru') => {
			const w = world(tenantOf({ locale }));
			const id = w.item('ENG-1', 'In Progress', [['acme/api', 1]]);
			w.gh.pull({ repo: 'acme/api', number: 1, title: 'ENG-1 feature' });
			await syncTask(w.deps, 'ENG-1', w.pr());
			return w.plane.commentsOf(id);
		};
		const [en, ru] = [await run('en'), await run('ru')];
		expect(en).toHaveLength(1);
		expect(en[0]?.external_id).toBe(ru[0]?.external_id ?? '');
		expect(en[0]?.external_source).toBe(ru[0]?.external_source ?? '');
		expect(en[0]?.comment_html).toBe(
			'<p>Status → <b>In Review</b>: <a href="https://github.com/acme/api/pull/1">acme/api#1</a></p>',
		);
	});

	test('preview comments keep their external_id in every locale', async () => {
		const preview = {
			project: 'web',
			repo: 'acme/api',
			branch: 'feat/ENG-1-retries',
			url: 'https://web-abc-example.vercel.app',
			sha: '0123456789abcdef0123456789abcdef01234567',
		};
		const run = async (locale: 'en' | 'ru') => {
			const w = deliveryWorld(tenantOf({ locale }));
			const id = w.item('ENG-1', 'In Progress');
			w.gh.pull({ repo: 'acme/api', number: 7, title: 'ENG-1 retries', head: preview.branch });
			await handlePreview(w.deps, preview);
			return w.plane.commentsOf(id);
		};
		const [en, ru] = [await run('en'), await run('ru')];
		expect(en).toHaveLength(1);
		expect(en[0]?.external_id).toBe(ru[0]?.external_id ?? '');
		expect(en[0]?.external_source).toBe(ru[0]?.external_source ?? '');
		expect(en[0]?.comment_html).toBe(
			'<p>Preview <code>web</code>: <a href="https://web-abc-example.vercel.app">https://web-abc-example.vercel.app</a> · branch <code>feat/ENG-1-retries</code> · <code>0123456</code></p>',
		);
	});
});
