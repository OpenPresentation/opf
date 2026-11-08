// The source pane's text checks as plain functions of their input (no DOM, no editor session), so the main thread and the Web Worker
// (`./source-worker.js`) run exactly the same code and give the same answer. `readSource` is what the pane has always done with a text
// (parse it, collect the syntax findings); `checkSource` adds the validation the editor session would run on the deck it reads, so a worker
// can hand both back and the session need not repeat it on the main thread. Everything returned is structured-cloneable data.
import { fromYaml } from "@openpresentation/opf/yaml";
import { fromMarkdown, toMarkdown } from "@openpresentation/opf/markdown";
import { checkFormat } from "./checks.js";
import { normalizeFinding } from "./source-findings.js";
import { analyzeSyntax, findDuplicateKeys } from "./source-syntax.js";
import { withSyntaxFixes } from "./source-fixes-syntax.js";

/**
 * Read the text of one format: `{ deck, findings, notes? }` on success, `{ syntax: true, findings }` when it cannot be read. `findings` carry the
 * syntax errors (`kind: "syntax"`) or the OPF findings of the parsed deck; `notes` are the reader's warnings that come with a deck.
 */
export function readSource(format, text, catalogs) {
  if (format === "json") {
    const problems = analyzeSyntax(text);
    if (problems.length) return { syntax: true, findings: problems.map((problem) => normalizeFinding(problem, "syntax")) };
    const deck = JSON.parse(text);
    const duplicates = findDuplicateKeys(text);
    if (duplicates.length) return { syntax: true, findings: duplicates };
    return { deck, findings: [] };
  }
  const result = format === "yaml" ? fromYaml(text, { catalogs }) : fromMarkdown(text, { catalogs });
  // The reader's own findings: errors stop the document being read; its warnings (a numbered list that became bullets) come with the deck.
  const readerFindings = result.findings.filter((finding) => !finding.ruleId?.startsWith("opf/"));
  const errors = readerFindings.filter((finding) => finding.severity === "error");
  const syntax = (list) => withSyntaxFixes(format, text, list).map((finding) => normalizeFinding(finding, "syntax"));
  if (errors.length) return { syntax: true, findings: syntax(errors) };
  return { deck: result.presentation, findings: result.findings.map((finding) => normalizeFinding(finding, "schema")), notes: syntax(readerFindings) };
}

/**
 * `readSource` plus, when a deck was read, `validation`: the report the editor session computes for that deck (`checkFormat`, with the same
 * catalogs). `validate: false` skips it (the main thread's own path, where the session validates the patch itself).
 */
export function checkSource({ format, text, catalogs, validate = true }) {
  const read = readSource(format, text, catalogs);
  if (validate && read.deck) {
    read.validation = checkFormat(read.deck, { catalogs });
    // What the Markdown writer cannot hold for this deck: the pane lists it after every applied edit, and writing a big deck back is not cheap.
    if (format === "md") read.markdownNotes = markdownNotesOf(read.deck);
  }
  return read;
}

/** The notes about what Markdown cannot hold, as findings, from the report of `toMarkdown`. */
export function markdownNotes(report) {
  const notes = report.embedded.map((part) => normalizeFinding({ path: part.path, message: `Markdown has no syntax for this, so it is kept as YAML in a fenced block (${part.reason}).`, severity: "warning" }, "format"));
  for (const entry of report.loss) {
    const at = entry.indexOf(": ");
    notes.push(normalizeFinding({ path: at > 0 ? entry.slice(0, at) : "", message: `Left out of the Markdown: ${at > 0 ? entry.slice(at + 2) : entry}.`, severity: "warning" }, "format"));
  }
  return notes;
}

/** The Markdown notes of `deck`; none when it cannot be written as Markdown. */
export function markdownNotesOf(deck) {
  try { return markdownNotes(toMarkdown(deck).report); } catch { return []; }
}

/** The syntax problems of a JSON text as findings (the pane's quick pass, 150 ms after the last key). */
export function checkSyntaxOnly(text) {
  return analyzeSyntax(text).map((problem) => normalizeFinding(problem, "syntax"));
}

/**
 * The worker's side of the protocol, free of any worker API so it can be tested in Node. `handle(message)` returns the reply for one message
 * (or null for a message with no reply). Messages: `{ id, type: "catalogs", catalogs }`, `{ id, type: "check", format, text }` and
 * `{ id, type: "syntax", text }`; replies: `{ id, ok: true, result }` or `{ id, ok: false, error }`.
 */
export function createCheckService() {
  let catalogs;
  return {
    handle(message) {
      const id = message?.id;
      try {
        switch (message?.type) {
          case "catalogs": catalogs = message.catalogs; return { id, ok: true, result: null };
          case "check": return { id, ok: true, result: checkSource({ format: message.format, text: message.text, catalogs }) };
          case "syntax": return { id, ok: true, result: checkSyntaxOnly(message.text) };
          default: return { id, ok: false, error: `Unknown message type ${String(message?.type)}.` };
        }
      } catch (error) {
        return { id, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
