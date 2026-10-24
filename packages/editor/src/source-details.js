// The "Details" of a problem (artifacts/source-editor/VALIDATOR-HINTS.md, section 1): what the rule checks, why it matters, what to do and a small
// example, from core's `explain(ruleId)`, behind a disclosure so the row itself stays one sentence and a hint. Pure data here; the pane draws it.
import { explain } from "@openpresentation/opf/source";

/**
 * The details of a finding: `{ rule, summary, why, fix, example?, docs? }`, or null when core has nothing to say about the rule. A schema finding adds the
 * keyword and the place in the schema it comes from.
 */
export function detailsFor(finding) {
  const ruleId = finding?.ruleId;
  if (!ruleId) return null;
  let found;
  try { found = explain(ruleId); } catch { found = undefined; }
  if (!found) return null;
  const schema = finding.validation?.keyword ? `The schema keyword is ${finding.validation.keyword}${finding.definition ? `; it is defined at ${finding.definition}` : ""}.` : "";
  return { rule: found.id, summary: found.summary, why: found.rationale, fix: found.fix, ...(found.example ? { example: found.example } : {}), docs: finding.definition ?? found.docs, ...(schema ? { schema } : {}) };
}
