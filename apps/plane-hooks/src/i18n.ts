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
	// Incidents: deploy failures (GitHub, Vercel).
	deployFailed: 'Deploy failed',
	deployPassesAgainHtml: (ref: string) => `Deploy passes again: <code>${esc(ref)}</code>`,
	deployLog: 'Deploy log',
	deployRepoHtml: (repo: string, environment: string) =>
		`Repository: <code>${esc(repo)}</code>, environment: <code>${esc(environment)}</code>`,
	commitHtml: (valueHtml: string) => `Commit: ${valueHtml}`,
	vercelInspector: 'Vercel inspector',
	vercelProjectHtml: (name: string, target: string, branch: string) =>
		`Project: <code>${esc(name)}</code>, environment: <code>${esc(target)}</code>, branch: <code>${esc(branch)}</code>`,
	vercelFailedSummary: (name: string, target: string, label: string) =>
		`✗ ${name} → ${target} failed · ${label}`,
	// Incidents: Dokploy.
	buildFailed: 'Build failed',
	buildPassesAgainHtml: (app: string) => `Build passes again: <code>${esc(app)}</code>`,
	dokployDeploys: 'Dokploy deploys',
	buildAppHtml: (app: string, project: string | null) =>
		`Application: <code>${esc(app)}</code>${project ? `, project: <code>${esc(project)}</code>` : ''}`,
	backupFailed: 'Backup failed',
	backupPassesAgainHtml: (name: string) => `Backup passes again: <code>${esc(name)}</code>`,
	backupTargetHtml: (volume: boolean, name: string) =>
		`${volume ? 'Volume' : 'Database'}: <code>${esc(name)}</code>`,
	// Description of the GitHub Deployment recorded for a Dokploy deploy (plain text, 140 characters at most).
	dokployDeployDescription: (branch: string) => `head of ${branch} when Dokploy notified`,
	// Incidents: Grafana alerts and their dashboard annotations.
	alertFiredAt: (at: string) => `Firing ${at} UTC`,
	alertResolvedAt: (at: string) => `Resolved ${at} UTC`,
	labelsLead: 'Labels:',
	alertRule: 'Rule',
	alertDashboard: 'Dashboard',
	alertPanel: 'Panel',
	alertSilence: 'Silence',
	annotationFiring: (title: string) => `Firing: ${title}`,
	annotationResolved: (title: string) => `Resolved: ${title}`,
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
	deployFailed: 'Деплой упал',
	deployPassesAgainHtml: (ref) => `Деплой снова проходит: <code>${esc(ref)}</code>`,
	deployLog: 'Лог деплоя',
	deployRepoHtml: (repo, environment) =>
		`Репозиторий: <code>${esc(repo)}</code>, окружение: <code>${esc(environment)}</code>`,
	commitHtml: (valueHtml) => `Коммит: ${valueHtml}`,
	vercelInspector: 'Инспектор Vercel',
	vercelProjectHtml: (name, target, branch) =>
		`Проект: <code>${esc(name)}</code>, окружение: <code>${esc(target)}</code>, ветка: <code>${esc(branch)}</code>`,
	vercelFailedSummary: (name, target, label) => `✗ ${name} → ${target} упал · ${label}`,
	buildFailed: 'Сборка упала',
	buildPassesAgainHtml: (app) => `Сборка снова проходит: <code>${esc(app)}</code>`,
	dokployDeploys: 'Деплои в Dokploy',
	buildAppHtml: (app, project) =>
		`Приложение: <code>${esc(app)}</code>${project ? `, проект: <code>${esc(project)}</code>` : ''}`,
	backupFailed: 'Бэкап упал',
	backupPassesAgainHtml: (name) => `Бэкап снова проходит: <code>${esc(name)}</code>`,
	backupTargetHtml: (volume, name) => `${volume ? 'Том' : 'База'}: <code>${esc(name)}</code>`,
	dokployDeployDescription: (branch) => `голова ${branch} в момент уведомления Dokploy`,
	alertFiredAt: (at) => `Сработал ${at} UTC`,
	alertResolvedAt: (at) => `Погас ${at} UTC`,
	labelsLead: 'Метки:',
	alertRule: 'Правило',
	alertDashboard: 'Дашборд',
	alertPanel: 'Панель',
	alertSilence: 'Заглушить',
	annotationFiring: (title) => `Сработал: ${title}`,
	annotationResolved: (title) => `Погас: ${title}`,
};

export function messages(locale: Locale): Messages {
	return locale === 'en' ? en : ru;
}
