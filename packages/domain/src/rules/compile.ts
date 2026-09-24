import type { RuleCategorySpec, RuleSetV1 } from '@bhagyarekha/contracts';

export interface RuleCompileError {
  code:
    | 'DUPLICATE_CATEGORY_CODE'
    | 'DUPLICATE_PRIORITY'
    | 'UNKNOWN_EXCLUSION_TARGET'
    | 'SELF_EXCLUSION'
    | 'EXCLUSION_NOT_HIGHER_PRIORITY'
    | 'EXCLUSION_CYCLE'
    | 'SUFFIX_LONGER_THAN_NUMBER'
    | 'SERIES_POLICY_REQUIRES_SERIES'
    | 'DUPLICATE_ALLOWED_SERIES'
    | 'DUPLICATE_ALLOWED_FIRST_DIGIT'
    | 'MULTIPLE_FIRST_PRIZE_CATEGORIES_WITH_DIFFERENT_MATCH';
  path: string;
  message: string;
}

export interface CompiledCategory {
  spec: RuleCategorySpec;
  /** Codes of higher-priority categories that exclude this one. */
  excludedBy: ReadonlySet<string>;
}

export interface CompiledRuleSet {
  ruleSet: RuleSetV1;
  numberLength: number;
  allowedSeries: ReadonlySet<string>;
  allowedFirstDigits: ReadonlySet<string>;
  /** Categories sorted by ascending priority value (highest award priority first). */
  categoriesByPriority: readonly CompiledCategory[];
  firstPrizeCategoryCodes: readonly string[];
}

export type CompileResult = { ok: true; compiled: CompiledRuleSet } | { ok: false; errors: RuleCompileError[] };

/**
 * Structural validation of a v1 rule set beyond what the Zod schema checks.
 * Fails closed: any error means the rule set is not compilable and results
 * governed by it must be reported as UNSUPPORTED for automatic checking.
 *
 * This says nothing about whether the rule set describes a real lottery
 * faithfully — that is a human review and evidence question.
 */
export function compileRuleSet(ruleSet: RuleSetV1): CompileResult {
  const errors: RuleCompileError[] = [];
  const byCode = new Map<string, RuleCategorySpec>();
  const priorities = new Map<number, string>();

  if (new Set(ruleSet.allowedSeries).size !== ruleSet.allowedSeries.length) {
    errors.push({ code: 'DUPLICATE_ALLOWED_SERIES', path: 'allowedSeries', message: 'allowedSeries contains duplicates' });
  }
  if (new Set(ruleSet.allowedFirstDigits).size !== ruleSet.allowedFirstDigits.length) {
    errors.push({ code: 'DUPLICATE_ALLOWED_FIRST_DIGIT', path: 'allowedFirstDigits', message: 'allowedFirstDigits contains duplicates' });
  }

  ruleSet.categories.forEach((category, index) => {
    const path = `categories[${index}]`;
    if (byCode.has(category.code)) {
      errors.push({ code: 'DUPLICATE_CATEGORY_CODE', path: `${path}.code`, message: `Category code ${category.code} is defined more than once` });
    } else {
      byCode.set(category.code, category);
    }
    const existingPriority = priorities.get(category.priority);
    if (existingPriority !== undefined) {
      errors.push({ code: 'DUPLICATE_PRIORITY', path: `${path}.priority`, message: `Priority ${category.priority} is shared by ${existingPriority} and ${category.code}` });
    } else {
      priorities.set(category.priority, category.code);
    }
    if (category.match.kind === 'SUFFIX' && category.match.suffixLength > ruleSet.numberLength) {
      errors.push({ code: 'SUFFIX_LONGER_THAN_NUMBER', path: `${path}.match.suffixLength`, message: 'Suffix length exceeds the number length' });
    }
    if (category.match.kind === 'FULL_NUMBER' && category.match.seriesPolicy !== 'ANY_ALLOWED' && ruleSet.allowedSeries.length === 0) {
      errors.push({ code: 'SERIES_POLICY_REQUIRES_SERIES', path: `${path}.match.seriesPolicy`, message: 'MATCH_ENTRY / EXCEPT_ENTRY require a nonempty allowedSeries domain' });
    }
  });

  ruleSet.categories.forEach((category, index) => {
    const path = `categories[${index}].excludedBy`;
    for (const excluder of category.excludedBy) {
      if (excluder === category.code) {
        errors.push({ code: 'SELF_EXCLUSION', path, message: `${category.code} cannot exclude itself` });
        continue;
      }
      const target = byCode.get(excluder);
      if (!target) {
        errors.push({ code: 'UNKNOWN_EXCLUSION_TARGET', path, message: `${category.code} references unknown category ${excluder}` });
        continue;
      }
      if (target.priority >= category.priority) {
        errors.push({ code: 'EXCLUSION_NOT_HIGHER_PRIORITY', path, message: `${excluder} must have a higher priority (lower number) than ${category.code}` });
      }
    }
  });

  if (errors.length === 0 && hasExclusionCycle(ruleSet.categories)) {
    errors.push({ code: 'EXCLUSION_CYCLE', path: 'categories', message: 'excludedBy relationships form a cycle' });
  }

  const firstPrize = ruleSet.categories.filter((c) => c.metricRole === 'FIRST_PRIZE');
  if (firstPrize.length > 1) {
    const signature = (c: RuleCategorySpec) => JSON.stringify(c.match);
    const first = firstPrize[0] as RuleCategorySpec;
    if (firstPrize.some((c) => signature(c) !== signature(first))) {
      errors.push({
        code: 'MULTIPLE_FIRST_PRIZE_CATEGORIES_WITH_DIFFERENT_MATCH',
        path: 'categories',
        message: 'All FIRST_PRIZE categories must share one match specification so statistics have one observation unit',
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const categoriesByPriority: CompiledCategory[] = [...ruleSet.categories]
    .sort((a, b) => a.priority - b.priority)
    .map((spec) => ({ spec, excludedBy: new Set(spec.excludedBy) }));

  return {
    ok: true,
    compiled: {
      ruleSet,
      numberLength: ruleSet.numberLength,
      allowedSeries: new Set(ruleSet.allowedSeries),
      allowedFirstDigits: new Set(ruleSet.allowedFirstDigits),
      categoriesByPriority,
      firstPrizeCategoryCodes: firstPrize.map((c) => c.code),
    },
  };
}

function hasExclusionCycle(categories: readonly RuleCategorySpec[]): boolean {
  const adjacency = new Map(categories.map((c) => [c.code, c.excludedBy] as const));
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (code: string): boolean => {
    const s = state.get(code);
    if (s === 'visiting') return true;
    if (s === 'done') return false;
    state.set(code, 'visiting');
    for (const next of adjacency.get(code) ?? []) {
      if (adjacency.has(next) && visit(next)) return true;
    }
    state.set(code, 'done');
    return false;
  };
  return categories.some((c) => visit(c.code));
}
