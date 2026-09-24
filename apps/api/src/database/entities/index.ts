import { AdminUserEntity } from './admin-user.entity.js';
import { DeploymentMetadataEntity } from './deployment-metadata.entity.js';
import { DrawEntity } from './draw.entity.js';
import { LotteryEntity } from './lottery.entity.js';
import { ResultRevisionEntity } from './result-revision.entity.js';
import { RevisionCategoryEntity } from './revision-category.entity.js';
import { RevisionEvidenceEntity } from './revision-evidence.entity.js';
import { RuleCategoryEntity } from './rule-category.entity.js';
import { RuleEvidenceEntity } from './rule-evidence.entity.js';
import { RuleVersionEntity } from './rule-version.entity.js';
import { SourceEvidenceEntity } from './source-evidence.entity.js';
import { WinningEntryEntity } from './winning-entry.entity.js';

export {
  AdminUserEntity,
  DeploymentMetadataEntity,
  DrawEntity,
  LotteryEntity,
  ResultRevisionEntity,
  RevisionCategoryEntity,
  RevisionEvidenceEntity,
  RuleCategoryEntity,
  RuleEvidenceEntity,
  RuleVersionEntity,
  SourceEvidenceEntity,
  WinningEntryEntity,
};
export type { DrawSnapshot } from './result-revision.entity.js';

export const ALL_ENTITIES = [
  DeploymentMetadataEntity,
  AdminUserEntity,
  LotteryEntity,
  RuleVersionEntity,
  RuleCategoryEntity,
  SourceEvidenceEntity,
  RuleEvidenceEntity,
  DrawEntity,
  ResultRevisionEntity,
  RevisionCategoryEntity,
  WinningEntryEntity,
  RevisionEvidenceEntity,
];
