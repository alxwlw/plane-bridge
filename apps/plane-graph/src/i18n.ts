import { type Catalog, type Locale } from '@alxwlw/plane-kit/locale';

/** `1 relation`, `2 relations`: the English count sentences. */
function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

/** The English catalog: the keys and shapes every locale must have. */
export const en = {
	// The title of the graph page and the first text of the bar.
	title: 'Work item graph',
	dataAsOf: (time: string) => `data as of ${time}`,
	allProjects: 'All projects',
	allAreas: 'All areas',
	showClosed: 'Show closed',
	fit: 'Fit',
	cycle: 'Cycle in “blocks”, the order is undefined:',
	canStart: 'Can start now',
	noArea: 'no area',
	notParallel: 'not in parallel',
	offline: 'No connection to plane-graph',
	offlineSince: (time: string) => `No connection to plane-graph, data as of ${time}`,
	d3Failed: 'The graph library did not load (cdnjs)',
	noMatches: 'No work items match the selected filters',
	canStartColumn: 'CAN START NOW',
	waveColumn: (wave: number) => `WAVE ${wave}`,
	tooltip: (key: string, name: string, closed: boolean) =>
		`${key} · ${name}${closed ? ' (closed)' : ''}`,
	hintMouse: 'Ctrl/⌘+click or middle mouse button — open in a new tab',
	hintTouch: 'long press — open in a new tab',
	agentNotRun: 'the agent has not run yet',
	agentRun: (time: string, relations: number, labels: number) =>
		`agent: ${time}, +${plural(relations, 'relation', 'relations')}, +${plural(labels, 'label', 'labels')}`,
	hiddenOpen: (count: number) =>
		`${plural(count, 'more open work item', 'more open work items')} without relations`,
};

export type Messages = Catalog<typeof en>;

export const ru: Messages = {
	title: 'Граф задач',
	dataAsOf: (time) => `данные на ${time}`,
	allProjects: 'Все проекты',
	allAreas: 'Все области',
	showClosed: 'Показать закрытые',
	fit: 'Вписать',
	cycle: 'Цикл в «блокирует», порядок не определён:',
	canStart: 'Можно сейчас',
	noArea: 'без области',
	notParallel: 'не параллельно',
	offline: 'Нет связи с plane-graph',
	offlineSince: (time) => `Нет связи с plane-graph, данные на ${time}`,
	d3Failed: 'Не загрузилась библиотека графа (cdnjs)',
	noMatches: 'Нет задач под выбранные фильтры',
	canStartColumn: 'МОЖНО СЕЙЧАС',
	waveColumn: (wave) => `ВОЛНА ${wave}`,
	tooltip: (key, name, closed) => `${key} · ${name}${closed ? ' (закрыта)' : ''}`,
	hintMouse: 'Ctrl/⌘+клик или колёсико мыши — открыть в новой вкладке',
	hintTouch: 'долгое нажатие — открыть в новой вкладке',
	agentNotRun: 'агент ещё не работал',
	agentRun: (time, relations, labels) => `агент: ${time}, +${relations} связей, +${labels} меток`,
	hiddenOpen: (count) => `ещё ${count} открытых задач без связей`,
};

const CATALOGS: Record<Locale, Messages> = { en, ru };

export function messages(locale: Locale): Messages {
	return CATALOGS[locale];
}
