import { LOCALES } from '@alxwlw/plane-kit/locale';
import { describe, expect, test } from 'bun:test';

import {
	type DokployEvent,
	parseDokployWebhook,
	recordDokployDeploy,
	verifyDokploy,
} from '../src/dokploy.ts';
import type { GitHubApi } from '../src/github/client.ts';
import { messages } from '../src/i18n.ts';
import { BadPayload } from '../src/payload.ts';
import { tenantOf } from './config-fixture.ts';
import { FakeGitHub } from './fake-github.ts';
import { fixture } from './fixtures.ts';

const SECRET = 'dokploy-secret';
const SHA = '0123456789abcdef0123456789abcdef01234567';
const BUILD_LINK =
	'https://dokploy.example.com/dashboard/project/p1/environment/e1/services/application/a1?tab=deployments';

// по исходникам Dokploy v0.30.10: packages/server/src/utils/notifications/build-success.ts
const buildSuccess = (patch: Record<string, string> = {}) => ({
	title: 'Build Success',
	message: 'Build success for application: billing',
	projectName: 'shop',
	applicationName: 'api',
	applicationType: 'application',
	buildLink: BUILD_LINK,
	timestamp: '2026-10-29T10:00:00.000Z',
	date: '10/29/2026, 10:00:00 AM',
	domains: 'api.example.com',
	status: 'success',
	type: 'build',
	...patch,
});

// по исходникам Dokploy v0.30.10: packages/server/src/utils/notifications/build-error.ts
const buildError = (patch: Record<string, string> = {}) => ({
	title: 'Build Error',
	message: 'Build failed for application: api',
	projectName: 'shop',
	applicationName: 'api',
	applicationType: 'application',
	errorMessage: 'Error: npm ERR! <missing> script & more',
	buildLink: BUILD_LINK,
	timestamp: '2026-10-29T10:05:00.000Z',
	date: '10/29/2026, 10:05:00 AM',
	status: 'error',
	type: 'build',
	...patch,
});

// по исходникам Dokploy v0.30.10: packages/server/src/utils/notifications/database-backup.ts
const databaseBackup = (outcome: 'success' | 'error', patch: Record<string, string> = {}) => ({
	title: outcome === 'success' ? 'Database Backup Successful' : 'Database Backup Failed',
	message: 'Database backup',
	projectName: 'shop',
	applicationName: 'pg',
	databaseType: 'postgres',
	databaseName: 'orders',
	type: outcome,
	errorMessage: outcome === 'error' ? 'pg_dump: connection refused' : '',
	timestamp: '2026-10-29T03:00:00.000Z',
	date: '10/29/2026, 3:00:00 AM',
	status: outcome,
	...patch,
});

// по исходникам Dokploy v0.30.10: packages/server/src/utils/notifications/volume-backup.ts
const volumeBackup = (outcome: 'success' | 'error', patch: Record<string, string> = {}) => ({
	title: outcome === 'success' ? 'Volume Backup Successful' : 'Volume Backup Failed',
	message: 'Volume backup',
	projectName: 'shop',
	applicationName: 'files',
	volumeName: 'uploads',
	serviceType: 'application',
	type: outcome,
	errorMessage: outcome === 'error' ? 'tar: no space left' : '',
	backupSize: outcome === 'success' ? '12 MB' : '',
	timestamp: '2026-10-29T03:30:00.000Z',
	date: '10/29/2026, 3:30:00 AM',
	status: outcome,
	...patch,
});

// по исходникам Dokploy v0.30.10: packages/server/src/utils/notifications/docker-cleanup.ts
const dockerCleanup = {
	title: 'Docker Cleanup',
	message: 'Docker cleanup',
	cleanupMessage: 'Removed 3 images',
	timestamp: '2026-10-29T04:00:00.000Z',
	date: '10/29/2026, 4:00:00 AM',
	status: 'success',
	type: 'docker-cleanup',
};

