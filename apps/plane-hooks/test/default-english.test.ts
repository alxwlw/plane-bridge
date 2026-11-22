import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';
import { CYRILLIC } from '@alxwlw/plane-kit/testing';
import { describe, expect, test } from 'bun:test';

import { syncTask } from '../src/delivery/sync.ts';
import { BASE_PULL, world as syncWorld } from './delivery-sync-world.ts';
import { fixtureBytes } from './fixtures.ts';
import type { FakePlane } from './fake-plane.ts';
import {
	BASE,
	githubRequest,
	grafanaRequest,
	statusPayload,
	tenantOf,
	world,
} from './server-harness.ts';

// A tenant whose file has no `locale`: the loader fills in DEFAULT_LOCALE (locale-config.test.ts pins that).
const tenant = () => tenantOf({ locale: DEFAULT_LOCALE });

/** Everything the service sent out through a fake Plane: its work items, comments, links, releases and calls. */
const sentTo = (plane: FakePlane): string[] => [
	JSON.stringify(plane.workItems),
	JSON.stringify(plane.comments),
	JSON.stringify(plane.links),
	JSON.stringify(plane.releases),
	JSON.stringify(plane.calls),
];

/** Dashboard annotation lines and every other log line: the titles the service hands to Grafana. */
const loggedBy = (w: ReturnType<typeof world>): string[] => w.logs.map((l) => JSON.stringify(l));

/** The three checks every scenario ends with. */
function expectEnglishOnly(bodies: string[], english: string) {
	expect(bodies.length).toBeGreaterThan(0);
	expect(bodies.filter((b) => CYRILLIC.test(b))).toEqual([]);
	expect(bodies.some((b) => b.includes(english))).toBe(true);
}

/** a0 ← a1 (ENG-1, PR #1 merged as a1), deployed to staging and to production. */
function deployWorld() {
	const w = world({ tenants: [tenant()] });
	w.gh.commit('a0', [], 'init');
	w.gh.commit('a1', ['a0'], 'ENG-1 change (#1)');
	w.gh.pull({ repo: 'acme/api', number: 1, title: 'ENG-1 change' }).mergePull('acme/api', 1, 'a1');
	w.gh.deploy('acme/api', 'staging', 'a0', 'success');
	w.gh.deploy('acme/api', 'production', 'a0', 'success');
	const staging = w.gh.deploy('acme/api', 'staging', 'a1', 'success');
	const production = w.gh.deploy('acme/api', 'production', 'a1', 'success');
	w.plane.addWorkItem('ENG-1', 'In Review');
	return { w, staging, production };
}

describe('a tenant without locale sends no Cyrillic', () => {
	test('hooks: a deploy ends in the Deployed comment, the state comment and a release', async () => {
		const { w, staging, production } = deployWorld();
		await w.send(
			githubRequest(
				'deployment_status',
				statusPayload('success', { id: staging, sha: 'a1', environment: 'staging' }),
			),
		);
		await w.send(
			githubRequest(
				'deployment_status',
				statusPayload('success', { id: production, sha: 'a1', environment: 'production' }),
			),
		);
		expect(w.plane.releases).toHaveLength(1);
		const bodies = [...sentTo(w.plane), ...loggedBy(w)];
		expectEnglishOnly(bodies, 'Deployed');
		expect(w.plane.comments.map((c) => c.comment_html).join('\n')).toContain(
			'Status → <b>Done</b>: deploy <code>a1</code> to <code>staging</code>',
		);
		expect(w.plane.releases[0]?.changelog).toContain('Commits');
	});

	test('hooks: a rollback ends in the Rolled back comment', async () => {
		const { w, staging } = deployWorld();
		await w.send(
			githubRequest(
				'deployment_status',
				statusPayload('success', { id: staging, sha: 'a1', environment: 'staging' }),
			),
		);
		const back = w.gh.deploy('acme/api', 'staging', 'a0', 'success');
		await w.send(
			githubRequest(
				'deployment_status',
				statusPayload(
					'success',
					{ id: back, sha: 'a0', environment: 'staging' },
					{ created_at: '2026-10-28T11:00:00Z' },
				),
			),
		);
		expect(w.lines('delivery.noted').map((l) => l.kind)).toEqual(['deployed', 'rolledback']);
		expectEnglishOnly([...sentTo(w.plane), ...loggedBy(w)], 'Rolled back');
	});

	test('hooks: a Grafana alert firing and resolving writes an English incident', async () => {
		const w = world({ tenants: [tenant()] });
		const firing = await fixtureBytes('grafana-firing.json');
		const resolved = await fixtureBytes('grafana-resolved.json');
		expect((await w.send(grafanaRequest('acme', firing))).status).toBe(200);
		expect((await w.send(grafanaRequest('acme', resolved))).status).toBe(200);
		const incidents = w.plane.workItems.filter((item) => item.project === 'p-inc');
		expect(incidents.length).toBeGreaterThan(0);
		const bodies = [...sentTo(w.plane), ...loggedBy(w)];
		expectEnglishOnly(bodies, 'Labels:');
		expect(bodies.some((b) => b.includes('Resolved'))).toBe(true);
		expect(bodies.some((b) => b.includes('Firing:'))).toBe(true);
	});

	test('hooks: a delivery state comment on a work item', async () => {
		const w = syncWorld(tenant());
		const id = w.item('ENG-1', 'In Progress', [['acme/api', 1]]);
		w.gh.pull({ repo: 'acme/api', number: 1, title: 'ENG-1 feature' });
		const result = await syncTask(w.deps, 'ENG-1', w.pr(BASE_PULL));
		expect(result).toMatchObject({ action: 'moved', to: 'In Review' });
		const comments = w.plane.commentsOf(id).map((c) => c.comment_html);
		expect(comments).toEqual([
			'<p>Status → <b>In Review</b>: <a href="https://github.com/acme/api/pull/1">acme/api#1</a></p>',
		]);
		expectEnglishOnly(sentTo(w.plane), 'Status → <b>In Review</b>');
	});

	test('hooks: GitHub setup without owner answers in English; with owner and kind the page is English', async () => {
		const w = world({ tenants: [tenant()] });
		const bare = await w.handler(new Request(`${BASE}/github/setup?tenant=acme`));
		expect(bare.status).toBe(400);
		const bareBody = await bare.text();
		const page = await w.handler(
			new Request(`${BASE}/github/setup?tenant=acme&owner=acme-corp&kind=org`),
		);
		expect(page.status).toBe(200);
		const html = await page.text();
		expect(html).toContain('<html lang="en">');
		expect(html).toContain('Create GitHub App');
		expectEnglishOnly([bareBody, html], 'kind=org|user');
	});

	test('hooks: GitHub setup of an unknown tenant is answered before a tenant is known', async () => {
		const w = world({ tenants: [tenant()] });
		const res = await w.handler(new Request(`${BASE}/github/setup?tenant=unknown`));
		expect(res.status).toBe(404);
		expectEnglishOnly([await res.text()], 'not found');
	});
});
