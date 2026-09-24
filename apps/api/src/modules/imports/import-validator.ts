import type { ImportEntry, ImportManifest, ImportRowError } from '@bhagyarekha/contracts';
import type { CompiledRuleSet } from '@bhagyarekha/domain';
import type { ParsedRows } from './import-parser.js';

export interface ValidationContext {
  manifest: ImportManifest;
  rules: CompiledRuleSet;
  drawHasCurrentRevision: boolean;
  ruleState: string;
  dataMode: 'demo' | 'live';
}

export interface ValidationOutcome {
  errors: ImportRowError[];
  validRows: { row: number; entry: ImportEntry }[];
  rowsPerCategory: Record<string, number>;
}

/**
 * LLD §5.1 semantic validation. Every problem is reported; nothing is dropped,
 * de-duplicated or padded silently. A duplicate is an error to resolve.
 */
export function validateImport(parsed: ParsedRows, ctx: ValidationContext): ValidationOutcome {
  const errors: ImportRowError[] = [...parsed.errors];
  const { manifest, rules } = ctx;
  const manifestErr = (path: string, code: string, message: string) => errors.push({ row: 0, path, code, message });

  if (ctx.ruleState !== 'APPROVED') manifestErr('ruleVersion', 'RULE_NOT_APPROVED', `Rule version ${manifest.ruleVersion} is ${ctx.ruleState}; imports need an approved rule`);
  if (manifest.publicationKind === 'INITIAL' && ctx.drawHasCurrentRevision) manifestErr('publicationKind', 'DRAW_ALREADY_PUBLISHED', 'This draw already has a published result; use UPDATE or CORRECTION');
  if (manifest.publicationKind !== 'INITIAL' && !ctx.drawHasCurrentRevision) manifestErr('publicationKind', 'NO_PUBLISHED_RESULT', `${manifest.publicationKind} requires an already published result; use INITIAL`);
  if (manifest.source.kind === 'SYNTHETIC_FIXTURE' && ctx.dataMode !== 'demo') manifestErr('source.kind', 'NOT_ALLOWED_IN_LIVE', 'Synthetic evidence is not allowed in live mode');

  const configured = new Map(rules.categoriesByPriority.map((c) => [c.spec.code, c.spec]));
  const manifestCodes = new Set(manifest.categories.map((c) => c.code));
  for (const code of configured.keys()) if (!manifestCodes.has(code)) manifestErr('categories', 'CATEGORY_MISSING_FROM_MANIFEST', `Manifest must state completeness for category ${code}`);
  for (const c of manifest.categories) {
    if (!configured.has(c.code)) manifestErr('categories', 'UNKNOWN_CATEGORY', `Category ${c.code} is not part of rule version ${manifest.ruleVersion}`);
    if (c.state === 'COMPLETE' && c.amountMinor === null) manifestErr(`categories.${c.code}.amountMinor`, 'AMOUNT_REQUIRED', `A COMPLETE category needs a recorded prize amount (${c.code})`);
  }
  if (manifest.completeness === 'COMPLETE' && manifest.categories.some((c) => c.state !== 'COMPLETE')) manifestErr('completeness', 'INCOMPLETE_CATEGORY', 'completeness COMPLETE requires every category to be COMPLETE');

  const stateByCode = new Map(manifest.categories.map((c) => [c.code, c.state]));
  const seen = new Set<string>();
  const rowsPerCategory: Record<string, number> = {};
  const validRows: ValidationOutcome['validRows'] = [];
  for (const { row, entry } of parsed.rows) {
    const spec = configured.get(entry.categoryCode);
    if (!spec) {
      errors.push({ row, path: 'categoryCode', code: 'UNKNOWN_CATEGORY', message: `Unknown category ${entry.categoryCode}` });
      continue;
    }
    if (stateByCode.get(entry.categoryCode) === 'MISSING') errors.push({ row, path: 'categoryCode', code: 'ROWS_FOR_MISSING_CATEGORY', message: `Category ${entry.categoryCode} is marked MISSING but has rows` });
    let ok = true;
    if (spec.match.kind === 'SUFFIX') {
      if (entry.number.length !== spec.match.suffixLength) { errors.push({ row, path: 'number', code: 'WRONG_LENGTH', message: `Suffix entries for ${spec.code} must have ${spec.match.suffixLength} digits` }); ok = false; }
      if (entry.series !== '') { errors.push({ row, path: 'series', code: 'SERIES_NOT_ALLOWED', message: `Suffix entries for ${spec.code} carry no series` }); ok = false; }
    } else {
      if (entry.number.length !== rules.numberLength) { errors.push({ row, path: 'number', code: 'WRONG_LENGTH', message: `Full numbers must have ${rules.numberLength} digits (leading zeros are significant)` }); ok = false; }
      if (!rules.allowedFirstDigits.has(entry.number[0] ?? '')) { errors.push({ row, path: 'number', code: 'FIRST_DIGIT_NOT_ALLOWED', message: 'First digit is outside the configured domain' }); ok = false; }
      if (spec.match.seriesPolicy === 'ANY_ALLOWED') {
        if (entry.series !== '') { errors.push({ row, path: 'series', code: 'SERIES_NOT_ALLOWED', message: `${spec.code} entries carry no series` }); ok = false; }
      } else if (!rules.allowedSeries.has(entry.series)) {
        errors.push({ row, path: 'series', code: 'SERIES_NOT_ALLOWED', message: `Series must be one of ${[...rules.allowedSeries].join(', ')}` });
        ok = false;
      }
    }
    const key = `${entry.categoryCode}|${entry.series}|${entry.number}`;
    if (seen.has(key)) { errors.push({ row, path: 'row', code: 'DUPLICATE_ENTRY', message: 'Duplicate of an earlier row (same category, series and number)' }); ok = false; }
    seen.add(key);
    if (ok) {
      validRows.push({ row, entry });
      rowsPerCategory[entry.categoryCode] = (rowsPerCategory[entry.categoryCode] ?? 0) + 1;
    }
  }

  for (const c of manifest.categories) {
    const spec = configured.get(c.code);
    const count = rowsPerCategory[c.code] ?? 0;
    if (c.state === 'COMPLETE' && count === 0) manifestErr(`categories.${c.code}`, 'COMPLETE_WITHOUT_ROWS', `Category ${c.code} is marked COMPLETE but has no valid rows`);
    if (c.state === 'COMPLETE' && spec?.expectedEntryCount != null && count !== spec.expectedEntryCount && !parsed.errors.length) {
      manifestErr(`categories.${c.code}`, 'EXPECTED_COUNT_MISMATCH', `Category ${c.code} expects ${spec.expectedEntryCount} entries but has ${count}`);
    }
  }
  return { errors, validRows, rowsPerCategory };
}
