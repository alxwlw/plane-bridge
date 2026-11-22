import { describe, expect, test } from 'bun:test';

import { messages } from '../src/i18n.ts';
import type { IncidentSignal } from '../src/incident.ts';
import { incidentAnnotation } from '../src/jobs.ts';
import type { FakePlane } from './fake-plane.ts';
import { FakePlane as Plane } from './fake-plane.ts';
import { fixture, fixtureBytes } from './fixtures.ts';
import {
	dokployRequest,
	githubRequest,
	grafanaRequest,
	statusPayload,
	tenantOf,
	vercelRequest,
	world,
} from './server-harness.ts';

const CYRILLIC = /[Ѐ-ӿ]/;
const SHA = 'abcdef0123456789abcdef0123456789abcdef01';

/** Two tenants of one process, each with its own Plane, one in English and one in Russian. */
function twoTenants() {
	const planes: Record<string, FakePlane> = {
		'en-team': Plane.delivery(),
		'ru-team': Plane.delivery(),
	};
	const w = world({
		tenants: [tenantOf({ id: 'en-team', locale: 'en' }), tenantOf({ id: 'ru-team', locale: 'ru' })],
		planes,
	});
	const incidents = (id: 'en-team' | 'ru-team') =>
		(planes[id] as FakePlane).workItems.filter((item) => item.project === 'p-inc');
	return { w, planes, incidents };
}

/** Everything a tenant's incident wrote to its Plane, as one string. */
function written(planes: Record<string, FakePlane>, id: string): string {
	const plane = planes[id] as FakePlane;
	return JSON.stringify([plane.workItems, plane.comments]);
}

