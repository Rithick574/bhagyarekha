import type { Locale } from '@/i18n';

/**
 * Pure helpers shared by the History and Statistics pages: URL parameter
 * validation, IST calendar arithmetic and descriptive share formatting.
 * Nothing here touches the network, the DOM or ticket numbers.
 */

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DRAW_CODE_PATTERN = /^[A-Za-z0-9_.-]{1,32}$/;
export const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Maximum inclusive span (in days) the API accepts for history search and statistics. */
export const MAX_RANGE_DAYS = 366;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

const INTL_LOCALE: Record<Locale, string> = { en: 'en-IN', ml: 'ml-IN' };

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** True for a `YYYY-MM-DD` string that names a real calendar date (no UTC parsing involved). */
export function isLocalDate(value: string | undefined): value is string {
  if (!value) return false;
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export function parseUuidParam(value: string | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value.toLowerCase() : undefined;
}

export function parseLocalDateParam(value: string | undefined): string | undefined {
  return isLocalDate(value) ? value : undefined;
}

export function parseDrawCodeParam(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && DRAW_CODE_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function parsePageParam(value: string | undefined): number {
  if (!value || !/^\d{1,6}$/.test(value)) return 1;
  const page = Number.parseInt(value, 10);
  return page >= 1 ? page : 1;
}

/** Calendar arithmetic on `YYYY-MM-DD` strings; the UTC epoch is only a counting device. */
function dateToDays(localDate: string): number {
  const match = LOCAL_DATE_PATTERN.exec(localDate);
  if (!match) throw new Error('not a local date');
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS);
}

function daysToDate(days: number): string {
  const d = new Date(days * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(localDate: string, delta: number): string {
  return daysToDate(dateToDays(localDate) + delta);
}

/** Inclusive number of days from `from` to `to`; negative when `from` is after `to`. */
export function inclusiveSpanDays(from: string, to: string): number {
  return dateToDays(to) - dateToDays(from) + 1;
}

/** Today's calendar date in Asia/Kolkata (fixed +05:30, no DST). */
export function istToday(now: Date = new Date()): string {
  return daysToDate(Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS));
}

/** The default statistics window: the 366 inclusive days ending on `today`. */
export function defaultStatisticsWindow(today: string = istToday()): { from: string; to: string } {
  return { from: addDays(today, -(MAX_RANGE_DAYS - 1)), to: today };
}

export type RangeProblem = 'FROM_AFTER_TO' | 'RANGE_TOO_LONG';

/** Validates an optional inclusive range against the API rules without contacting the API. */
export function rangeProblem(from: string | undefined, to: string | undefined): RangeProblem | null {
  if (!from || !to) return null;
  const span = inclusiveSpanDays(from, to);
  if (span < 1) return 'FROM_AFTER_TO';
  if (span > MAX_RANGE_DAYS) return 'RANGE_TOO_LONG';
  return null;
}

/** Formats a share in [0, 1] as a percentage with one decimal; null (no observations) renders as an em dash. */
export function formatShare(share: number | null | undefined, locale: Locale): string {
  if (share === null || share === undefined || !Number.isFinite(share)) return '—';
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(share);
}

export function formatCount(count: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 }).format(count);
}

/** Mean digit sum etc.: one decimal, null renders as an em dash. */
export function formatDecimal(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(INTL_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/** Bar height as a percentage of the largest value; 0 when nothing to compare. */
export function barPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}

/** Builds a shareable query string from filter values, skipping empty ones. Never receives a ticket number. */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