// по исходникам Dokploy v0.30.10: packages/server/src/utils/notifications/dokploy-restart.ts
const dokployRestart = {
	title: 'Dokploy Server Restarted',
	message: 'Restarted',
	timestamp: '2026-10-29T04:10:00.000Z',
	date: '10/29/2026, 4:10:00 AM',
	status: 'success',
	type: 'dokploy-restart',
};

// по исходникам Dokploy v0.30.10: packages/server/src/utils/notifications/dokploy-backup.ts
const dokployBackup = {
	title: 'Dokploy Backup Successful',
	message: 'Backup',
	backupType: 'Complete Dokploy Instance',
	timestamp: '2026-10-29T04:20:00.000Z',
	date: '10/29/2026, 4:20:00 AM',
	status: 'success',
	type: 'dokploy-backup',
};

// по исходникам Dokploy v0.30.10: packages/server/src/utils/notifications/server-threshold.ts
const serverThreshold = {
	title: 'Server Threshold Alert',
	message: 'CPU high',
	serverName: 'vps-1',
	type: 'CPU',
	currentValue: '95',
	threshold: '90',
	timestamp: '2026-10-29T04:30:00.000Z',
	date: '10/29/2026, 4:30:00 AM',
	status: 'alert',
	alertType: 'server-threshold',
};

type Deployed = Extract<DokployEvent, { kind: 'deployed' }>;
type Failed = Extract<DokployEvent, { kind: 'failed' }>;

function deployed(body: unknown = buildSuccess()): Deployed {
	const event = parseDokployWebhook(body, messages('ru'));
	if (event.kind !== 'deployed') throw new Error(`expected deployed, got ${event.kind}`);
	return event;
}

function failed(body: unknown): Failed {
	const event = parseDokployWebhook(body, messages('ru'));
	if (event.kind !== 'failed') throw new Error(`expected failed, got ${event.kind}`);
	return event;
}

describe('verifyDokploy', () => {
	const headers = (authorization?: string) =>
		new Headers(authorization === undefined ? {} : { authorization });

	test('подлинность: верный Bearer — true; чужой, пустой, без Bearer, другой длины — false', () => {
		expect(verifyDokploy(headers(`Bearer ${SECRET}`), SECRET)).toBe(true);
		expect(verifyDokploy(headers('Bearer dokploy-secreT'), SECRET)).toBe(false);
		expect(verifyDokploy(headers('Bearer '), SECRET)).toBe(false);
		expect(verifyDokploy(headers(SECRET), SECRET)).toBe(false);
		expect(verifyDokploy(headers(`Bearer ${SECRET}-and-more`), SECRET)).toBe(false);
		expect(verifyDokploy(headers('Bearer x'), SECRET)).toBe(false);
		expect(verifyDokploy(headers(), SECRET)).toBe(false);
		expect(verifyDokploy(headers(`Basic ${SECRET}`), SECRET)).toBe(false);
		// the right secret behind a seven-character scheme that is not `Bearer `
		expect(verifyDokploy(headers(`Bearerx ${SECRET}`), SECRET)).toBe(false);
		expect(verifyDokploy(headers(`bearer ${SECRET}`), SECRET)).toBe(false);
	});
});

