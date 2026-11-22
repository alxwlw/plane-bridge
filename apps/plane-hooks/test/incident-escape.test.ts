import { LOCALES } from '@alxwlw/plane-kit/locale';
import { describe, expect, test } from 'bun:test';

import { messages } from '../src/i18n.ts';

const HOSTILE = 'a<b&"c';
const ESCAPED = 'a&lt;b&amp;&quot;c';

describe('incident entries escape every interpolated value the same way in both languages', () => {
	for (const locale of LOCALES) {
		const m = messages(locale);
		const clean = 'x';

		test(`${locale}: passes-again notes`, () => {
			expect(m.deployPassesAgainHtml(HOSTILE)).toContain(`<code>${ESCAPED}</code>`);
			expect(m.buildPassesAgainHtml(HOSTILE)).toContain(`<code>${ESCAPED}</code>`);
			expect(m.backupPassesAgainHtml(HOSTILE)).toContain(`<code>${ESCAPED}</code>`);
		});

		test(`${locale}: GitHub repository and environment`, () => {
			expect(m.deployRepoHtml(HOSTILE, clean)).toContain(`<code>${ESCAPED}</code>`);
			expect(m.deployRepoHtml(clean, HOSTILE)).toContain(`<code>${ESCAPED}</code>`);
			expect(m.deployRepoHtml(HOSTILE, HOSTILE)).not.toContain(HOSTILE);
		});

		test(`${locale}: Vercel project, environment and branch`, () => {
			for (const html of [
				m.vercelProjectHtml(HOSTILE, clean, clean),
				m.vercelProjectHtml(clean, HOSTILE, clean),
				m.vercelProjectHtml(clean, clean, HOSTILE),
			]) {
				expect(html).toContain(`<code>${ESCAPED}</code>`);
				expect(html).not.toContain(HOSTILE);
			}
		});

		test(`${locale}: Dokploy application, project and backup name`, () => {
			expect(m.buildAppHtml(HOSTILE, clean)).toContain(`<code>${ESCAPED}</code>`);
			expect(m.buildAppHtml(clean, HOSTILE)).toContain(`<code>${ESCAPED}</code>`);
			expect(m.buildAppHtml(clean, null)).not.toContain('<code>x</code>, ');
			for (const volume of [true, false]) {
				expect(m.backupTargetHtml(volume, HOSTILE)).toContain(`<code>${ESCAPED}</code>`);
			}
		});
	}
});
