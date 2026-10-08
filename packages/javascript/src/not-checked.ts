import type { ValidationChecks } from "./validator.js";

/** The `checks` of a report whose text was read but not checked as OPF: a syntax error stopped it, or the caller asked for `validate: false`. Internal module. */
export const NOT_CHECKED: ValidationChecks = { syntax: "checked", schema: "not-run", references: "not-run", policy: "not-run", accessibility: "not-run", content: "not-run", layout: "not-run", backgroundPixels: "not-read", imageBytes: "embedded-only", nativeExport: "not-checked" };
