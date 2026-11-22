import { esc, link, p } from '@alxwlw/plane-kit/html';

import type { Pull } from '../github/client.ts';
import type { Messages } from '../i18n.ts';
import type { DeployFact } from './deploy.ts';

/** `<repo> → <environment> · <sha7>` in code tags, then the run link when the deploy has one. */
function head(m: Messages, label: string, fact: DeployFact): string[] {
	const parts = [
		`${label}: <code>${esc(fact.repo)}</code> → ${esc(fact.environment)}`,
		`<code>${esc(fact.sha.slice(0, 7))}</code>`,
	];
	const run = fact.logUrl === null ? null : link(fact.logUrl, m.run);
	if (run !== null) parts.push(run);
	return parts;
}

/** The "Deployed" note on a work item: where, which commit, and the PRs of this task that were in the deploy. */
export function deployedHtml(m: Messages, fact: DeployFact, pulls: readonly Pull[]): string {
	const parts = head(m, m.deployed, fact);
	// A commit without a PR (number 0) has nothing to link: the sha above already names it.
	const prs = pulls
		.filter((pull) => pull.number > 0)
		.map((pull) => link(pull.url, `${pull.repo}#${pull.number}`))
		.filter((html) => html !== null);
	if (prs.length > 0) parts.push(`PR: ${prs.join(', ')}`);
	return p(parts.join(' · '));
}

/** The "Rolled back" note on a work item whose PR left the environment: the environment now stands at `fact.sha`. */
export function rolledBackHtml(m: Messages, fact: DeployFact): string {
	return p(head(m, m.rolledBack, fact).join(' · '));
}
