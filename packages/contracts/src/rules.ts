import { z } from 'zod';
import { CategoryCodeSchema, LocalizedTextSchema } from './common.js';
import { MetricRoleSchema } from './enums.js';

/**
 * Version-1 declarative rule language. Closed and allowlisted: no code, SQL,
 * regex or arbitrary expressions. These are engine CAPABILITIES; they are not
 * verified descriptions of any real lottery scheme.
 */
export const FullNumberSeriesPolicySchema = z.enum(['MATCH_ENTRY', 'EXCEPT_ENTRY', 'ANY_ALLOWED']);

export const MatchSpecSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('FULL_NUMBER'), seriesPolicy: FullNumberSeriesPolicySchema }),
  z.strictObject({
    kind: z.literal('SUFFIX'),
    seriesPolicy: z.literal('ANY_ALLOWED'),
    suffixLength: z.number().int().min(1).max(12),
  }),
]);
export type MatchSpec = z.infer<typeof MatchSpecSchema>;

export const RuleCategorySpecSchema = z.strictObject({
  code: CategoryCodeSchema,
  labels: LocalizedTextSchema,
  metricRole: MetricRoleSchema,
  /** Lower value has higher award priority. */
  priority: z.number().int().min(1),
  match: MatchSpecSchema,
  /** Category codes whose match excludes this category. Each must have a higher priority (lower number). */
  excludedBy: z.array(CategoryCodeSchema),
  expectedEntryCount: z.number().int().min(0).nullable(),
});
export type RuleCategorySpec = z.infer<typeof RuleCategorySpecSchema>;

export const RuleSetV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  engineVersion: z.literal('v1'),
  lotteryCode: z.string().min(1).max(32),
  ruleVersion: z.number().int().min(1),
  numberLength: z.number().int().min(1).max(12),
  allowedFirstDigits: z.array(z.string().regex(/^[0-9]$/)).min(1),
  allowedSeries: z.array(z.string().regex(/^[A-Z]{1,8}$/)).min(1),
  awardPolicy: z.literal('SINGLE_BY_PRIORITY'),
  categories: z.array(RuleCategorySpecSchema).min(1),
});
export type RuleSetV1 = z.infer<typeof RuleSetV1Schema>;