describe('two tenants in one process get incidents in their own language', () => {
	test('Grafana: firing then resolved, work item, comment and dashboard annotation', async () => {
		const { w, planes, incidents } = twoTenants();
		const firing = await fixtureBytes('grafana-firing.json');
		const resolved = await fixtureBytes('grafana-resolved.json');
		for (const id of ['en-team', 'ru-team']) {
			expect((await w.send(grafanaRequest(id, firing))).status).toBe(200);
		}
		const [en] = incidents('en-team');
		const [ru] = incidents('ru-team');
		expect(en?.name).toBe('[prod] ServiceDown: order-gateway is down');
		expect(ru?.name).toBe('[prod] ServiceDown: order-gateway is down');
		expect(en?.external_id).toBe(ru?.external_id);
		expect(en?.description_html).toContain('<p>Labels:</p>');
		expect(en?.description_html).toContain('>Rule</a>');
		expect(ru?.description_html).toContain('<p>Метки:</p>');
		expect(ru?.description_html).toContain('>Правило</a>');
		expect(
			w.logs.filter((l) => l.annotation === 'incident').map((l) => [l.tenant, l.title]),
		).toEqual([
			['en-team', 'Firing: [prod] ServiceDown: order-gateway is down'],
			['en-team', 'Firing: [staging] QueueStalled: settle queue stalled'],
			['ru-team', 'Сработал: [prod] ServiceDown: order-gateway is down'],
			['ru-team', 'Сработал: [staging] QueueStalled: settle queue stalled'],
		]);
		w.logs.length = 0;
		for (const id of ['en-team', 'ru-team']) {
			expect((await w.send(grafanaRequest(id, resolved))).status).toBe(200);
		}
		expect(
			w.logs.filter((l) => l.annotation === 'incident').map((l) => [l.tenant, l.title]),
		).toEqual([
			['en-team', 'Resolved: [prod] ServiceDown: order-gateway is down'],
			['ru-team', 'Погас: [prod] ServiceDown: order-gateway is down'],
		]);
		const comments = (id: 'en-team' | 'ru-team') =>
			(planes[id] as FakePlane).comments.map((c) => c.comment_html);
		expect(comments('en-team').some((html) => html.includes('Firing 2026-10-06 10:00 UTC'))).toBe(
			true,
		);
		expect(comments('en-team').some((html) => html.includes('Resolved 2026-10-06 10:07 UTC'))).toBe(
			true,
		);
		expect(comments('ru-team').some((html) => html.includes('Сработал 2026-10-06 10:00 UTC'))).toBe(
			true,
		);
		expect(comments('ru-team').some((html) => html.includes('Погас 2026-10-06 10:07 UTC'))).toBe(
			true,
		);
		expect(written(planes, 'en-team')).not.toMatch(CYRILLIC);
		expect(written(planes, 'ru-team')).toMatch(CYRILLIC);
		expect((planes['en-team'] as FakePlane).comments.map((c) => c.external_id)).toEqual(
			(planes['ru-team'] as FakePlane).comments.map((c) => c.external_id),
		);
	});

	test('Vercel: failure incident and the deploy annotation summary', async () => {
		const { w, planes, incidents } = twoTenants();
		const body = await fixture('vercel-deployment-error.json');
		for (const id of ['en-team', 'ru-team']) {
			expect((await w.send(vercelRequest(id, body))).status).toBe(200);
		}
		expect(incidents('en-team')[0]?.name).toBe(
			'Deploy failed: terminal (production) · feat/ops-12-plane-hooks',
		);
		expect(incidents('ru-team')[0]?.name).toBe(
			'Деплой упал: terminal (production) · feat/ops-12-plane-hooks',
		);
		expect(incidents('en-team')[0]?.description_html).toContain(
			'<p>Project: <code>terminal</code>',
		);
		expect(incidents('ru-team')[0]?.description_html).toContain('<p>Проект: <code>terminal</code>');
		expect(incidents('en-team')[0]?.external_id).toBe(incidents('ru-team')[0]?.external_id);
		expect(w.logs.filter((l) => l.annotation === 'deploy').map((l) => [l.tenant, l.title])).toEqual(
			[
				['en-team', '✗ terminal → production failed · 0123456'],
				['ru-team', '✗ terminal → production упал · 0123456'],
			],
		);
		expect(written(planes, 'en-team')).not.toMatch(CYRILLIC);
	});

	test('GitHub: deployment failure incident', async () => {
		const [app] = tenantOf().github;
		const planes: Record<string, FakePlane> = {
			'en-team': Plane.delivery(),
			'ru-team': Plane.delivery(),
		};
		const w = world({
			tenants: [
				tenantOf({ id: 'en-team', locale: 'en' }),
				// its own App id: a delivery reaches the tenant through the App it carries
				tenantOf({
					id: 'ru-team',
					locale: 'ru',
					github: [{ ...(app as NonNullable<typeof app>), appId: 1_000_002 }],
				}),
			],
			planes,
		});
		const payload = statusPayload('failure', { sha: SHA, environment: 'production' });
		expect((await w.send(githubRequest('deployment_status', payload, 1_000_001))).status).toBe(202);
		expect((await w.send(githubRequest('deployment_status', payload, 1_000_002))).status).toBe(202);
		const incident = (id: string) =>
			(planes[id] as FakePlane).workItems.filter((item) => item.project === 'p-inc');
		expect(incident('en-team').map((item) => item.name)).toEqual([
			'Deploy failed: acme/api → production · abcdef0',
		]);
		expect(incident('ru-team').map((item) => item.name)).toEqual([
			'Деплой упал: acme/api → production · abcdef0',
		]);
		expect(incident('en-team')[0]?.description_html).toContain(
			'<p>Repository: <code>acme/api</code>',
		);
		expect(incident('en-team')[0]?.external_id).toBe(incident('ru-team')[0]?.external_id);
		expect(written(planes, 'en-team')).not.toMatch(CYRILLIC);
	});

	test('Dokploy: build failure, backup failure and the recorded deployment description', async () => {
		const { w, planes, incidents } = twoTenants();
		const timestamp = '2026-10-29T10:05:00.000Z';
		const build = {
			title: 'Build Error',
			message: 'Build failed for application: api',
			projectName: 'shop',
			applicationName: 'api',
			applicationType: 'application',
			errorMessage: 'npm ERR! missing script',
			buildLink: 'https://dokploy.example.com/dashboard/p1?tab=deployments',
			timestamp,
			status: 'error',
			type: 'build',
		};
		const backup = {
			title: 'Database Backup Failed',
			message: 'Database backup',
			applicationName: 'pg',
			databaseName: 'orders',
			type: 'error',
			errorMessage: 'pg_dump: connection refused',
			timestamp: '2026-10-29T03:00:00.000Z',
			status: 'error',
		};
		for (const id of ['en-team', 'ru-team']) {
			expect((await w.send(dokployRequest(id, build))).status).toBe(200);
			expect((await w.send(dokployRequest(id, backup))).status).toBe(200);
		}
		const names = (id: 'en-team' | 'ru-team') => incidents(id).map((item) => item.name);
		expect(names('en-team')).toEqual(['Build failed: api', 'Backup failed: pg/orders']);
		expect(names('ru-team')).toEqual(['Сборка упала: api', 'Бэкап упал: pg/orders']);
		expect(incidents('en-team')[1]?.description_html).toContain(
			'<p>Database: <code>pg/orders</code></p>',
		);
		expect(incidents('ru-team')[1]?.description_html).toContain(
			'<p>База: <code>pg/orders</code></p>',
		);
		expect(written(planes, 'en-team')).not.toMatch(CYRILLIC);

		w.gh.visibility('acme/api', 'private').branch('acme/api', 'main', SHA);
		for (const id of ['en-team', 'ru-team']) {
			const ok = {
				...build,
				title: 'Build Success',
				status: 'success',
				timestamp: '2026-10-29T10:10:00.000Z',
			};
			expect((await w.send(dokployRequest(id, ok))).status).toBe(200);
		}
		const deployments = await w.gh.listDeployments('acme/api', 'production', 5);
		expect(deployments.map((d) => d.description).sort()).toEqual([
			'head of main when Dokploy notified',
			'голова main в момент уведомления Dokploy',
		]);
	});
});