describe('parseDokployWebhook', () => {
	test('деплой приложения — deployed с app, at из timestamp и ссылкой buildLink', () => {
		const event = deployed();
		expect(event).toMatchObject({
			kind: 'deployed',
			app: 'api',
			at: '2026-10-29T10:00:00.000Z',
			url: BUILD_LINK,
		});
		expect(event.resolve).toMatchObject({
			status: 'resolved',
			source: 'dokploy',
			key: 'dokploy:api:build',
			at: '2026-10-29T10:00:00.000Z',
		});
		expect(event.resolve.noteHtml).toContain('Сборка снова проходит');
	});

	test('деплой: buildLink не http — url null; timestamp приводится к ISO', () => {
		const event = deployed(
			buildSuccess({ buildLink: 'javascript:alert(1)', timestamp: '2026-10-29T13:00:00+03:00' }),
		);
		expect(event.url).toBeNull();
		expect(event.at).toBe('2026-10-29T10:00:00.000Z');
	});

	test('ошибка сборки — инцидент dokploy:<app>:build, high, deploy-failed', () => {
		const { signal } = failed(buildError());
		expect(signal).toMatchObject({
			status: 'firing',
			source: 'dokploy',
			key: 'dokploy:api:build',
			occurrence: '2026-10-29T10:05:00.000Z',
			at: '2026-10-29T10:05:00.000Z',
			title: 'Сборка упала: api',
			priority: 'high',
			label: 'deploy-failed',
		});
		if (signal.status !== 'firing') throw new Error('expected firing');
		// the error text reaches the work item, escaped
		expect(signal.bodyHtml).toContain('npm ERR! &lt;missing&gt; script &amp; more');
		expect(signal.bodyHtml).toContain(BUILD_LINK);
		expect(signal.noteHtml).toContain('Сборка упала');
	});

	test('ошибка сборки: длинный errorMessage обрезается', () => {
		const { signal } = failed(buildError({ errorMessage: 'x'.repeat(5000) }));
		if (signal.status !== 'firing') throw new Error('expected firing');
		expect(signal.bodyHtml).toContain(`<code>${'x'.repeat(1999)}…</code>`);
	});

	test('ошибка сборки: проект в теле работы — если Dokploy его назвал', () => {
		const withProject = failed(buildError()).signal;
		const without = failed(buildError({ projectName: '' })).signal;
		if (withProject.status !== 'firing' || without.status !== 'firing')
			throw new Error('expected firing');
		expect(withProject.bodyHtml).toContain(
			'<p>Приложение: <code>api</code>, проект: <code>shop</code></p>',
		);
		expect(without.bodyHtml).toContain('<p>Приложение: <code>api</code></p>');
	});

	test('длинное имя приложения не раздувает заголовок инцидента: до 200 знаков', () => {
		const name = 'a'.repeat(300);
		const build = failed(buildError({ applicationName: name })).signal;
		const backup = failed(databaseBackup('error', { applicationName: name })).signal;
		for (const signal of [build, backup]) {
			if (signal.status !== 'firing') throw new Error('expected firing');
			expect(Array.from(signal.title)).toHaveLength(200);
			expect(signal.title.endsWith('…')).toBe(true);
		}
	});

	test('упавший бэкап БД и тома — инцидент …:backup', () => {
		const db = failed(databaseBackup('error')).signal;
		expect(db).toMatchObject({
			at: '2026-10-29T03:00:00.000Z',
			status: 'firing',
			source: 'dokploy',
			key: 'dokploy:pg/orders:backup',
			occurrence: '2026-10-29T03:00:00.000Z',
			title: 'Бэкап упал: pg/orders',
			priority: 'high',
			label: 'alert',
		});
		if (db.status !== 'firing') throw new Error('expected firing');
		expect(db.bodyHtml).toContain('База: <code>pg/orders</code>');
		expect(db.bodyHtml).toContain('pg_dump: connection refused');
		expect(db.noteHtml).toContain('Бэкап упал: <code>pg/orders</code>');

		const volume = failed(volumeBackup('error')).signal;
		if (volume.status !== 'firing') throw new Error('expected firing');
		expect(volume.bodyHtml).toContain('Том: <code>files/uploads</code>');
		expect(volume).toMatchObject({
			key: 'dokploy:files/uploads:backup',
			title: 'Бэкап упал: files/uploads',
			priority: 'high',
			label: 'alert',
		});
	});

	test('бэкап без имени БД или тома — имя приложения', () => {
		expect(failed(databaseBackup('error', { databaseName: '' })).signal.key).toBe(
			'dokploy:pg:backup',
		);
		expect(failed(volumeBackup('error', { volumeName: '' })).signal.key).toBe(
			'dokploy:files:backup',
		);
	});

	test('успешный бэкап — Погас …:backup', () => {
		const db = deployedOrResolved(databaseBackup('success'));
		expect(db).toMatchObject({
			status: 'resolved',
			source: 'dokploy',
			key: 'dokploy:pg/orders:backup',
			at: '2026-10-29T03:00:00.000Z',
		});
		const volume = deployedOrResolved(volumeBackup('success'));
		expect(volume).toMatchObject({ status: 'resolved', key: 'dokploy:files/uploads:backup' });
		if (db.status !== 'resolved') throw new Error('expected resolved');
		expect(db.noteHtml).toBe('<p>Бэкап снова проходит: <code>pg/orders</code></p>');
	});

	test('другие события (docker-cleanup, dokploy-restart, server-threshold) — ignored', () => {
		expect(parseDokployWebhook(dockerCleanup, messages('ru'))).toEqual({
			kind: 'ignored',
			type: 'docker-cleanup',
		});
		expect(parseDokployWebhook(dokployRestart, messages('ru'))).toEqual({
			kind: 'ignored',
			type: 'dokploy-restart',
		});
		expect(parseDokployWebhook(dokployBackup, messages('ru'))).toEqual({
			kind: 'ignored',
			type: 'dokploy-backup',
		});
		expect(parseDokployWebhook(serverThreshold, messages('ru'))).toEqual({
			kind: 'ignored',
			type: 'server-threshold',
		});
	});

	test('тело кнопки Test (title, message, timestamp без type) — ignored: test', async () => {
		const { body } = await fixture('dokploy-test.json');
		expect(Object.keys(body)).toEqual(['title', 'message', 'timestamp']);
		expect(parseDokployWebhook(body, messages('ru'))).toEqual({ kind: 'ignored', type: 'test' });
	});

	test('build с другим статусом — ignored', () => {
		expect(parseDokployWebhook(buildSuccess({ status: 'running' }), messages('ru'))).toEqual({
			kind: 'ignored',
			type: 'build',
		});
	});

	test('тело не от Dokploy — BadPayload', () => {
		expect(() => parseDokployWebhook('x', messages('ru'))).toThrow('body is not an object');
		expect(() => parseDokployWebhook(buildSuccess({ timestamp: '' }), messages('ru'))).toThrow(
			'without a valid timestamp',
		);
		expect(() => parseDokployWebhook([], messages('ru'))).toThrow(BadPayload);
		expect(() => parseDokployWebhook({ status: 'success' }, messages('ru'))).toThrow(
			'no event type',
		);
		expect(() =>
			parseDokployWebhook(buildSuccess({ applicationName: '' }), messages('ru')),
		).toThrow('without applicationName');
		expect(() => parseDokployWebhook(buildError({ applicationName: '' }), messages('ru'))).toThrow(
			BadPayload,
		);
		expect(() => parseDokployWebhook(buildSuccess({ timestamp: 'вчера' }), messages('ru'))).toThrow(
			'without a valid timestamp',
		);
		expect(() =>
			parseDokployWebhook(databaseBackup('error', { applicationName: '' }), messages('ru')),
		).toThrow(BadPayload);
		expect(() =>
			parseDokployWebhook(databaseBackup('error', { status: 'weird' }), messages('ru')),
		).toThrow(BadPayload);
	});
});

