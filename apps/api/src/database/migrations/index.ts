import { CatalogRulesEvidence1758700000002 } from './1758700000002-CatalogRulesEvidence.js';
import { Draws1758700000003 } from './1758700000003-Draws.js';
import { FoundationMetadataAdmin1758700000001 } from './1758700000001-FoundationMetadataAdmin.js';
import { Indexes1758700000006 } from './1758700000006-Indexes.js';
import { PointerAndGuards1758700000005 } from './1758700000005-PointerAndGuards.js';
import { Revisions1758700000004 } from './1758700000004-Revisions.js';

/** Explicit, ordered migration list. No filesystem globbing so ESM builds and tests behave identically. */
export const ALL_MIGRATIONS = [
  FoundationMetadataAdmin1758700000001,
  CatalogRulesEvidence1758700000002,
  Draws1758700000003,
  Revisions1758700000004,
  PointerAndGuards1758700000005,
  Indexes1758700000006,
];
