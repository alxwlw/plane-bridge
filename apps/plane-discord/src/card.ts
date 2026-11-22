import { truncate } from '@alxwlw/plane-kit/html';

import type { Embed } from './discord/rest.ts';
import type { Messages } from './i18n.ts';

const TITLE_MAX = 256;
const FIELD_MAX = 1024;
const EMPTY = '—';

/** Embed field values must be non-empty and at most 1024 characters. */
const fieldValue = (text: string): string => truncate(text, FIELD_MAX) || EMPTY;

/** The public card of a work item (design §3 «Этап 2»). */
export function workItemCard(
	m: Messages,
	input: {
		key: string;
		url: string;
		name: string;
		stateName: string | null;
		/** Already rendered: `<@id>` for people in the user table, display names otherwise. */
		assignees: readonly string[];
		priority: string;
	},
): Embed {
	const names: Readonly<Record<string, string>> = {
		urgent: m.priorityUrgent,
		high: m.priorityHigh,
		medium: m.priorityMedium,
		low: m.priorityLow,
		none: EMPTY,
	};
	// Own-property lookup: a priority such as `constructor` must not reach Object.prototype.
	const priority = Object.hasOwn(names, input.priority)
		? (names[input.priority] as string)
		: input.priority;
	return {
		title: truncate(`${input.key} ${input.name}`, TITLE_MAX),
		url: input.url,
		fields: [
			{ name: m.stateField, value: fieldValue(input.stateName ?? EMPTY), inline: true },
			{ name: m.assigneesField, value: fieldValue(input.assignees.join(', ')), inline: true },
			{ name: m.priorityField, value: fieldValue(priority), inline: true },
		],
	};
}
