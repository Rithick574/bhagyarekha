import { en } from './messages/en';
import type { Messages } from './messages/en';
import { ml } from './messages/ml';

export type { Messages };
export const LOCALES = ['en', 'ml'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'br_locale';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'en' || value === 'ml';
}

export function getMessages(locale: Locale): Messages {
  return locale === 'ml' ? ml : en;
}

/** Interpolates {placeholders}. Unknown placeholders are left in place so they are visible in review. */
export function t(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = params[key];
    return value === undefined ? whole : String(value);
  });
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'ml' : 'en';
}

/** Swap the locale segment of a pathname such as /en/results/abc → /ml/results/abc. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const parts = pathname.split('/');
  if (parts.length > 1 && isLocale(parts[1])) {
    parts[1] = target;
    return parts.join('/') || `/${target}`;
  }
  return `/${target}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

/** Flattens nested message objects to dotted keys; used by tests and review tooling. */
export function flattenMessages(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value && typeof value === 'object') Object.assign(out, flattenMessages(value as Record<string, unknown>, path));
  }
  return out;
}
