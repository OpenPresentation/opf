/**
 * `explain(ruleId)`: what a rule checks, why it matters and how to fix it, with an example. Internal module; exported from the package root and
 * `@openpresentation/opf/source`.
 */
import { RULE_EXPLAIN, exampleText } from "./finding-text-explain.js";
import { us } from "./finding-text-helpers.js";
import { SOURCE_EXPLAIN } from "./finding-text-source.js";
import type { RuleExplanation } from "./finding-text-util.js";
import { findValidationRule, ruleDocumentation } from "./validation-rule-info.js";

export type { RuleExplanation } from "./finding-text-util.js";

/**
 * What a rule checks, why, and what to do (`explain("opf/text-contrast")`, `explain("text-contrast")`, `explain("yaml/syntax")`). The `opf/*` rules come
 * from the validation registry (summary, rationale, category, default severity, standard) plus a `fix` sentence and a small before/after example;
 * `yaml/*` and `markdown/*` come from the readers' table. `undefined` for an unknown id.
 */
export function explain(ruleId: string): RuleExplanation | undefined {
  if (typeof ruleId !== "string") return undefined;
  if (/^(yaml|markdown)\//.test(ruleId)) {
    const entry = SOURCE_EXPLAIN[ruleId];
    return entry ? { id: ruleId, name: ruleId.slice(ruleId.indexOf("/") + 1), docs: ruleDocumentation(ruleId), ...entry } : undefined;
  }
  const info = findValidationRule(ruleId);
  if (!info) return undefined;
  const detail = RULE_EXPLAIN[info.id];
  return {
    id: info.id,
    name: info.name,
    category: info.category,
    severity: info.severity,
    summary: us(info.summary),
    rationale: us(info.standard && !info.standard.startsWith("spec/") ? `${info.rationale} Basis: ${info.standard}.` : info.rationale),
    fix: detail?.fix ?? us(info.summary),
    ...(detail ? { example: { problem: exampleText(detail.problem), fixed: exampleText(detail.fixed), language: "json" as const } } : {}),
    docs: ruleDocumentation(info.id),
  };
}
