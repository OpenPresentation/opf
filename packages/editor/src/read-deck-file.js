// RR-98: read a deck file of any OPF source format. `readDeckFile(file | { name, text })` detects JSON, YAML or Markdown (the extension decides
// first, then the content), converts YAML and Markdown with core's browser-safe `fromYaml` and `fromMarkdown` (`@openpresentation/opf/yaml`, `/markdown`,
// loaded on first use) and returns `{ document, format, name, findings }`. Plain functions, no DOM, no network. A host's Open button passes
// `DECK_FILE_ACCEPT` to `<input accept>` and the chosen file to `readDeckFile`.
import { MAX_OPF_BYTES, unwrapOpf } from "./transfer.js";

/** The `accept` value for a file input that opens a deck: JSON (`.json`, `.opf`), YAML and Markdown. */
export const DECK_FILE_ACCEPT = ".json,.opf,.yaml,.yml,.md";

/** Raised by `readDeckFile`. `code` says why; `format` is the format that was tried first; `findings` holds the parser's findings, if any. */
export class DeckFileError extends Error {
  constructor(code, message, { format, name, findings = [], cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "DeckFileError";
    this.code = code;
    this.format = format;
    this.fileName = name;
    this.findings = findings;
  }
}

const YAML_EXTENSIONS = /\.(?:ya?ml)$/i;
const MARKDOWN_EXTENSIONS = /\.(?:md|markdown)$/i;
const COMPOUND = /\.opf\.(?:json|ya?ml|md|markdown)$/i;
const PLAIN = /\.(?:json|opf|ya?ml|md|markdown)$/i;
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const stripBom = (text) => text.replace(/^﻿/, "");

/** The file name without its directory and its `.opf.json`, `.opf.yaml`, `.opf.md` or plain extension. */
export function deckFileName(fileName) {
  const base = String(fileName ?? "").split(/[\\/]/).pop().trim();
  const stripped = base.replace(COMPOUND, "").replace(PLAIN, "");
  const name = stripped !== base ? stripped : base.replace(/(?<=.)\.[A-Za-z0-9]{1,8}$/, "");
  return name || "deck";
}

/** The format the extension suggests: `.yaml` and `.yml` are YAML, `.md` Markdown, and `.json`, `.opf` or anything else JSON. */
export function deckFileFormat(fileName) {
  const name = String(fileName ?? "");
  return YAML_EXTENSIONS.test(name) ? "yaml" : MARKDOWN_EXTENSIONS.test(name) ? "md" : "json";
}

const hasFrontMatter = (text) => /^---[ \t]*\r?\n/.test(stripBom(text).replace(/^\s*(?=---)/, ""));
const looksBinary = (text) => text.startsWith("PK\u0003\u0004") || text.includes("\u0000");

function failure(code, message, context, extra) {
  return new DeckFileError(code, message, { ...context, ...extra });
}

async function readSource(input) {
  if (input === null || typeof input !== "object") throw failure("unreadable", "Choose a deck file to open.", {});
  const name = typeof input.name === "string" ? input.name : "";
  const context = { name };
  if (typeof input.size === "number" && input.size > MAX_OPF_BYTES) throw failure("file-too-large", "Choose a file smaller than 20 MB.", context);
  let text = input.text;
  try {
    if (typeof text === "function") text = await input.text();
  } catch (cause) {
    throw failure("unreadable", `${name || "The file"} could not be read.${cause?.message ? ` ${cause.message}` : ""}`, context, { cause });
  }
  if (typeof text !== "string") throw failure("unreadable", "Pass a File, or { name, text } with the file's text.", context);
  if (new TextEncoder().encode(text).length > MAX_OPF_BYTES) throw failure("file-too-large", "Choose a file smaller than 20 MB.", context);
  return { name, text: stripBom(text), context };
}

function readJson(text, context) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw failure("invalid-json", `This is not valid JSON: ${cause.message}`, context, { format: "json", cause });
  }
  const document = unwrapOpf(value);
  if (!isObject(document) || !Array.isArray(document.slides)) {
    throw failure("not-a-deck", "This JSON is not an OPF deck: a deck has a \"slides\" list.", context, { format: "json" });
  }
  return { document, findings: [] };
}

