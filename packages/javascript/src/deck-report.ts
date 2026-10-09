// The deck reader behind `parse` (deck.ts) and `@openpresentation/opf/node`, which never throws for content: the deck and the
// `validate` report of it, every finding located in the text. It is not a package entry: `parse` is the public reader.
// No Node APIs, so it runs in a browser.
import { type Catalog, checkCatalogsOption } from "./catalog-refs.js";
import { parseSource } from "./check-source.js";
import type { Finding } from "./generated/types/finding.js";
import { fromMarkdown } from "./markdown.js";
import { NOT_CHECKED } from "./not-checked.js";
import type { Presentation } from "./types.js";
import { type ValidateOptions, type ValidationReport, validate } from "./validator.js";
import { fromYaml } from "./yaml.js";

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

export function resolveFormat(caller: string, options: { format?: DeckFormat; filename?: string }): DeckFormat {
  if (options.format === undefined) return deckFormatOf(options.filename);
  if (!DECK_FORMATS.includes(options.format)) throw new TypeError(`${caller}: unknown format ${JSON.stringify(options.format)}. Formats: ${DECK_FORMATS.join(", ")}.`);
  return options.format;
}

/** Where a deck's text comes from: its format, or the file name that names it, and the catalogs its references resolve in. */
export interface ParseOptions {
  /** The format of the text. Wins over `filename`. */
  format?: DeckFormat;
  /** The file name, for the format only: `.opf.md` is Markdown, `.yaml` and `.yml` are YAML, anything else is JSON. The content is never sniffed. */
  filename?: string;
  /** Catalogs the host registered, for the references check. Nothing is fetched. */
  catalogs?: readonly Catalog[];
}

/** The options of `readDeckReport`: `parse`'s, plus the check to run. */
export interface DeckReportOptions extends ParseOptions {
  /** `true` (the default) checks `format` and `references`; options pick other rules; `false` reports only syntax errors. */
  validate?: boolean | ValidateOptions;
}

/** A deck read from text with the report of its check, whatever the format. */
export interface DeckReport extends ValidationReport {
  /** The deck; a best effort (an empty object after a syntax error) when `valid` is false. */
  presentation: Presentation;
  format: DeckFormat;
}

/**
 * The reader behind `parse` that never throws for content: the deck and the `validate` report of it, every finding
 * located in the text. Not exported from the package entries; `@openpresentation/opf/node` and `parse` use it.
 */
export function readDeckReport(text: string, options: DeckReportOptions = {}, caller = "parse"): DeckReport {
  if (typeof text !== "string") throw new TypeError(`${caller} expects a string.`);
  checkCatalogsOption(options.catalogs, caller);
  const format = resolveFormat(caller, options);
  const { catalogs } = options;
  const check = options.validate ?? true;
  // `validate` options carry their own catalogs; the catalogs option fills in when they name none.
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

