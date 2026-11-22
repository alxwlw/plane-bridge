import { esc } from '@alxwlw/plane-kit/html';
import { type Catalog, type Locale } from '@alxwlw/plane-kit/locale';

/** The English catalog: the keys and shapes every locale must have. Texts move in from the modules that send them. */
export const en = {
	// Delivery notes on a work item.
	deployed: 'Deployed',
	rolledBack: 'Rolled back',
	run: 'run',
	// State-transition comment: the inner HTML of its paragraph. `stateName` is plain text, the rest is built HTML.
	transitionPrHtml: (stateName: string, pullHtml: string) =>
		`Status → <b>${esc(stateName)}</b>: ${pullHtml}`,
	transitionDeployHtml: (stateName: string, sha7: string, environment: string) =>
		`Status → <b>${esc(stateName)}</b>: deploy <code>${esc(sha7)}</code> to <code>${esc(environment)}</code>`,
	// Preview comment.
	previewHtml: (project: string, urlHtml: string) =>
		`Preview <code>${esc(project)}</code>: ${urlHtml}`,
	previewBranchHtml: (branch: string) => `branch <code>${esc(branch)}</code>`,
	// Release changelog headings.
	commits: 'Commits',
	noNewCommits: 'No new commits: a redeploy of the same sha.',
	workItems: 'Work items',
};

export type Messages = Catalog<typeof en>;

export const ru: Messages = {
	deployed: 'Выкачено',
	rolledBack: 'Откачено',
	run: 'прогон',
	transitionPrHtml: (stateName, pullHtml) => `Статус → <b>${esc(stateName)}</b>: ${pullHtml}`,
	transitionDeployHtml: (stateName, sha7, environment) =>
		`Статус → <b>${esc(stateName)}</b>: деплой <code>${esc(sha7)}</code> в <code>${esc(environment)}</code>`,
	previewHtml: (project, urlHtml) => `Превью <code>${esc(project)}</code>: ${urlHtml}`,
	previewBranchHtml: (branch) => `ветка <code>${esc(branch)}</code>`,
	commits: 'Коммиты',
	noNewCommits: 'Новых коммитов нет: повторный деплой того же sha.',
	workItems: 'Задачи',
};

export function messages(locale: Locale): Messages {
	return locale === 'en' ? en : ru;
}
