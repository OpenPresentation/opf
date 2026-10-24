// Reading Markdown into a document and the source ranges of its parts, before any validation. Internal module: `fromMarkdown` validates
// the result; `locate` and `pathAt` of `@openpresentation/opf/source` use the ranges alone.
import type { Obj } from "../convert/shared.js";
import { type ParseOptions, emptySegment, frontMatter, isOutline, parseSlide, readYamlMapping, splitSegments } from "./parse.js";
import { Ctx, type Line, type Range, lineRange, splitLines } from "./support.js";

export interface ReadMarkdownOptions extends ParseOptions {
  /** Deck properties used when the front matter does not set them. The front matter wins. */
  defaults?: Record<string, unknown>;
}

export interface MarkdownRead {
  ctx: Ctx;
  /** The deck, with `slides` (a best effort when the Markdown has errors). */
  document: Obj;
  /** The range of the YAML between the front matter lines, when the text opens with front matter. */
  front?: Range;
  /** The lines of the slide segments that were read as slides, by slide index. */
  segments: Line[][];
}

/** Read Markdown in the dialect: the deck, the syntax findings and `ctx.ranges` (JSON Pointer to source range). Never throws for malformed content. */
export function readMarkdown(source: string, options: ReadMarkdownOptions = {}): MarkdownRead {
  const ctx = new Ctx(source);
  let lines = splitLines(source);
  if (lines[0]?.text.startsWith("﻿")) lines = [{ ...lines[0], text: lines[0].text.slice(1), start: lines[0].start + 1 }, ...lines.slice(1)];
  const front: Obj = {};
  let body = lines;
  let frontRange: Range | undefined;
  const matter = frontMatter(lines);
  if (matter === "unterminated") {
    ctx.error("front-matter-unterminated", "The front matter starting on line 1 is not closed.", "Close it with a line containing only ---, or remove the opening --- (a deck without front matter starts with its first slide).", lineRange(lines[0]!), "");
    body = lines.slice(1);
  } else if (matter) {
    const range = { start: matter.yaml.start, end: matter.yaml.end };
    frontRange = range;
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
  // `auto` (RR-75): an outline (no `---` line, two or more `# ` headings outside fences, comments and notes) is cut at its headings.
  const split = options.split ?? "auto";
  const segments = splitSegments(body, split === "headings" || (split === "auto" && isOutline(body)) ? "headings" : "rules");
  const slides: Obj[] = [];
  const kept: Line[][] = [];
  segments.forEach((segment, index) => {
    if (emptySegment(segment)) {
      const edge = index === 0 || index === segments.length - 1;
      if (!edge) {
        const around = segment[0] ?? segments[index + 1]?.[0] ?? segments[index - 1]?.at(-1);
        if (around) ctx.warn("empty-slide", "Two --- lines in a row give an empty slide, which was skipped.", "Remove the extra ---, or write <!-- slide --> to keep an empty slide.", lineRange(around));
      }
      return;
    }
    kept.push(segment);
    slides.push(parseSlide(ctx, segment, slides.length));
  });
  document.slides = slides;
  return { ctx, document, ...(frontRange ? { front: frontRange } : {}), segments: kept };
}