describe('incidentAnnotation by locale', () => {
	const firing = {
		status: 'firing',
		source: 'grafana',
		key: 'fp',
		occurrence: 'o',
		at: 'a',
		title: '[prod] Down',
		bodyHtml: '',
		noteHtml: '',
		priority: 'high',
		label: 'alert',
		env: 'prod',
	} satisfies IncidentSignal;
	const resolved = {
		status: 'resolved',
		source: 'grafana',
		key: 'fp',
		at: 'a',
		noteHtml: '',
		title: '[prod] Down',
		env: 'prod',
	} satisfies IncidentSignal;

	test('annotation titles follow the locale', () => {
		expect(incidentAnnotation(firing, messages('en'))('created')?.title).toBe(
			'Firing: [prod] Down',
		);
		expect(incidentAnnotation(resolved, messages('en'))('commented')?.title).toBe(
			'Resolved: [prod] Down',
		);
		expect(incidentAnnotation(firing, messages('ru'))('created')?.title).toBe(
			'Сработал: [prod] Down',
		);
		expect(incidentAnnotation(resolved, messages('ru'))('commented')?.title).toBe(
			'Погас: [prod] Down',
		);
	});

	test('a replay and an error make no annotation in either locale', () => {
		for (const l of ['en', 'ru'] as const) {
			expect(incidentAnnotation(firing, messages(l))('noop')).toBeUndefined();
			expect(incidentAnnotation(resolved, messages(l))('created')).toBeUndefined();
		}
	});

	test('the title falls back to the key', () => {
		const { title: _title, ...untitled } = resolved;
		expect(incidentAnnotation(untitled, messages('en'))('commented')?.title).toBe('Resolved: fp');
	});
});
