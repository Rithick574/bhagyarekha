import { z } from 'zod';
import { CategoryCodeSchema, CurrencySchema, InstantSchema, LocalizedTextSchema, MinorAmountSchema, UuidSchema } from './common.js';
import { CategoryStateSchema, CheckOutcomeSchema, CompletenessSchema, DataModeSchema } from './enums.js';
import { DrawSummarySchema, SourceReferenceSchema } from './public.js';

/**
 * Raw form input. Only outer whitespace and series case are normalised
 * server-side; everything else must already be exactly what is printed on the
 * ticket. Bounded lengths stop abuse before any parsing.
 */
export const TicketCheckRequestSchema = z.strictObject({
  lotteryId: UuidSchema,
  drawId: UuidSchema,
  /** Letters as printed on the ticket; may be empty when the configured rules use no series. */
  series: z.string().max(16),
  /** Digits as printed, leading zeros included. Never a number. */
  number: z.string().min(1).max(32),
  /** Revision the user is looking at; a mismatch yields 409 RESULT_CHANGED. */
  expectedRevisionId: UuidSchema.optional(),
});
export type TicketCheckRequest = z.infer<typeof TicketCheckRequestSchema>;

export const TicketMatchSchema = z.object({
  categoryCode: CategoryCodeSchema,
  /**
   * True only when every configured category is complete and reviewed, so the
   * award is resolved under the published dataset. Never proof of authenticity
   * or an accepted claim.
   */
  awardConfirmed: z.boolean(),
  amountMinor: MinorAmountSchema.nullable(),
  currency: CurrencySchema,
});
export type TicketMatch = z.infer<typeof TicketMatchSchema>;

export const CheckMessageCodeSchema = z.enum([
  'CHECK_MATCH_INFORMATIONAL',
  'CHECK_NO_MATCH_COMPLETE',
  'CHECK_PARTIAL_MATCH_PROVISIONAL',
  'CHECK_RESULT_INCOMPLETE',
  'CHECK_RESULT_NOT_PUBLISHED',
  'CHECK_RULES_UNSUPPORTED',
  'CHECK_RESULT_SUSPENDED',
  'CHECK_DRAW_CANCELLED',
]);
export type CheckMessageCode = z.infer<typeof CheckMessageCodeSchema>;

export const TicketCheckResponseSchema = z.object({
  outcome: CheckOutcomeSchema,
  dataMode: DataModeSchema,
  /** The draw that was checked — identity is echoed so the UI can confirm it. The ticket never is. */
  draw: DrawSummarySchema,
  resultRevisionId: UuidSchema.nullable(),
  ruleVersionId: UuidSchema.nullable(),
  checkedAt: InstantSchema,
  completeness: CompletenessSchema.nullable(),
  /** Every configured category of the checked revision with its label and completeness, in priority order. Empty when no revision was evaluated. */
  categories: z.array(z.object({ code: CategoryCodeSchema, label: LocalizedTextSchema, state: CategoryStateSchema })),
  /** Categories whose entries were evaluated (complete ones). */
  checkedCategoryCodes: z.array(CategoryCodeSchema),
  /** Categories that are MISSING or PARTIAL and therefore block a definitive verdict. */
  unresolvedCategoryCodes: z.array(CategoryCodeSchema),
  /** At most one entry under SINGLE_BY_PRIORITY. Empty for non-verdict outcomes and NO_MATCH. */
  matches: z.array(TicketMatchSchema),
  basis: z.literal('PUBLISHED_SNAPSHOT_ONLY'),
  sources: z.array(SourceReferenceSchema),
  messageCode: CheckMessageCodeSchema,
});
export type TicketCheckResponse = z.infer<typeof TicketCheckResponseSchema>;

/** Field-level codes returned inside INVALID_INPUT / INVALID_SERIES / INVALID_NUMBER_LENGTH errors. */
export const TicketFieldErrorCodeSchema = z.enum([
  'EMPTY',
  'DIGITS_REQUIRED',
  'INTERNAL_WHITESPACE',
  'LETTERS_REQUIRED',
  'TOO_LONG',
  'SERIES_NOT_ALLOWED',
  'SERIES_REQUIRED',
  'WRONG_LENGTH',
  'FIRST_DIGIT_NOT_ALLOWED',
]);
export type TicketFieldErrorCode = z.infer<typeof TicketFieldErrorCodeSchema>;
