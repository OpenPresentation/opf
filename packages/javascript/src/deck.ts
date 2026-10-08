/**
 * One entry point to read and write a deck in any of its three serializations (RR-60): JSON, the canonical and interchange
 * form, and the two authoring forms of the same data, YAML (`.opf.yaml`, RR-56) and Markdown (`.opf.md`, RR-30). `readDeck`
 * turns text into a deck and the `validate` report of it, with every finding located in the text that was read; `writeDeck`
 * turns a deck into text.
 *
 * The format comes from the `format` option, else from the file name, and never from the content: a string that starts with
 * `{` is JSON only because JSON is the default. No renderer, fonts, DOM, network or model calls, and no Node APIs, so it runs in
 * a browser. The same input always gives the same output.
 */
import { type Catalog, checkCatalogsOption } from "./catalog-refs.js";
import { parseSource } from "./check-source.js";
import type { Finding } from "./generated/types/finding.js";
import { fromMarkdown, toMarkdown } from "./markdown.js";
import { NOT_CHECKED } from "./not-checked.js";
import type { Presentation } from "./types.js";
import { type ValidateOptions, type ValidationReport, validate } from "./validator.js";
import { fromYaml, toYaml } from "./yaml.js";

/** The serializations of a deck: `json` (canonical), `yaml` (`.opf.yaml`) and `markdown` (`.opf.md`). */
export type DeckFormat = "json" | "yaml" | "markdown";

/** Every deck format, in the order JSON, YAML, Markdown. */
export const DECK_FORMATS: readonly DeckFormat[] = ["json", "yaml", "markdown"];

/**
 * The format a file name stands for: `.opf.md` is Markdown, `.yaml` and `.yml` are YAML (any case), every other name is JSON.
 * A plain `.md` file is not a deck: it is Markdown that `fromMarkdown` converts when asked, so it is never detected.
 */
export function deckFormatOf(filename: string | undefined): DeckFormat {
  if (filename === undefined) return "json";
  if (/\.opf\.md$/i.test(filename)) return "markdown";
  if (/\.ya?ml$/i.test(filename)) return "yaml";
  return "json";
}

function resolveFormat(caller: string, options: { format?: DeckFormat; filename?: string }): DeckFormat {
  if (options.format === undefined) return deckFormatOf(options.filename);
  if (!DECK_FORMATS.includes(options.format)) throw new TypeError(`${caller}: unknown format ${JSON.stringify(options.format)}. Formats: ${DECK_FORMATS.join(", ")}.`);
  return options.format;
}

export interface ReadDeckOptions {
  /** The format of the text. Wins over `filename`. */
  format?: DeckFormat;
  /** The file name, for the format only: `.opf.md` is Markdown, `.yaml` and `.yml` are YAML, anything else is JSON. The content is never sniffed. */
  filename?: string;
  /** Catalogs the host registered, for the references check. Nothing is fetched. */
  catalogs?: readonly Catalog[];
  /**
   * Check the deck with `validate` and locate its findings in the text: `true` (the default) checks `format` and `references`;
   * options pick other rules or categories (`{}` runs every rule; `catalogs` above is added when the options name none);
   * `false` skips the check, so only syntax errors are reported and `schemaValid` is null.
   */
  validate?: boolean | ValidateOptions;
}

/**
 * The deck read from the text with the `validate` report of it (`valid`, `schemaValid`, `checks`, `findings`, `counts`, and
 * `template` and `unfilledVariables` for a deck with content variables), the same whatever the format.
 */
export interface ReadDeckResult extends ValidationReport {
  /** The deck. Always a value; when `valid` is false it is a best effort (an empty object after a syntax error). */
  presentation: Presentation;
  /** The format the text was read as. */
  format: DeckFormat;
}

/**
 * Read a deck from JSON, YAML or Markdown text. Never throws for malformed content; read `valid` and `findings`. The findings
 * of a YAML or Markdown deck carry `location` (the UTF-16 offset and length, one-based line and column of the text that caused
 * them, a validation finding mapped to the field it names); so do those of a JSON deck. A JSON syntax error is `opf/json-syntax`,
 * a YAML one `yaml/<rule>` and a Markdown one `markdown/<rule>`. Throws a `TypeError` for text that is not a string, a format
 * that is none of the three, or a bad option.
 */
export function readDeck(text: string, options: ReadDeckOptions = {}): ReadDeckResult {
  if (typeof text !== "string") throw new TypeError("readDeck expects a string.");
  checkCatalogsOption(options.catalogs, "readDeck");
  const format = resolveFormat("readDeck", options);
  const { catalogs } = options;
  const check = options.validate ?? true;
  // `validate` options carry their own catalogs; the readDeck option fills in when they name none.
  const validateOptions: ValidateOptions = typeof check === "object" ? { ...(catalogs && check.catalogs === undefined ? { catalogs } : {}), ...check } : { only: ["format", "references"], ...(catalogs ? { catalogs } : {}) };
  const checked = check === false ? false : validateOptions;
  if (format === "yaml") return { ...fromYaml(text, { validate: checked, catalogs }), format };
  if (format === "markdown") return { ...fromMarkdown(text, { validate: checked, catalogs }), format };

  if (checked === false) {
    const parsed = parseSource(text);
    return { ...report(parsed.syntax), presentation: (parsed.syntax.length ? {} : parsed.value) as Presentation, format };
  }
  const result = validate(text, checked);
  const broken = result.findings.some((found) => found.ruleId === "opf/json-syntax");
  return { ...result, presentation: (broken ? {} : JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)) as Presentation, format };
}

function report(findings: Finding[]): ValidationReport {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const found of findings) counts[found.severity]++;
  return { valid: counts.error === 0, schemaValid: null, findings, counts, checks: NOT_CHECKED };
}

export interface WriteDeckOptions {
  /** The format to write. Wins over `filename`. */
  format?: DeckFormat;
  /** The file name the text is for, for the format only (see `readDeck`). */
  filename?: string;
  /** YAML: start with `# yaml-language-server: $schema=...` so editors validate and complete the file. */
  schemaComment?: boolean;
}

/**
 * Write a deck as text: JSON as two-space JSON with a final newline, YAML in canonical form (`toYaml`) and Markdown in canonical
 * form (`toMarkdown`, with anything the dialect has no syntax for embedded in `opf-slide` and `opf-block` fences so nothing is
 * lost). `readDeck` reads each result back to the same deck. YAML and Markdown throw `OPFYamlError` or `OPFMarkdownError`
 * (`invalid-document`) for a document that is not valid OPF; JSON writes whatever it is given.
 */
export function writeDeck(presentation: unknown, options: WriteDeckOptions = {}): string {
  const format = resolveFormat("writeDeck", options);
  if (format === "yaml") return toYaml(presentation, { schemaComment: options.schemaComment === true }).yaml;
  if (format === "markdown") return toMarkdown(presentation).markdown;
  return `${JSON.stringify(presentation, null, 2)}\n`;
}
