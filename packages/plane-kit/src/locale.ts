/** The languages the Plane apps speak in the texts they send. */
export type Locale = 'en' | 'ru';
export const LOCALES: readonly Locale[] = ['en', 'ru'];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * A catalog with the keys of `T`: a string where `T` has a string, a function with the same
 * parameters returning a string where `T` has a function. Another locale's catalog typed
 * `Catalog<typeof en>` fails to compile on a missing or an extra key.
 */
export type Catalog<T> = {
	[K in keyof T]: T[K] extends (...args: infer A) => string ? (...args: A) => string : string;
};
