// CE-06 (promoted from openpresentation.org's playground runtime): the source pane's text, read and judged the way a host wants it.
// `parseSourceText` reads the text of the pane in its format into a document or a message; `reportSource` adds core's verdict. The pane
// calls these (through `getFindings`) for the text it shows, so the footer of a host and the findings under the code say the same thing.
import { validate } from "@openpresentation/opf";
import { fromYaml } from "@openpresentation/opf/yaml";
import { fromMarkdown } from "@openpresentation/opf/markdown";
import { findDuplicateKey } from "./exact-source.js";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** The checks a source verdict runs by default: the format rules and the catalog reference rules (what the session itself applies to an edit). */
export const SOURCE_CHECKS = Object.freeze({ only: Object.freeze(["format", "references"]) });

/** Line endings as the code editor holds them: LF. */
export const lf = (text) => text.replace(/\r\n?/g, "\n");

/** Read `text` in `format` (`json`, `yaml`, `md`): `{ document, message: "" }`, or `{ message }` when it does not read as a document. */
export function parseSourceText(format, text, { catalogs } = {}) {
  if (format === "json") {
    try {
      const document = JSON.parse(text);
      if (!isObject(document)) return { message: "An OPF document is a JSON object." };
      // JSON.parse keeps the last of a repeated key and hides the rest; the pane refuses such a document, so this does too.
      const duplicate = findDuplicateKey(text);
      if (duplicate) return { message: `Duplicate key "${duplicate.key}". Remove the repeated key.` };
      return { document, message: "" };
    } catch (error) {
      return { message: error instanceof Error ? error.message : "Not valid JSON" };
    }
  }
  const result = format === "yaml" ? fromYaml(text, { catalogs }) : fromMarkdown(text, { catalogs });
  const syntax = result.findings.filter((finding) => !finding.ruleId?.startsWith("opf/"));
  if (syntax.length) return { message: syntax[0].message };
  return { document: result.presentation, message: "" };
}

/**
 * The verdict on the text of the pane: `{ status, findings, valid }`. `status` is `{ kind: "valid", warnings }`,
 * `{ kind: "invalid", errors, warnings }` or `{ kind: "syntax", format, message }` (the text does not read as a document).
 */
export function reportSource(format, text, { catalogs, checks = SOURCE_CHECKS } = {}) {
  const parsed = parseSourceText(format, text, { catalogs });
  if (parsed.document === undefined) return { status: { kind: "syntax", format, message: parsed.message }, findings: [], valid: false };
  const result = validate(parsed.document, { ...checks, ...(catalogs !== undefined ? { catalogs } : {}) });
  const errors = result.findings.filter((finding) => finding.severity === "error").length;
  const warnings = result.findings.filter((finding) => finding.severity === "warning").length;
  return {
    status: result.valid ? { kind: "valid", warnings } : { kind: "invalid", errors, warnings },
    findings: result.findings,
    valid: result.valid,
  };
}

/** Copy text to the clipboard; falls back to a hidden textarea and `execCommand` where the Clipboard API is refused. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("The browser refused the copy.");
  }
}

/** Download a source file the pane produced (`{ filename, text, mime }`) as a Blob link. */
export function downloadSourceFile(file, text = file.text) {
  const url = URL.createObjectURL(new Blob([text], { type: `${file.mime};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.append(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