function deployedOrResolved(body: unknown) {
	const event = parseDokployWebhook(body, messages('ru'));
	if (event.kind !== 'resolved') throw new Error(`expected resolved, got ${event.kind}`);
	return event.resolve;
}

describe('recordDokployDeploy', () => {
	function world(configure: (gh: FakeGitHub) => void = () => undefined) {
		const gh = new FakeGitHub();
		gh.visibility('acme/api', 'private').branch('acme/api', 'main', SHA);
		configure(gh);
		const requested: string[] = [];
		const deps = {
			tenant: tenantOf({
				dokploy: [{ name: 'api', repo: 'acme/api', branch: 'main', environment: 'production' }],
			}),
			github: async (repo: string): Promise<GitHubApi | null> => {
				requested.push(repo);
				return gh;
			},
		};
		return { gh, deps, requested };
	}

	test('сопоставленное приложение — Deployment на голову ветки и статус success в его репозитории и окружении', async () => {
		const { gh, deps } = world();
		const result = await recordDokployDeploy(deps, deployed());
		expect(result).toEqual({ action: 'recorded', deploymentId: 1 });
		expect(gh.calls).toEqual([
			'repoVisibility acme/api',
			'branchHead acme/api main',
			`createDeployment acme/api production ${SHA}`,
			`createDeploymentStatus acme/api 1 success ${BUILD_LINK}`,
		]);
		const [record] = await gh.listDeployments('acme/api', 'production', 5);
		expect(record).toMatchObject({
			repo: 'acme/api',
			sha: SHA,
			environment: 'production',
			description: 'голова main в момент уведомления Dokploy',
		});
		expect(await gh.latestState('acme/api', 1)).toBe('success');
	});

	test('внутренний репозиторий (internal) тоже принимается', async () => {
		const { deps } = world((gh) => gh.visibility('acme/api', 'internal'));
		expect((await recordDokployDeploy(deps, deployed())).action).toBe('recorded');
	});

	test('без buildLink статус пишется без log_url', async () => {
		const { gh, deps } = world();
		await recordDokployDeploy(deps, deployed(buildSuccess({ buildLink: 'ftp://x' })));
		expect(gh.calls.at(-1)).toBe('createDeploymentStatus acme/api 1 success -');
	});

	test('описание Deployment не длиннее 140 знаков даже при длинной ветке', async () => {
		const branch = `feat/${'очень-длинная-ветка-'.repeat(12)}`;
		const gh = new FakeGitHub().visibility('acme/api', 'private').branch('acme/api', branch, SHA);
		const deps = {
			tenant: tenantOf({
				dokploy: [{ name: 'api', repo: 'acme/api', branch, environment: 'production' }],
			}),
			github: async () => gh,
		};
		await recordDokployDeploy(deps, deployed());
		const [record] = await gh.listDeployments('acme/api', 'production', 1);
		expect(Array.from(record?.description ?? '')).toHaveLength(140);
		expect(record?.description?.endsWith('…')).toBe(true);
	});

	test('несопоставленное — unmapped, GitHub не вызван', async () => {
		const { gh, deps, requested } = world();
		const result = await recordDokployDeploy(
			deps,
			deployed(buildSuccess({ applicationName: 'x' })),
		);
		expect(result).toEqual({ action: 'unmapped' });
		expect(requested).toEqual([]);
		expect(gh.calls).toEqual([]);
	});

	test('публичный репозиторий — public_repo, Deployment не создан', async () => {
		const { gh, deps } = world((fake) => fake.visibility('acme/api', 'public'));
		const result = await recordDokployDeploy(deps, deployed());
		expect(result).toEqual({ action: 'public_repo' });
		expect(gh.calls).toEqual(['repoVisibility acme/api']);
	});

	test('репозиторий не виден App (visibility null) — no_app, ничего не записано', async () => {
		const { gh, deps } = world((fake) => fake.visibility('acme/api', null));
		expect(await recordDokployDeploy(deps, deployed())).toEqual({ action: 'no_app' });
		expect(gh.calls).toEqual(['repoVisibility acme/api']);
	});

	test('App тенанта не стоит на репозитории — no_app', async () => {
		const { gh, deps } = world();
		const result = await recordDokployDeploy({ ...deps, github: async () => null }, deployed());
		expect(result).toEqual({ action: 'no_app' });
		expect(gh.calls).toEqual([]);
	});

	test('ветки нет — no_sha, Deployment не создан', async () => {
		const { gh, deps } = world((fake) => fake.branch('acme/api', 'main', null));
		const result = await recordDokployDeploy(deps, deployed());
		expect(result).toEqual({ action: 'no_sha' });
		expect(gh.calls).toEqual(['repoVisibility acme/api', 'branchHead acme/api main']);
	});
});

