/**
 * The hand-written half of `explain` for the `opf/*` rules: the table of `fix` sentences and examples, assembled from the per-group files. Internal
 * module; `explain.ts` combines it with the rule registry (summary, rationale, category, severity, standard).
 */
import { AUDIT_EXPLAIN } from "./finding-text-explain-audit.js";
import { CONTENT_EXPLAIN } from "./finding-text-explain-content.js";
import { FORMAT_EXPLAIN } from "./finding-text-explain-format.js";
import { REFERENCES_EXPLAIN } from "./finding-text-explain-references.js";
import type { ExplainDetail } from "./finding-text-explain-util.js";

export type { ExplainDetail } from "./finding-text-explain-util.js";
export { exampleText } from "./finding-text-explain-util.js";

/** Rule id -> `fix` and example, for every rule of the registry. A test checks that none is missing and none is extra. */
export const RULE_EXPLAIN: Readonly<Record<string, ExplainDetail>> = Object.freeze({
  ...FORMAT_EXPLAIN,
  ...REFERENCES_EXPLAIN,
  ...AUDIT_EXPLAIN,
  ...CONTENT_EXPLAIN,
});
