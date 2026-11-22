/// <reference lib="dom" />
import { type Locale } from '@alxwlw/plane-kit/locale';

import { api } from './api.ts';
import { localeFrom } from './logic.ts';

/** The tenant's locale from the server; the default until it answers (or when it fails). */
export async function tenantLocale(): Promise<Locale> {
	return localeFrom(await api('/miro/api/locale'));
}