// A conversion result as a deck, or a typed error when the text itself could not be read (a syntax or dialect error, not an OPF finding).
function fromConversion(result, format, context) {
  const findings = result.findings ?? [];
  const syntax = findings.filter((finding) => finding.severity === "error" && !String(finding.ruleId ?? "").startsWith("opf/"));
  if (syntax.length) {
    const first = syntax[0];
    const place = first.location?.line ? ` (line ${first.location.line})` : "";
    throw failure(format === "yaml" ? "invalid-yaml" : "invalid-markdown", `This is not valid ${format === "yaml" ? "YAML" : "Markdown"}${place}: ${first.message}`, context, { format, findings });
  }
  return { document: result.presentation, findings };
}

async function convert(format, text, options, context) {
  if (format === "yaml") {
    const { fromYaml } = await import("@openpresentation/opf/yaml");
    return fromConversion(fromYaml(text, { catalogs: options.catalogs }), "yaml", context);
  }
  const { fromMarkdown } = await import("@openpresentation/opf/markdown");
  return fromConversion(fromMarkdown(text, { catalogs: options.catalogs }), "md", context);
}

/**
 * Read a deck file. `file` is a `File` (or anything with `name` and `text()`), or `{ name, text }` with the text as a string.
 *
 * The extension picks the format: `.yaml` and `.yml` are YAML, `.md` is Markdown, and `.json`, `.opf` or anything else is JSON. Text that is not
 * valid JSON is then tried as YAML, and as Markdown when it starts with front matter (`---`). The result is
 * `{ document, format: "json" | "yaml" | "md", name, findings }`: `format` is the one that read it, `name` is the file name without
 * `.opf.json`, `.opf.yaml`, `.opf.md` or its plain extension, and `findings` are the conversion findings of YAML and Markdown (core's
 * `Finding`, each with a JSON Pointer `path` and a `location` in the text; JSON gives none). A deck that reads but has OPF errors is returned,
 * with those findings; text that cannot be read at all throws `DeckFileError`.
 *
 * `options.catalogs`: the host's catalogs, for the references check of the YAML and Markdown conversion.
 */
export async function readDeckFile(file, options = {}) {
  const { name: fileName, text, context } = await readSource(file);
  const name = deckFileName(fileName);
  const chosen = deckFileFormat(fileName);
  const done = (format, read) => ({ document: read.document, format, name, findings: read.findings });
  if (!text.trim()) throw failure("empty-file", `${fileName || "The file"} is empty.`, context, { format: chosen });
  if (looksBinary(text)) throw failure("unsupported-file", "This looks like a PowerPoint or other binary file, not an OPF deck. Open a .json, .yaml or .md deck.", context, { format: chosen });

  if (chosen === "yaml") return done("yaml", await convert("yaml", text, options, context));
  if (chosen === "md") return done("md", await convert("md", text, options, context));

  let jsonError;
  try {
    return done("json", readJson(text, context));
  } catch (error) {
    // A parsed value that is not a deck is a real answer. Only text that is not JSON falls through to the other formats.
    if (error.code !== "invalid-json") throw error;
    jsonError = error;
  }
  try {
    const read = await convert("yaml", text, options, context);
    if (isObject(read.document) && Array.isArray(read.document.slides)) return done("yaml", read);
  } catch (error) {
    if (!(error instanceof DeckFileError)) throw error;
  }
  if (hasFrontMatter(text)) {
    try { return done("md", await convert("md", text, options, context)); } catch (error) { if (!(error instanceof DeckFileError)) throw error; }
  }
  throw failure("invalid-json", `${jsonError.message} It is not valid YAML${hasFrontMatter(text) ? " or Markdown" : ""} either.`, context, { format: "json", cause: jsonError.cause });
}
