import { z } from 'zod';

/** Deployment data mode. Fixed per database; never client-controlled. */
export const DataModeSchema = z.enum(['demo', 'live']);
export type DataMode = z.infer<typeof DataModeSchema>;

export const DrawPhaseSchema = z.enum(['SCHEDULED', 'POSTPONED', 'HELD', 'CANCELLED']);
export type DrawPhase = z.infer<typeof DrawPhaseSchema>;

export const VisibilitySchema = z.enum(['ACTIVE', 'SUSPENDED']);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const RevisionStateSchema = z.enum(['DRAFT', 'READY', 'PUBLISHED', 'SUPERSEDED']);
export type RevisionState = z.infer<typeof RevisionStateSchema>;

export const CompletenessSchema = z.enum(['PARTIAL', 'COMPLETE']);
export type Completeness = z.infer<typeof CompletenessSchema>;

export const CategoryStateSchema = z.enum(['MISSING', 'PARTIAL', 'COMPLETE']);
export type CategoryState = z.infer<typeof CategoryStateSchema>;

export const PublicationKindSchema = z.enum(['INITIAL', 'UPDATE', 'CORRECTION']);
export type PublicationKind = z.infer<typeof PublicationKindSchema>;

export const RuleStateSchema = z.enum(['DRAFT', 'APPROVED', 'REVOKED']);
export type RuleState = z.infer<typeof RuleStateSchema>;

export const CheckOutcomeSchema = z.enum([
  'MATCH',
  'NO_MATCH',
  'PARTIAL_MATCH',
  'RESULT_INCOMPLETE',
  'RESULT_NOT_PUBLISHED',
  'RULES_UNSUPPORTED',
  'RESULT_SUSPENDED',
  'DRAW_CANCELLED',
]);
export type CheckOutcome = z.infer<typeof CheckOutcomeSchema>;

export const EvidenceKindSchema = z.enum(['OFFICIAL_DOCUMENT', 'MANUAL_TRANSCRIPTION', 'SYNTHETIC_FIXTURE']);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

/**
 * Public, read-side summary of what a visitor may rely on for a draw.
 * Derived on the server from phase, visibility and the current revision:
 *   CANCELLED      draw will not be held / was cancelled
 *   SUSPENDED      a published payload exists but is withheld pending review
 *   NOT_PUBLISHED  no public revision yet (scheduled or awaiting result)
 *   PARTIAL        published, but at least one configured category is not complete
 *   COMPLETE       published and every configured category is complete and reviewed
 */
export const PublicationStatusSchema = z.enum(['NOT_PUBLISHED', 'PARTIAL', 'COMPLETE', 'SUSPENDED', 'CANCELLED']);
export type PublicationStatus = z.infer<typeof PublicationStatusSchema>;

/** Whether automated ticket comparison is possible for a draw's current result. */
export const CheckCapabilitySchema = z.enum(['SUPPORTED', 'UNSUPPORTED', 'NOT_APPLICABLE']);
export type CheckCapability = z.infer<typeof CheckCapabilitySchema>;

export const ArchiveCoverageSchema = z.enum(['UNKNOWN', 'CURATED_COMPLETE']);
export type ArchiveCoverage = z.infer<typeof ArchiveCoverageSchema>;

export const MetricRoleSchema = z.enum(['FIRST_PRIZE', 'OTHER']);
export type MetricRole = z.infer<typeof MetricRoleSchema>;
