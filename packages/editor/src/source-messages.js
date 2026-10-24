// Problem text for the source pane (artifacts/source-editor/VALIDATOR-HINTS.md): what is wrong, where, and what could come next. The sentences are core's
// (`describeFinding` of `@openpresentation/opf/source`: the schema keywords, every rule, the YAML and Markdown readers), so the CLI, agents and every
// editor say the same thing; this module adds what only an editor has (the problems its own analyzers found, the replacement values of a quick fix).
// Pure functions, no DOM: `describeFinding(finding, context)` returns `{ message, next }`; the quick fix edits that go with a message are in source-fixes.js.
import { describeFinding as describeWithCore, distance, nearest, pointerSegments } from "@openpresentation/opf/source";

/**
 * `context`: what core's `FindingTextContext` takes. `{ document }` is the deck being checked (the actual value makes "but is `middle`" possible and the
 * ids of the document available to the rules), `{ format }` the text format (examples are written for it), `{ catalogCount(kind) }` how many records of a
 * kind can be chosen. Callbacks `valueAt(segments)`, `schemaAt(segments)`, `keysOf(segments)`, `catalogKind(segments)` and `starter(segments, property)`
 * take the place of what core would read from `document`.
 */

export { distance, nearest };

/** The segments of a JSON Pointer ("/slides/0/title"); "" is the document. */
export const segmentsOf = pointerSegments;

/**
 * The message and the hint for a finding. A problem that brings its own hint (the syntax analyzers') keeps it whole; every other finding is written by
 * core from its data. `finding.path` is a JSON Pointer.
 */
export function describeFinding(finding, context = {}) {
  if (finding.next) return { message: finding.message, next: finding.next };
  return describeWithCore(finding, context);
}

/** The values a quick fix can change an enum or a reference to: the nearest first, then the rest, at most `limit`. */
export function replacementValues(finding, context = {}, limit = 5) {
  const segments = segmentsOf(finding.path);
  const keyword = finding.validation?.keyword;
  const read = (path) => (context.valueAt ? context.valueAt(path) : path.reduce((value, key) => (value !== null && typeof value === "object" ? value[key] : undefined), context.document));
  if (keyword === "enum") {
    const values = finding.validation.params?.allowedValues ?? [];
    // The near misses first, then the values in the order the schema lists them.
    return [...new Set([...nearest(read(segments), values, limit).close, ...values])].slice(0, limit);
  }
  if (finding.ruleId === "opf/unresolved-reference" && finding.suggestions?.length) return finding.suggestions.map((entry) => entry.value).slice(0, limit);
  if (keyword === "additionalProperties") {
    const parent = segments.slice(0, -1);
    const keys = context.keysOf?.(parent) ?? finding.suggestions?.map((entry) => entry.value) ?? [];
    return nearest(finding.validation.params?.additionalProperty ?? segments.at(-1), keys, 3).close;
  }
  // Findings core has suggestions for (a near-miss option name of Markdown, the chart types).
  if (finding.suggestions?.length && String(finding.ruleId).startsWith("markdown/")) return finding.suggestions.map((entry) => entry.value).slice(0, limit);
  return [];
}
