// Findings of the source pane (RR-98), kept apart from the DOM so they can be tested alone.

/** Normalize one finding: core `Finding` objects, `{ path, message, severity, line? }` objects and plain strings. */
export function normalizeFinding(input, kind) {
  const finding = typeof input === "string" ? { message: input } : input ?? {};
  const severity = finding.severity === "error" || finding.severity === "info" ? finding.severity : finding.severity === "warning" || finding.severity === "warn" ? "warning" : "error";
  const out = { path: String(finding.path ?? ""), message: String(finding.message ?? ""), severity };
  const line = finding.line ?? finding.location?.line;
  if (Number.isInteger(line) && line > 0) out.line = line;
  const column = finding.column ?? finding.location?.column;
  if (Number.isInteger(column) && column > 0) out.column = column;
  const own = finding.kind ?? kind;
  if (own) out.kind = own;
  if (finding.ruleId) out.ruleId = finding.ruleId;
  // What core knows about a finding beyond the sentence: the help, the source range, the schema keyword and parameters, the suggested
  // values and the fixes. The pane writes the problem text and its quick fixes from them.
  for (const key of ["help", "category", "location", "validation", "suggestions", "fixes", "lookup", "definition", "slide", "slideId", "measured", "next"]) {
    if (finding[key] !== undefined && finding[key] !== null) out[key] = finding[key];
  }
  // A problem with a range of its own (the JSON syntax analyzer) and the quick fixes that go with it.
  if (finding.range && Number.isInteger(finding.range.from) && Number.isInteger(finding.range.to)) out.range = finding.range;
  if (finding.editFixes) out.editFixes = finding.editFixes;
  if (Array.isArray(finding.related)) out.related = finding.related;
  return out;
}

/** The text of the first problem an error reports. */
export const errorText = (error) => error?.issues?.[0]?.message ?? error?.message ?? String(error);

/**
 * The findings for an edit the session refused: one per issue of the thrown error (its validator findings, each with its JSON pointer
 * `path`), so the list has the validator's count. An error without issues becomes one finding with its message.
 */
export function rejectionFindings(error) {
  const issues = Array.isArray(error?.issues) ? error.issues.filter((issue) => issue && (typeof issue === "string" || typeof issue === "object")) : [];
  if (!issues.length) return [normalizeFinding({ message: errorText(error) }, "rejected")];
  return issues.map((issue) => normalizeFinding(typeof issue === "string" ? issue : { ...issue, severity: issue.severity ?? "error", kind: undefined }, "rejected"));
}
