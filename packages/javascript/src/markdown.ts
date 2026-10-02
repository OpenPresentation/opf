/**
 * Deterministic Markdown to OPF and OPF to Markdown conversion for the OPF Markdown dialect (RR-30): YAML front
 * matter for deck metadata, `---` between slides, `#` title, `##` subtitle, paragraphs, lists, block quotes with
 * a dash attribution, fenced code, pipe tables, images, `chart`, `metric` and `timeline` fences, `Note:` speaker
 * notes and HTML comments for slide and block options. Anything the dialect has no syntax for is embedded as YAML
 * (`opf-slide`, `opf-block`) so a round trip loses nothing, or dropped and reported on request.
 *
 * No renderer, fonts, DOM, network or model calls. The same input always gives the same output.
 */
import { type Obj, same } from "./convert/shared.js";
import { lintPresentation } from "./lint.js";
import type { LintSeverity } from "./lint.js";
import type { Presentation } from "./types.js";
import { validatePresentation } from "./validator.js";
import { type EmbeddedPart, emitSlide } from "./markdown/emit.js";
import { type ParseOptions, emptySegment, frontMatter, parseSlide, readYamlMapping, splitSegments } from "./markdown/parse.js";
import { Ctx, type MarkdownDiagnostic, OPFMarkdownError, lineRange, splitLines, writeYaml } from "./markdown/support.js";

export { OPFMarkdownError } from "./markdown/support.js";
export type { MarkdownDiagnostic } from "./markdown/support.js";
export type { EmbeddedPart } from "./markdown/emit.js";

export interface MarkdownToOpfOptions extends ParseOptions {
  /** Deck properties used when the front matter does not set them (for example `{ name: "Title" }`). The front matter wins. */
  defaults?: Record<string, unknown>;
  /** Run the OPF lint over the result and map its findings to Markdown line and column (default true). */
  validate?: boolean;
}

export interface MarkdownToOpfResult {
  /** The converted deck. Always an object; when `valid` is false it is a best effort that does not validate. */
  document: Presentation;
  /** True when there are no errors (Markdown syntax errors and OPF validation errors both count). */
  valid: boolean;
  /** Lint-shaped diagnostics, in source order, each with `location` (UTF-16 offset and length, one-based line and column). */
  diagnostics: MarkdownDiagnostic[];
  counts: Record<LintSeverity, number>;
}

