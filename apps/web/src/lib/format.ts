import type { Locale } from '@/i18n';

const INTL_LOCALE: Record<Locale, string> = { en: 'en-IN', ml: 'ml-IN' };
export const DISPLAY_TIME_ZONE = 'Asia/Kolkata';

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Formats a `YYYY-MM-DD` local date as an explicit long date, e.g. "24 September 2026".
 * The string is never parsed as a UTC instant: the parts are taken literally.
 */
export function formatLocalDate(localDate: string, locale: Locale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return localDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (locale === 'en') {
    return `${day} ${EN_MONTHS[month - 1] ?? match[2]} ${year}`;
  }
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utcDate);
}

/** Short form for tight table cells, e.g. "24 Sep 2026". */
export function formatLocalDateShort(localDate: string, locale: Locale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return localDate;
  const utcDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(utcDate);
}

/** Formats an ISO instant in Asia/Kolkata with explicit date and time, e.g. "24 September 2026, 3:05 pm IST". */
export function formatInstant(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
  return `${formatted} IST`;
}

/** Formats integer minor units (paise, as a decimal string) as Indian rupees. Never uses floating arithmetic on the string. */
export function formatMinorAmount(amountMinor: string, locale: Locale): string {
  if (!/^\d+$/.test(amountMinor)) return amountMinor;
  const padded = amountMinor.padStart(3, '0');
  const rupees = padded.slice(0, -2);
  const paise = padded.slice(-2);
  const rupeesFormatted = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 }).format(BigInt(rupees));
  return paise === '00' ? `₹${rupeesFormatted}` : `₹${rupeesFormatted}.${paise}`;
}

/** Renders a ticket as printed: series, space, number. Strings only; leading zeros untouched. */
export function formatTicket(series: string, number: string): string {
  return series ? `${series} ${number}` : number;
}

/** Splits digits into readable groups for screen readers: "001234" → "0 0 1 2 3 4". */
export function spokenDigits(number: string): string {
  return number.split('').join(' ');
}
