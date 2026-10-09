/**
 * One entry point to read and write a deck in any of its three serializations (RR-60): JSON, the canonical and interchange
 * form, and the two authoring forms of the same data, YAML (`.opf.yaml`, RR-56) and Markdown (`.opf.md`, RR-30). `parse`
 * turns text into a deck (a deck that fails the format and references check throws, with every finding located in the text
 * that was read); `stringify` turns a deck into text.
 *
 * The format comes from the `format` option, else from the file name, and never from the content: a string that starts with
 * `{` is JSON only because JSON is the default. No renderer, fonts, DOM, network or model calls, and no Node APIs, so it runs in
 * a browser. The same input always gives the same output.
 */
import { type DeckFormat, type ParseOptions, readDeckReport, resolveFormat } from "./deck-report.js";
import { toMarkdown } from "./markdown.js";
import type { Presentation } from "./types.js";
import { OPFValidationError } from "./validator.js";
import { toYaml } from "./yaml.js";

export { DECK_FORMATS, deckFormatOf } from "./deck-report.js";
export type { DeckFormat, ParseOptions } from "./deck-report.js";

/**
 * Read a deck from JSON, YAML or Markdown text and return it. The format comes from `format`, else from `filename`, never from the
 * content. The deck is checked for format and references (in `catalogs`); a syntax, schema or reference error throws
 * `OPFValidationError`, whose `report.findings` carry `location` (the UTF-16 offset and length, and the one-based line and column
 * of the text that caused them; a JSON syntax error is `opf/json-syntax`, a YAML one `yaml/<rule>`, a Markdown one
 * `markdown/<rule>`). Warnings do not throw: `validate` reports them. Throws a `TypeError` for text that is not a string, a
 * format that is none of the three, or a bad option.
 */
export function parse(text: string, options: ParseOptions = {}): Presentation {
  const { presentation, format: _format, ...result } = readDeckReport(text, { ...options, validate: true }, "parse");
  if (!result.valid) throw new OPFValidationError(result);
  return presentation;
}

export interface StringifyOptions {
  /** The format to write. Wins over `filename`. */
  format?: DeckFormat;
  /** The file name the text is for, for the format only (see `parse`). */
  filename?: string;
  /** YAML: start with `# yaml-language-server: $schema=...` so editors validate and complete the file. */
  schemaComment?: boolean;
}

/**
 * Write a deck as text: JSON as two-space JSON with a final newline, YAML in canonical form (`toYaml`) and Markdown in canonical
 * form (`toMarkdown`, with anything the dialect has no syntax for embedded in `opf-slide` and `opf-block` fences so nothing is
 * lost). `parse` reads each result back to the same deck. YAML and Markdown throw `OPFYamlError` or `OPFMarkdownError`
 * (`invalid-document`) for a document that is not valid OPF; JSON writes whatever it is given.
 */
export function stringify(presentation: unknown, options: StringifyOptions = {}): string {
  const format = resolveFormat("stringify", options);
  if (format === "yaml") return toYaml(presentation, { schemaComment: options.schemaComment === true }).yaml;
  if (format === "markdown") return toMarkdown(presentation).markdown;
  return `${JSON.stringify(presentation, null, 2)}\n`;
}
