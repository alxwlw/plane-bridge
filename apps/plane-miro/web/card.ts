/// <reference lib="dom" />
import { DEFAULT_LOCALE } from '@alxwlw/plane-kit/locale';

import { messages } from '../src/i18n.ts';
import { api } from './api.ts';
import { applyTexts } from './apply-texts.ts';
import { errorText } from './logic.ts';
import { tenantLocale } from './texts.ts';

type Card = { key: string; name: string; state: string; assignees: string[]; url: string };

const view = document.getElementById('view') as HTMLElement;
view.textContent = messages(DEFAULT_LOCALE).loading;

function row(label: string, value: string): HTMLElement {
	const el = document.createElement('p');
	const name = document.createElement('span');
	name.className = 'label';
	name.textContent = `${label}: `;
	el.append(name, value);
	return el;
}

const params = new URLSearchParams(location.search);
const [locale, res] = await Promise.all([
	tenantLocale(),
	api<Card>(
		`/miro/api/card?${new URLSearchParams({ board: params.get('board') ?? '', item: params.get('item') ?? '' }).toString()}`,
	),
]);
const m = messages(locale);
applyTexts(document, m, locale);
if (res.ok) {
	const { key, name, state, assignees, url } = res.data;
	const title = document.createElement('h1');
	title.textContent = `${key} ${name}`;
	const open = document.createElement('a');
	open.href = url;
	open.target = '_blank';
	open.rel = 'noopener';
	open.textContent = m.openInPlane;
	view.replaceChildren(
		title,
		row(m.stateField, state),
		row(m.assigneesField, assignees.length > 0 ? assignees.join(', ') : '—'),
		open,
	);
} else {
	view.textContent = errorText(m, res.error);
	view.className = 'error';
}
