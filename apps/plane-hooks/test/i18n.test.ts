import { esc } from '@alxwlw/plane-kit/html';
import { LOCALES } from '@alxwlw/plane-kit/locale';
import { describe, expect, test } from 'bun:test';

import { en, type Messages, messages, ru } from '../src/i18n.ts';

test('both catalogs have the same keys', () => {
	expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
});
test('messages returns the catalog of the locale', () => {
	expect(messages('en')).toBe(en);
	expect(messages('ru')).toBe(ru);
});

test('setupIntroHtml escapes both of its values in both locales', () => {
	for (const locale of ['en', 'ru'] as const) {
		const html = messages(locale).setupIntroHtml('a<b&"c', 'd<e&"f');
		expect(html).toContain('a&lt;b&amp;&quot;c');
		expect(html).toContain('d&lt;e&amp;&quot;f');
		expect(html).not.toContain('<b');
		expect(html).not.toContain('<e');
	}
});

// Every `*Html` entry of the catalog: how to call it, with `p()` handing out the next hostile plain-text
// value and `H` standing for built HTML that must reach the output as it is.
const H = '<i>built</i>';
type Plain = () => string;
const TABLE: Record<string, { call: (m: Messages, p: Plain) => string; html: readonly string[] }> =
	{
		transitionPrHtml: { call: (m, p) => m.transitionPrHtml(p(), H), html: [H] },
		transitionDeployHtml: { call: (m, p) => m.transitionDeployHtml(p(), p(), p()), html: [] },
		previewHtml: { call: (m, p) => m.previewHtml(p(), H), html: [H] },
		previewBranchHtml: { call: (m, p) => m.previewBranchHtml(p()), html: [] },
		deployPassesAgainHtml: { call: (m, p) => m.deployPassesAgainHtml(p()), html: [] },
		deployRepoHtml: { call: (m, p) => m.deployRepoHtml(p(), p()), html: [] },
		commitHtml: { call: (m) => m.commitHtml(H), html: [H] },
		vercelProjectHtml: { call: (m, p) => m.vercelProjectHtml(p(), p(), p()), html: [] },
		buildPassesAgainHtml: { call: (m, p) => m.buildPassesAgainHtml(p()), html: [] },
		buildAppHtml: { call: (m, p) => m.buildAppHtml(p(), p()), html: [] },
		backupPassesAgainHtml: { call: (m, p) => m.backupPassesAgainHtml(p()), html: [] },
		backupTargetHtml: { call: (m, p) => m.backupTargetHtml(true, p()), html: [] },
		setupIntroHtml: { call: (m, p) => m.setupIntroHtml(p(), p()), html: [] },
	};

test('every Html entry of the catalog has a row in the escape table', () => {
	expect(
		Object.keys(en)
			.filter((k) => k.endsWith('Html'))
			.sort(),
	).toEqual(Object.keys(TABLE).sort());
});

describe('every Html entry escapes each plain-text argument and keeps each built-HTML one', () => {
	for (const locale of LOCALES) {
		for (const [key, row] of Object.entries(TABLE)) {
			test(`${locale}: ${key}`, () => {
				const given: string[] = [];
				// Distinct hostile values (a<b&"c1, a<b&"c2, …) so a swapped or dropped argument shows.
				const out = row.call(messages(locale), () => {
					const v = `a<b&"c${given.length + 1}`;
					given.push(v);
					return v;
				});
				for (const v of given) {
					expect(out).toContain(esc(v));
					expect(out).not.toContain(v);
				}
				for (const h of row.html) expect(out).toContain(h);
			});
		}
	}
});

// Plain-text replies of the setup flow are not HTML, so their `<id>` and `&` stay as they are.
const PLAIN_TEXT_REPLIES = [
	'setupParamsMissing',
	'setupLinkExpired',
	'setupNoCode',
	'setupCodeExpired',
	'setupGatewayFailed',
] as const satisfies readonly (keyof Messages)[];

test('plain catalog strings that go into HTML need no escaping, in both locales', () => {
	for (const locale of LOCALES) {
		const entries = Object.entries(messages(locale)).filter(
			(e): e is [string, string] =>
				typeof e[1] === 'string' && !(PLAIN_TEXT_REPLIES as readonly string[]).includes(e[0]),
		);
		expect(entries.length).toBeGreaterThan(10);
		for (const [key, v] of entries) expect([locale, key, esc(v)]).toEqual([locale, key, v]);
	}
});

test('the English plain strings, pinned literally', () => {
	const plain = Object.fromEntries(Object.entries(en).filter(([, v]) => typeof v === 'string'));
	expect(plain).toEqual({
		deployed: 'Deployed',
		rolledBack: 'Rolled back',
		run: 'run',
		commits: 'Commits',
		noNewCommits: 'No new commits: a redeploy of the same sha.',
		workItems: 'Work items',
		deployFailed: 'Deploy failed',
		deployLog: 'Deploy log',
		vercelInspector: 'Vercel inspector',
		buildFailed: 'Build failed',
		dokployDeploys: 'Dokploy deploys',
		backupFailed: 'Backup failed',
		labelsLead: 'Labels:',
		alertRule: 'Rule',
		alertDashboard: 'Dashboard',
		alertPanel: 'Panel',
		alertSilence: 'Silence',
		setupButton: 'Create GitHub App',
		setupParamsMissing:
			'The owner parameter (a GitHub organization or account) and kind=org|user are required: /github/setup?tenant=<id>&owner=<login>&kind=org\n',
		setupLinkExpired: 'The link has expired or is not ours. Start over from the setup page.\n',
		setupNoCode: 'The address has no GitHub code. Start over.\n',
		setupCodeExpired: 'GitHub does not know this code: it has expired, start over.\n',
		setupGatewayFailed:
			'GitHub did not return the App data. Start over: the setup page will give a new link.\n',
	});
});