/** Convert Markdown in the OPF dialect to an OPF document. Never throws for malformed content; read `valid` and `diagnostics`. */
export function markdownToOpf(markdown: string, options: MarkdownToOpfOptions = {}): MarkdownToOpfResult {
  if (typeof markdown !== "string") throw new TypeError("markdownToOpf expects a string.");
  const source = markdown;
  const ctx = new Ctx(source);
  let lines = splitLines(source);
  if (lines[0]?.text.startsWith("﻿")) lines = [{ ...lines[0], text: lines[0].text.slice(1), start: lines[0].start + 1 }, ...lines.slice(1)];
  const front: Obj = {};
  let body = lines;
  const matter = frontMatter(lines);
  if (matter === "unterminated") {
    ctx.error("front-matter-unterminated", "The front matter starting on line 1 is not closed.", "Close it with a line containing only ---, or remove the opening --- (a deck without front matter starts with its first slide).", lineRange(lines[0]!));
    body = lines.slice(1);
  } else if (matter) {
    const range = { start: matter.yaml.start, end: matter.yaml.end };
    const parsed = readYamlMapping(source.slice(range.start, range.end), range.start, ctx, "front-matter", range);
    ctx.ranges.set("", range);
    if (parsed.ok && !Object.keys(parsed.value).length && source.slice(range.start, range.end).trim()) ctx.warn("front-matter-comments", "The text between the first two --- lines is only YAML comments, so it was not read as slide content.", "A deck that starts with a slide must not start with a --- line: only front matter may open the file. Remove the first --- or add the deck properties.", range);
    for (const [key, value] of Object.entries(parsed.value)) {
      if (key === "slides") ctx.error("front-matter-slides", "The front matter cannot hold `slides`: slides are the Markdown that follows it.", "Remove the slides key and write the slides below the front matter, separated by ---.", parsed.keys.get("slides") ?? range, "/slides");
      else Object.defineProperty(front, key, { value, enumerable: true, writable: true, configurable: true });
    }
    for (const [key, found] of parsed.keys) ctx.ranges.set(`/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, found);
    body = lines.slice(matter.end);
  }

  const document: Obj = { ...(options.defaults ?? {}), ...front };
  const segments = splitSegments(body, options.split ?? "rules");
  const slides: Obj[] = [];
  segments.forEach((segment, index) => {
    if (emptySegment(segment)) {
      const edge = index === 0 || index === segments.length - 1;
      if (!edge) {
        const around = segment[0] ?? segments[index + 1]?.[0] ?? segments[index - 1]?.at(-1);
        if (around) ctx.warn("empty-slide", "Two --- lines in a row give an empty slide, which was skipped.", "Remove the extra ---, or write <!-- slide --> to keep an empty slide.", lineRange(around));
      }
      return;
    }
    slides.push(parseSlide(ctx, segment, slides.length));
  });
  document.slides = slides;

  if (!slides.length) ctx.error("no-slides", "The Markdown has no slides.", "Write at least one slide: a # title or any content, with --- between slides.", { start: 0, end: Math.min(1, source.length) }, "/slides");
  else if (options.validate !== false) {
    for (const found of lintPresentation(document).diagnostics) {
      const range = ctx.rangeOf(found.path) ?? ctx.rangeOf("") ?? { start: 0, end: 0 };
      ctx.diagnostics.push({ ...found, location: ctx.location(range) });
    }
  }
  const diagnostics = [...ctx.diagnostics].sort((a, b) => a.location.offset - b.location.offset);
  const counts: Record<LintSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const diagnostic of diagnostics) counts[diagnostic.severity]++;
  return { document: document as unknown as Presentation, valid: counts.error === 0, diagnostics, counts };
}

export interface OpfToMarkdownOptions {
  /**
   * What to do with a part that has no Markdown syntax (a design, region keys, a styled table cell, a nested group).
   * `embed` (default) writes it as YAML in an `opf-slide` or `opf-block` fence so nothing is lost; `drop` leaves it out
   * and reports it in `loss`, for Markdown meant to be read rather than converted back.
   */
  unsupported?: "embed" | "drop";
}

export interface OpfToMarkdownResult {
  markdown: string;
  report: {
    /** True when everything in the document is in the Markdown (natively or embedded). False only in `drop` mode, when `loss` is not empty. */
    lossless: boolean;
    /** True when nothing needed embedding or dropping: the Markdown is plain dialect syntax throughout. */
    native: boolean;
    /** Parts written as YAML because the dialect has no syntax for them (`embed` mode), with a JSON Pointer and the reason. */
    embedded: EmbeddedPart[];
    /** Parts left out (`drop` mode), as `<JSON Pointer>: <reason>`. Empty when lossless. */
    loss: string[];
  };
}

/**
 * Convert an OPF document to Markdown in the dialect. For a document the dialect fully expresses,
 * `markdownToOpf(opfToMarkdown(doc).markdown).document` is the same deck; the Markdown it writes converts back to
 * itself byte for byte. Throws `OPFMarkdownError` (`invalid-document`) when the input is not valid OPF.
 */
export function opfToMarkdown(document: unknown, options: OpfToMarkdownOptions = {}): OpfToMarkdownResult {
  const checked = validatePresentation(document);
  if (!checked.valid) {
    const first = checked.errors[0];
    throw new OPFMarkdownError("invalid-document", `The document is not valid OPF: ${first?.message ?? "unknown error"}${first?.path ? ` (${first.path})` : ""}.`, { issues: checked.errors });
  }
  const mode = options.unsupported === "drop" ? "drop" : "embed";
  const { slides, ...rest } = document as Obj;
  const parts: string[] = [];
  if (Object.keys(rest).length) {
    const yaml = writeYaml(rest);
    if (yaml === undefined) throw new OPFMarkdownError("not-representable", "The deck properties hold a value that YAML cannot carry exactly.");
    if (!same(readBack(yaml), rest)) throw new OPFMarkdownError("not-representable", "The deck properties do not read back from their front matter.");
    parts.push(`---\n${yaml}---\n`);
  }
  const embedded: EmbeddedPart[] = [];
  const loss: string[] = [];
  const bodies: string[] = [];
  (slides as Obj[]).forEach((slide, index) => {
    const out = emitSlide(slide, index, mode);
    embedded.push(...out.embedded);
    loss.push(...out.loss.map((part) => `${part.path}: ${part.message}`));
    bodies.push(out.lines.join("\n"));
  });
  const markdown = `${parts.length ? `${parts[0]}\n` : ""}${bodies.join("\n\n---\n\n")}\n`;
  return { markdown, report: { lossless: loss.length === 0, native: loss.length === 0 && embedded.length === 0, embedded, loss } };
}

function readBack(yaml: string): Obj {
  const ctx = new Ctx(yaml);
  return readYamlMapping(yaml, 0, ctx, "front-matter", { start: 0, end: yaml.length }).value;
}
