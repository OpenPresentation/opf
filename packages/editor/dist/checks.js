// The editor's one use of core's checker. Every edit is validated with `validate(presentation, { only: ["format"] })`: the
// schema and semantic OPF rules, with no layout built, so it is cheap enough to run on every keystroke and undo. The full
// report (accessibility, layout, content) belongs to the Review panel, which runs it on idle (`./review.js`).
import { validate } from "@openpresentation/opf";

const FORMAT_ONLY = Object.freeze({ only: Object.freeze(["format"]) });

/** Core's `ValidationReport` for the `format` category: `valid`, `findings`, `counts`, `schemaValid`. */
export function checkFormat(presentation) {
  return validate(presentation, FORMAT_ONLY);
}

/** The error-severity findings of a report: what makes it invalid. */
export function errorFindings(report) {
  return (report?.findings ?? []).filter((finding) => finding.severity === "error");
}

/** The message of the first error finding, or `fallback` when the report has none. */
export function firstErrorMessage(report, fallback) {
  return errorFindings(report)[0]?.message ?? fallback;
}
