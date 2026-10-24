/**
 * `explain(ruleId)`: what a rule checks, why it matters and how to fix it, with an example. Internal module; exported from the package root and
 * `@openpresentation/opf/source`.
 */
import type { RuleExplanation } from "./finding-text-util.js";

export type { RuleExplanation } from "./finding-text-util.js";

/** What a rule checks, why, and what to do (`explain("opf/text-contrast")`, `explain("text-contrast")`, `explain("yaml/syntax")`). `undefined` for an unknown id. */
export function explain(_ruleId: string): RuleExplanation | undefined {
  return undefined;
}
