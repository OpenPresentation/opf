// The problems of the source pane: every finding with its plain-words message, what could come next, where it is in the text (a range, a line and a
// column) and the quick fixes that go with it. The pane lists them in the panel and draws them in the text with the same objects.
import { describeFinding, segmentsOf } from "./source-messages.js";
import { fixesForFinding } from "./source-fixes.js";
import { textFixesForFinding } from "./source-fixes-text.js";
import { lineColumn, locateText, partOf } from "./source-ranges.js";

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

/**
 * A fix core ships (`fixes[]` of a finding) as a pane fix: a `patch` goes through the session, a `focus` selects the field.
 * `actions`: `{ applyPatch(patch), focusField(focus) }`.
 */
function coreFix(fix, actions) {
  if (!fix || typeof fix !== "object" || typeof fix.id !== "string") return null;
  const base = { id: fix.id, title: String(fix.title ?? fix.id), safe: fix.safe === true };
  if (fix.kind === "patch" && Array.isArray(fix.patch)) return { ...base, run: () => actions.applyPatch(fix.patch) };
  if (fix.kind === "focus" && fix.focus) return { ...base, run: () => actions.focusField(fix.focus) };
  return null;
}

/** Edits from a syntax problem (`{ offset, length, insert }` or `{ from, to, insert }`) as `{ from, to, insert }`. */
const toEdits = (edits = []) => edits.map((edit) => (edit.from !== undefined ? edit : { from: edit.offset, to: edit.offset + edit.length, insert: edit.insert ?? edit.content ?? "" }));

/**
 * The problems of `findings` in `text`. `context` is what source-messages.js takes plus `{ unit, starter }`; `actions` is what coreFix takes.
 * Returns rows in position order (errors first at one place), each `{ finding, severity, message, next, rule, path, from?, to?, line?, column?, fixes }`.
 */
export function buildProblems({ format, text, findings, context = {}, actions = {}, lineOf }) {
  const rows = findings.map((finding, index) => {
    const { message, next } = describeFinding(finding, context);
    let range = null;
    if (finding.range) range = { from: finding.range.from, to: finding.range.to };
    else if (finding.kind !== "syntax" && finding.path !== undefined && finding.ruleId?.startsWith("opf/")) {
      // The finding names a field of the document: core finds it in the text of any format.
      const located = locateText(format, text, segmentsOf(finding.path), partOf(finding));
      if (located) range = { from: located.from, to: located.to };
    }
    if (!range && Number.isInteger(finding.location?.offset)) range = { from: finding.location.offset, to: finding.location.offset + Math.max(0, finding.location.length ?? 0) };
    const fixes = [];
    for (const fix of finding.editFixes ?? []) {
      if (fix.action === "switch-format") fixes.push({ id: fix.id, title: fix.title, safe: fix.safe === true, run: () => actions.switchFormat?.(fix.format) });
      else fixes.push({ ...fix, edits: toEdits(fix.edits) });
    }
    if (finding.kind !== "syntax") fixes.push(...(format === "json" ? fixesForFinding(finding, text, context) : textFixesForFinding(format, finding, text, context)));
    for (const fix of finding.fixes ?? []) { const row = coreFix(fix, actions); if (row) fixes.push(row); }
    // A repair core ships as a patch and the editor also writes as a text edit is offered once, as the text edit (it keeps comments and layout).
    const titles = new Set();
    for (let at = 0; at < fixes.length; at++) { if (titles.has(fixes[at].title)) fixes.splice(at--, 1); else titles.add(fixes[at].title); }
    const row = { finding, index, severity: finding.severity, message, next, rule: finding.ruleId, path: finding.path ?? "", fixes };
    if (range) {
      row.from = range.from;
      row.to = Math.max(range.from, range.to);
      const where = lineColumn(text, range.from);
      row.line = where.line;
      row.column = where.column;
    } else {
      const line = lineOf?.(finding) ?? finding.line;
      if (line) {
        row.line = line;
        if (finding.column) row.column = finding.column;
      }
    }
    return row;
  });
  return mergeRenames(rows).sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity) || (a.column ?? 0) - (b.column ?? 0) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.index - b.index);
}

/** The count line of the panel and the live region: "2 problems: 1 error, 1 warning". */
export function summarize(rows) {
  const count = (severity) => rows.filter((row) => row.severity === severity).length;
  const parts = [[count("error"), "error"], [count("warning"), "warning"], [count("info"), "note"]].filter(([n]) => n > 0).map(([n, word]) => `${n} ${word}${n === 1 ? "" : "s"}`);
  return rows.length ? `${rows.length} problem${rows.length === 1 ? "" : "s"}: ${parts.join(", ")}` : "No problems";
}

// An unknown key that is a near miss of a missing required key says it once: the rename fixes both, so the "missing" row goes.
function mergeRenames(rows) {
  const renamed = new Set();
  for (const row of rows) {
    if (row.finding.validation?.keyword !== "additionalProperties") continue;
    const parent = segmentsOf(row.finding.path).slice(0, -1).join("/");
    for (const fix of row.fixes) if (fix.id.startsWith("rename-to:")) renamed.add(`${parent}|${fix.id.slice("rename-to:".length)}`);
  }
  if (!renamed.size) return rows;
  return rows.filter((row) => !(row.finding.validation?.keyword === "required" && renamed.has(`${segmentsOf(row.finding.path).join("/")}|${row.finding.validation.params?.missingProperty}`)));
}
