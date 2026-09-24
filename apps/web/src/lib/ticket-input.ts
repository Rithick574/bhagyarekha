import type { TicketFieldErrorCode } from '@bhagyarekha/contracts';

export interface TicketInput {
  series: string;
  number: string;
}

/** Form hint from the draw detail; null when the rule is unknown to the client. */
export interface TicketFormatHint {
  numberLength: number;
  allowedSeries: string[];
}

export type TicketFieldPath = 'series' | 'number';
export interface TicketFieldError {
  path: TicketFieldPath;
  code: TicketFieldErrorCode;
}

const MAX_SERIES = 8;
const MAX_NUMBER = 12;

/**
 * The only normalisation ever applied: outer whitespace is trimmed and the
 * series is upper-cased. Nothing is stripped, padded or truncated (INV-02).
 */
export function normalizeTicketInput(input: TicketInput): TicketInput {
  return { series: input.series.trim().toUpperCase(), number: input.number.trim() };
}

/**
 * Client-side mirror of the server rules so users get instant, specific
 * feedback. The server re-validates against the checked revision's rule; this
 * function is a convenience, never an authority.
 */
export function validateTicketInput(input: TicketInput, format: TicketFormatHint | null): { ok: true; value: TicketInput } | { ok: false; errors: TicketFieldError[] } {
  const value = normalizeTicketInput(input);
  const errors: TicketFieldError[] = [];

  if (format && format.allowedSeries.length > 0) {
    if (value.series === '') errors.push({ path: 'series', code: 'SERIES_REQUIRED' });
    else if (!format.allowedSeries.includes(value.series)) errors.push({ path: 'series', code: 'SERIES_NOT_ALLOWED' });
  } else if (format && format.allowedSeries.length === 0) {
    if (value.series !== '') errors.push({ path: 'series', code: 'SERIES_NOT_ALLOWED' });
  } else if (value.series.length > MAX_SERIES) {
    errors.push({ path: 'series', code: 'TOO_LONG' });
  } else if (!/^[A-Z]*$/.test(value.series)) {
    errors.push({ path: 'series', code: 'LETTERS_REQUIRED' });
  }

  if (value.number === '') errors.push({ path: 'number', code: 'EMPTY' });
  else if (/\s/.test(value.number)) errors.push({ path: 'number', code: 'INTERNAL_WHITESPACE' });
  else if (!/^[0-9]+$/.test(value.number)) errors.push({ path: 'number', code: 'DIGITS_REQUIRED' });
  else if (value.number.length > MAX_NUMBER) errors.push({ path: 'number', code: 'TOO_LONG' });
  else if (format && value.number.length !== format.numberLength) errors.push({ path: 'number', code: 'WRONG_LENGTH' });

  return errors.length === 0 ? { ok: true, value } : { ok: false, errors };
}