describe('Dokploy incidents by locale', () => {
	const CYRILLIC = /[Ѐ-ӿ]/;
	const en = messages('en');
	const signalOf = (body: unknown, m = en) => {
		const event = parseDokployWebhook(body, m);
		if (event.kind === 'failed') return event.signal;
		if (event.kind === 'resolved' || event.kind === 'deployed') return event.resolve;
		throw new Error(`unexpected ${event.kind}`);
	};

	test('Dokploy build failure in English', () => {
		const signal = signalOf(buildError());
		if (signal.status !== 'firing') throw new Error('expected firing');
		expect(signal.title).toBe('Build failed: api');
		expect(signal.bodyHtml).toContain(
			'<p>Application: <code>api</code>, project: <code>shop</code></p>',
		);
		expect(signal.bodyHtml).toContain('>Dokploy deploys</a>');
		expect(signal.noteHtml).toBe('<p>Build failed: <code>api</code></p>');
		expect(JSON.stringify(signal)).not.toMatch(CYRILLIC);
		expect(signalOf(buildSuccess()).noteHtml).toBe('<p>Build passes again: <code>api</code></p>');
		const without = signalOf(buildError({ projectName: '' }));
		if (without.status !== 'firing') throw new Error('expected firing');
		expect(without.bodyHtml).toContain('<p>Application: <code>api</code></p>');
	});

	test('Dokploy backup failure in English', () => {
		const db = signalOf(databaseBackup('error'));
		if (db.status !== 'firing') throw new Error('expected firing');
		expect(db.title).toBe('Backup failed: pg/orders');
		expect(db.bodyHtml).toContain('<p>Database: <code>pg/orders</code></p>');
		expect(db.noteHtml).toBe('<p>Backup failed: <code>pg/orders</code></p>');
		const volume = signalOf(volumeBackup('error'));
		if (volume.status !== 'firing') throw new Error('expected firing');
		expect(volume.bodyHtml).toContain('<p>Volume: <code>files/uploads</code></p>');
		expect(JSON.stringify([db, volume])).not.toMatch(CYRILLIC);
		expect(signalOf(databaseBackup('success')).noteHtml).toBe(
			'<p>Backup passes again: <code>pg/orders</code></p>',
		);
	});

	test('Dokploy signal identity does not depend on the locale', () => {
		for (const body of [
			buildError(),
			buildSuccess(),
			databaseBackup('error'),
			volumeBackup('success'),
		]) {
			const [a, b] = LOCALES.map((l) => signalOf(body, messages(l)));
			const pick = (s: typeof a) => ({
				status: s?.status,
				source: s?.source,
				key: s?.key,
				at: s?.at,
				...(s?.status === 'firing'
					? { occurrence: s.occurrence, priority: s.priority, label: s.label }
					: {}),
			});
			expect(pick(a)).toEqual(pick(b));
		}
	});

	test('the recorded deployment description follows the tenant locale', async () => {
		for (const [locale, description] of [
			['en', 'head of main when Dokploy notified'],
			['ru', 'голова main в момент уведомления Dokploy'],
		] as const) {
			const gh = new FakeGitHub().visibility('acme/api', 'private').branch('acme/api', 'main', SHA);
			const deps = {
				tenant: tenantOf({
					locale,
					dokploy: [{ name: 'api', repo: 'acme/api', branch: 'main', environment: 'production' }],
				}),
				github: async () => gh,
			};
			await recordDokployDeploy(deps, deployed());
			const [record] = await gh.listDeployments('acme/api', 'production', 1);
			expect(record?.description).toBe(description);
		}
	});
});
