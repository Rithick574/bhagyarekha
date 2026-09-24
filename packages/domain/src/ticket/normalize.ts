import type { TicketFieldErrorCode } from '@bhagyarekha/contracts';

export interface RawTicketInput {
  series: string;
  number: string;
}

export interface NormalizedTicket {
  /** Upper-case letters, or '' when the ticket has no series. */
  series: string;
  /** ASCII digits exactly as entered (after outer trim). Leading zeros preserved. */
  number: string;
}

export interface TicketFieldError {
  path: 'series' | 'number';
  code: TicketFieldErrorCode;
}

export type NormalizeResult = { ok: true; ticket: NormalizedTicket } | { ok: false; errors: TicketFieldError[] };

const MAX_SERIES = 8;
const MAX_NUMBER = 12;

/**
 * INV-02 / LLD §1: normalise ONLY outer whitespace and series letter case.
 * Everything else is rejected with a readable code. Nothing is stripped,
 * padded, truncated or coerced to a number.
 */
export function normalizeTicketInput(input: RawTicketInput): NormalizeResult {
  const errors: TicketFieldError[] = [];
  const series = input.series.trim().toUpperCase();
  const number = input.number.trim();

  if (series.length > MAX_SERIES) errors.push({ path: 'series', code: 'TOO_LONG' });
  else if (/\s/.test(series)) errors.push({ path: 'series', code: 'INTERNAL_WHITESPACE' });
  else if (!/^[A-Z]*$/.test(series)) errors.push({ path: 'series', code: 'LETTERS_REQUIRED' });

  if (number.length === 0) errors.push({ path: 'number', code: 'EMPTY' });
  else if (number.length > MAX_NUMBER) errors.push({ path: 'number', code: 'TOO_LONG' });
  else if (/\s/.test(number)) errors.push({ path: 'number', code: 'INTERNAL_WHITESPACE' });
  else if (!/^[0-9]+$/.test(number)) errors.push({ path: 'number', code: 'DIGITS_REQUIRED' });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, ticket: { series, number } };
}
