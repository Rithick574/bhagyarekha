import { z } from 'zod';

export const UuidSchema = z.uuid();

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Returns true when `YYYY-MM-DD` names a real calendar date (proleptic Gregorian). */
export function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map((part) => Number.parseInt(part, 10)) as [number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

/**
 * A local calendar date as a validated string. Never parsed as a UTC instant by
 * consumers; the UI formats it as a date in Asia/Kolkata.
 */
export const LocalDateSchema = z
  .string()
  .regex(LOCAL_DATE_PATTERN, { message: 'Expected YYYY-MM-DD' })
  .refine(isValidLocalDate, { message: 'Not a valid calendar date' });
export type LocalDate = z.infer<typeof LocalDateSchema>;

/** ISO 8601 instant in UTC, e.g. 2026-09-24T10:00:00.000Z */
export const InstantSchema = z.iso.datetime({ offset: false });
export type Instant = z.infer<typeof InstantSchema>;

export const LocalizedTextSchema = z.object({
  en: z.string().min(1),
  ml: z.string().min(1),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/** Integer minor units (paise) serialised as a decimal string. */
export const MinorAmountSchema = z.string().regex(/^\d{1,18}$/);
export type MinorAmount = z.infer<typeof MinorAmountSchema>;

export const CurrencySchema = z.literal('INR');

export const PageSchema = z.coerce.number().int().min(1).max(100_000).default(1);
export const PageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

/** Ticket numbers and suffixes are ASCII digit strings; leading zeros are significant. */
export const DigitStringSchema = z.string().regex(/^[0-9]{1,12}$/);
/** Broad series syntax accepted by the database. Rule-specific membership is checked elsewhere. */
export const SeriesSchema = z.string().regex(/^[A-Z]{0,8}$/);
export const CategoryCodeSchema = z.string().regex(/^[A-Z0-9_]{1,32}$/);
