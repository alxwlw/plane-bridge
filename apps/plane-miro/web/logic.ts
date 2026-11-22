// Pure front-end logic: no DOM; the only import from src/ is the catalog (it holds no server code).
import { DEFAULT_LOCALE, isLocale, type Locale } from '@alxwlw/plane-kit/locale';

import { type Messages } from '../src/i18n.ts';

/** Item types that carry text a work item can be made of; a test pins it to src/convert.ts. */
export const CONVERTIBLE: readonly string[] = ['sticky_note', 'card', 'shape', 'text'];
/**
 * Ids per POST /miro/api/convert. The backend converts synchronously under Plane's request limit, so a
 * 50-item request can run for minutes: the panel sends short batches one after another instead.
 */
export const BATCH_SIZE = 10;

export type Item = { id: string; type: string };
export type Outcome = { ok: true; key: string } | { ok: false; error: string };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** An API error code → the catalog key of its text. */
const ERROR_KEYS: Readonly<Record<string, keyof Messages>> = {
	unauthorized: 'errorUnauthorized',
	unknown_team: 'errorUnknownTeam',
	board_no_access: 'errorBoardNoAccess',
	miro_not_connected: 'errorMiroNotConnected',
	unknown_project: 'errorUnknownProject',
	unknown_card: 'errorUnknownCard',
	plane_failed: 'errorPlaneFailed',
	miro_failed: 'errorMiroFailed',
	not_found: 'errorNotFound',
	unsupported_type: 'errorUnsupportedType',
	empty_text: 'errorEmptyText',
	already_linked: 'errorAlreadyLinked',
};

/**
 * One API call's outcome, never a throw: a rejected `send` is `network`; an error status carries the body's
 * `error` code, or `unknown` when the body is not JSON or has none; a 2xx without a JSON body is `unknown` too.
 */
export async function apiResult<T>(send: () => Promise<Response>): Promise<ApiResult<T>> {
	let res: Response;
	try {
		res = await send();
	} catch {
		return { ok: false, error: 'network' };
	}
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		// A body that is not JSON carries no code.
	}
	if (!res.ok) {
		const code = (body as { error?: unknown } | null | undefined)?.error;
		return { ok: false, error: typeof code === 'string' ? code : 'unknown' };
	}
	return body === undefined ? { ok: false, error: 'unknown' } : { ok: true, data: body as T };
}

export function convertibleIds(items: readonly Item[]): string[] {
	return items.filter((item) => CONVERTIBLE.includes(item.type)).map((item) => item.id);
}

/** The one item a work item can be bound to: exactly one convertible entry in the selection. */
export function bindableId(items: readonly Item[]): string | null {
	const ids = convertibleIds(items);
	return ids.length === 1 ? (ids[0] ?? null) : null;
}

export function errorText(m: Messages, code: string): string {
	if (!Object.hasOwn(ERROR_KEYS, code)) return m.errorFallback;
	const key = ERROR_KEYS[code];
	const text = key === undefined ? undefined : m[key];
	return typeof text === 'string' ? text : m.errorFallback;
}

/** The tenant's locale from a `/miro/api/locale` answer; anything else is the default. */
export function localeFrom(result: ApiResult<unknown>): Locale {
	if (!result.ok) return DEFAULT_LOCALE;
	const locale = (result.data as { locale?: unknown } | null)?.locale;
	return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** `Done: <keys>.` and/or `Failed: <n> — <distinct reasons>.` (the tenant's language), joined by a space. */
export function summary(m: Messages, results: readonly Outcome[]): string {
	const keys: string[] = [];
	const reasons = new Set<string>();
	let failed = 0;
	for (const result of results) {
		if (result.ok) {
			keys.push(result.key);
		} else {
			failed += 1;
			reasons.add(errorText(m, result.error).replace(/\.$/, ''));
		}
	}
	const parts: string[] = [];
	if (keys.length > 0) parts.push(m.done(keys.join(', ')));
	if (failed > 0) parts.push(m.failed(failed, [...reasons].join(', ')));
	return parts.join(' ');
}

export function chunk<T>(list: readonly T[], size: number): T[][] {
	const parts: T[][] = [];
	for (let at = 0; at < list.length; at += size) parts.push(list.slice(at, at + size));
	return parts;
}

/**
 * One batch's outcomes: the backend's results, or — when the request failed or answered without `results` —
 * an error for every item of the batch.
 */
export function mergeBatch(
	ids: readonly string[],
	response: ApiResult<{ results: readonly Outcome[] }>,
): Outcome[] {
	if (response.ok) {
		const results = (response.data as { results?: unknown } | null)?.results;
		if (Array.isArray(results)) return [...(results as Outcome[])];
		return ids.map(() => ({ ok: false, error: 'unknown' }));
	}
	return ids.map(() => ({ ok: false, error: response.error }));
}

/** Sends the ids in sequential batches of BATCH_SIZE; a failed batch never stops the next one. */
export async function convertInBatches(
	ids: readonly string[],
	send: (batch: string[]) => Promise<ApiResult<{ results: readonly Outcome[] }>>,
	onProgress?: (done: number, total: number) => void,
): Promise<Outcome[]> {
	const outcomes: Outcome[] = [];
	for (const batch of chunk(ids, BATCH_SIZE)) {
		onProgress?.(outcomes.length, ids.length);
		outcomes.push(...mergeBatch(batch, await send(batch)));
	}
	return outcomes;
}

/** The selection a `selection:update` stored wins over the one read at start-up while a request was in flight. */
export function currentSelection(
	updated: readonly Item[] | null,
	initial: readonly Item[],
): Item[] {
	return [...(updated ?? initial)];
}
