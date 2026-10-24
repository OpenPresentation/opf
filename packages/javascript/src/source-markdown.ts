// The OPF Markdown dialect as an editor sees it (`@openpresentation/opf/source`): `scanMarkdown` finds the front matter, the slides, the options
// comments, the fences and the speaker notes of a text with the converter's own line rules, and `locateMarkdown` / `pathAtMarkdown` map between
// JSON Pointers and offsets using the ranges the converter records while it reads (the ranges findings are located by). Internal module.
import { FENCE_KINDS, type FenceKind, SLIDE_OPTION_KEYS } from "./markdown/dialect.js";
import { COMMENT, NOTES, fenceClose, fenceStart, frontMatter, isOutline, splitSegments } from "./markdown/parse.js";
import { readMarkdown as readUncached } from "./markdown/read.js";
import { rememberByText } from "./source-text.js";
import { type Line, type Range, splitLines } from "./markdown/support.js";
import { type YamlPart, type Span, locateYaml, pathAtYaml } from "./source-yaml.js";

/** A range of the text: UTF-16 offsets, `from` inclusive and `to` exclusive, and the one-based line `from` is on. */
export interface ScanRange {
  from: number;
  to: number;
  line: number;
}

export interface MarkdownFrontMatter extends ScanRange {
  /** The YAML between the two `---` lines: from the end of the opening line to the start of the closing line. */
  yamlFrom: number;
  yamlTo: number;
  /** False when the closing `---` (or `...`) line is missing: then the YAML runs to the end of the text. */
  closed: boolean;
}

export interface MarkdownSlideScan extends ScanRange {
  /** The slide's number in the converted deck (empty segments between `---` lines are not slides). */
  index: number;
}

export interface MarkdownCommentScan extends ScanRange {
  /** `slide` and `block` are options comments (`<!-- slide: ... -->`), `comment` any other. */
  kind: "slide" | "block" | "comment";
  /** The text between `<!--` and `-->` (for an unclosed comment, to the end of its last line). */
  innerFrom: number;
  innerTo: number;
  closed: boolean;
  /** The slide it is in. */
  slide: number;
}

export interface MarkdownFenceScan extends ScanRange {
  /** The opening fence characters (```` ``` ````, `~~~~`). */
  marker: string;
  /** The info string after the fence characters, trimmed; `infoFrom` and `infoTo` are its offsets. */
  info: string;
  infoFrom: number;
  infoTo: number;
  /** The first word of the info string. */
  word: string;
  /** `chart`, `metric`, `timeline`, `opf-block`, `opf-slide`, or `code` for any other fence. */
  kind: FenceKind | "code";
  /** The lines between the fences: `bodyFrom` is the start of the first line, `bodyTo` the end of the last (equal when the body is empty). */
  bodyFrom: number;
  bodyTo: number;
  closed: boolean;
  slide: number;
}

export interface MarkdownNotesScan extends ScanRange {
  slide: number;
}

export interface MarkdownScan {
  frontMatter?: MarkdownFrontMatter;
  /** The slides, in order; each runs from its first to its last non-blank line. */
  slides: MarkdownSlideScan[];
  /** Offsets of the `---` lines that separate slides. */
  separators: number[];
  comments: MarkdownCommentScan[];
  fences: MarkdownFenceScan[];
  /** Speaker notes: from the `Note:` or `Notes:` line to the end of the slide. */
  notes: MarkdownNotesScan[];
}

export interface ScanMarkdownOptions {
  /** How the text is cut into slides, as for `fromMarkdown`. */
  split?: "auto" | "rules" | "headings";
}

const BLANK = /^\s*$/;
// The ranges the converter records for a text (`locate` and `pathAt` ask for them once per finding or hover) and its scan.
const readMarkdown = rememberByText((text: string) => readUncached(text));
const scanMemo = rememberByText((text: string) => scanUncached(text));
const isFenceKind = (word: string): word is FenceKind => (FENCE_KINDS as readonly string[]).includes(word);

/**
 * The structure of a Markdown deck, found with the converter's line rules: front matter, slides, option comments, fences and notes, as
 * offset ranges. Tolerant: an unclosed front matter, comment or fence is reported with `closed: false` and runs to the end of its slide.
 * It is the one place an editor learns the dialect's regions from.
 */
export function scanMarkdown(source: string, options: ScanMarkdownOptions = {}): MarkdownScan {
  return options.split === undefined ? scanMemo(source) : scanUncached(source, options);
}

function scanUncached(source: string, options: ScanMarkdownOptions = {}): MarkdownScan {
  let lines = splitLines(source);
  if (lines[0]?.text.startsWith("﻿")) lines = [{ ...lines[0], text: lines[0].text.slice(1), start: lines[0].start + 1 }, ...lines.slice(1)];
  const scan: MarkdownScan = { slides: [], separators: [], comments: [], fences: [], notes: [] };
  const matter = frontMatter(lines);
  let body = lines;
  if (matter === "unterminated") {
    const first = lines[0]!;
    scan.frontMatter = { from: first.start, to: source.length, line: 1, yamlFrom: first.end, yamlTo: source.length, closed: false };
    body = lines.slice(1);
  } else if (matter) {
    const closing = lines[matter.end - 1]!;
    scan.frontMatter = { from: lines[0]!.start, to: closing.end, line: 1, yamlFrom: matter.yaml.start, yamlTo: matter.yaml.end, closed: true };
    body = lines.slice(matter.end);
  }
  const split = options.split ?? "auto";
  const segments = splitSegments(body, split === "headings" || (split === "auto" && isOutline(body)) ? "headings" : "rules");
  const inSegment = new Set(segments.flat());
  for (const line of body) if (!inSegment.has(line) && !BLANK.test(line.text)) scan.separators.push(line.start);
  let index = 0;
  for (const segment of segments) {
    const first = segment.find((line) => !BLANK.test(line.text));
    if (!first) continue;
    const last = [...segment].reverse().find((line) => !BLANK.test(line.text))!;
    scan.slides.push({ index, from: first.start, to: last.end, line: first.no });
    scanSegment(segment, index, scan);
    index++;
  }
  return scan;
}

function scanSegment(lines: Line[], slide: number, scan: MarkdownScan): void {
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const text = line.text;
    if (BLANK.test(text)) { i++; continue; }
    if (NOTES.test(text)) {
      scan.notes.push({ from: line.start, to: lines.at(-1)!.end, line: line.no, slide });
      return;
    }
    const open = fenceStart(text);
    if (open) {
      const close = fenceClose(open.fence);
      let end = i + 1;
      while (end < lines.length && !close.test(lines[end]!.text)) end++;
      const closed = end < lines.length;
      const last = closed ? lines[end]! : lines.at(-1)!;
      const indent = /^ */.exec(text)![0].length;
      const marker = open.fence;
      const infoFrom = line.start + indent + marker.length + (/^[ \t]*/.exec(text.slice(indent + marker.length))![0].length);
      const word = /^[^\s{]*/.exec(open.info)![0];
      const bodyLines = lines.slice(i + 1, closed ? end : lines.length);
      scan.fences.push({
        from: line.start, to: last.end, line: line.no, marker, info: open.info, infoFrom, infoTo: infoFrom + open.info.length, word,
        kind: isFenceKind(word) ? word : "code",
        bodyFrom: bodyLines[0]?.start ?? line.end, bodyTo: bodyLines.at(-1)?.end ?? line.end, closed, slide,
      });
      i = closed ? end + 1 : lines.length;
      continue;
    }
    if (COMMENT.test(text)) {
      let end = i;
      while (end < lines.length && !lines[end]!.text.includes("-->", end === i ? lines[end]!.text.indexOf("<!--") + 4 : 0)) end++;
      const closed = end < lines.length;
      const last = closed ? lines[end]! : lines.at(-1)!;
      const open = text.indexOf("<!--");
      const innerFrom = line.start + open + 4;
      const closeAt = closed ? last.start + last.text.indexOf("-->", end === i ? open + 4 : 0) : last.end;
      const inner = source(lines, i, closed ? end : lines.length - 1).slice(open + 4);
      const kind = /^\s*(slide|block)(?::|(?=\s*(?:-->|$)))/.exec(inner);
      scan.comments.push({ from: line.start, to: closed ? closeAt + 3 : last.end, line: line.no, kind: (kind?.[1] as "slide" | "block" | undefined) ?? "comment", innerFrom, innerTo: closeAt, closed, slide });
      i = closed ? end + 1 : lines.length;
      continue;
    }
    i++;
  }
}

// The text of lines `first` to `last`, joined with the line breaks as one space: enough to read what a comment starts with.
function source(lines: Line[], first: number, last: number): string {
  return lines.slice(first, last + 1).map((line) => line.text).join(" ");
}

// ---- JSON Pointer <-> offset ---------------------------------------------------------------------------------------------------

const segmentsOfPointer = (path: readonly string[]): string => path.map((segment) => `/${segment.replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
const SLIDE_OPTIONS = new Set<string>(SLIDE_OPTION_KEYS);
const OPTIONS_COMMENT = /^\s*<!--/;

export interface MarkdownLocateResult extends Span {
  exact: boolean;
}

/** The first line of a range, without its line break. */
function firstLine(text: string, range: Range): Span {
  const end = text.slice(range.start, range.end).search(/[\r\n]/);
  return { offset: range.start, length: end < 0 ? range.end - range.start : end };
}

/** The `key=value` option of an options comment: the key, the value (quotes included) and both together. */
function optionToken(text: string, comment: Range, key: string, nth = 0): { key: Span; value?: Span; entry: Span } | undefined {
  const inner = text.slice(comment.start, comment.end);
  const open = inner.indexOf("<!--");
  const colon = inner.indexOf(":", open);
  const from = colon < 0 ? open + 4 : colon + 1;
  const pattern = /(?:^|[\s,])([A-Za-z][\w-]*)(=("(?:[^"\\]|\\.)*"|[^\s,"]+))?/g;
  const tail = inner.slice(from);
  let seen = 0;
  for (const match of tail.matchAll(pattern)) {
    if (match[1] !== key) continue;
    if (seen++ !== nth) continue;
    const keyStart = comment.start + from + match.index! + match[0].indexOf(match[1]!);
    const keySpan = { offset: keyStart, length: key.length };
    const value = match[3] === undefined ? undefined : { offset: keyStart + key.length + 1, length: match[3].length };
    return { key: keySpan, ...(value ? { value } : {}), entry: { offset: keyStart, length: (value ? value.offset + value.length : keyStart + key.length) - keyStart } };
  }
  return undefined;
}

const MARKER = /^( {0,3}(?:#{1,6}|[-+*]|\d{1,9}[.)])[ \t]+)/;

/** A line that starts with a marker (`# `, `- `, `1. `): the marker and the content after it. */
function afterMarker(text: string, range: Range): { marker: Span; content: Span } | undefined {
  const line = firstLine(text, range);
  const lineText = text.slice(line.offset, line.offset + line.length);
  const match = MARKER.exec(lineText);
  if (!match) return undefined;
  const lead = match[1]!;
  const markerLength = lead.trimEnd().length;
  const content = lineText.slice(lead.length);
  const trimmed = content.replace(/(?:^|[ \t]+)#+[ \t]*$/, "").trimEnd();
  return { marker: { offset: line.offset + lead.length - lead.trimStart().length, length: markerLength - (lead.length - lead.trimStart().length) }, content: { offset: line.offset + lead.length, length: trimmed.length } };
}

/** The `opf-block` or `opf-slide` fence whose lines include `offset`. */
function embeddedFenceAt(scan: MarkdownScan, offset: number): MarkdownFenceScan | undefined {
  return scan.fences.find((fence) => (fence.kind === "opf-block" || fence.kind === "opf-slide") && offset >= fence.from && offset <= fence.to);
}

/** A pointer's range in a Markdown text, with the converter's ranges; undefined when the text has nothing to point at. */
export function locateMarkdown(text: string, segments: readonly string[], part: YamlPart): MarkdownLocateResult | undefined {
  const { ctx, front } = readMarkdown(text);
  if (segments.length === 0) {
    const trimmed = text.replace(/\s+$/, "").length;
    return trimmed > 0 ? { offset: 0, length: trimmed, exact: true } : undefined;
  }
  if (segments[0] !== "slides") {
    if (!front) return undefined;
    const found = locateYaml(text.slice(front.start, front.end), segments, part);
    if (found) return { offset: found.offset + front.start, length: found.length, exact: found.exact };
    return { offset: front.start, length: Math.max(0, front.end - front.start), exact: false };
  }
  // `/slides`: from the first slide to the last (also the answer for a slide number the text does not have, inexact).
  const slidesSpan = (): Range | undefined => {
    const first = ctx.ranges.get("/slides/0");
    let last: Range | undefined;
    for (let index = 0; ctx.ranges.get(`/slides/${index}`); index++) last = ctx.ranges.get(`/slides/${index}`);
    return first && last ? { start: first.start, end: last.end } : undefined;
  };
  // The longest prefix of the pointer the converter recorded a range for.
  let consumed = segments.length;
  let range: Range | undefined;
  for (; consumed > 1; consumed--) {
    range = ctx.ranges.get(segmentsOfPointer(segments.slice(0, consumed)));
    if (range) break;
  }
  if (!range) {
    const whole = slidesSpan();
    return whole ? { offset: whole.start, length: whole.end - whole.start, exact: segments.length === 1 } : undefined;
  }
  const exact = consumed === segments.length;
  const field = segments[2];
  // An option key of the slide: the `key=value` token inside the options comment.
  if (consumed >= 3 && field !== undefined && SLIDE_OPTIONS.has(field) && OPTIONS_COMMENT.test(text.slice(range.start, range.end))) {
    const beatIndex = field === "beat" && consumed === 3 && segments[3] !== undefined && /^\d+$/.test(segments[3]) ? Number(segments[3]) : 0;
    const token = optionToken(text, range, field, beatIndex);
    if (token) {
      const span = part === "key" ? token.key : part === "entry" || part === "colon" ? token.entry : (token.value ?? token.key);
      return { ...span, exact: exact || (field === "beat" && consumed === 3 && segments.length === 4) };
    }
  }
  // Inside an embedded YAML fence (`opf-block`, `opf-slide`): the YAML knows the rest of the pointer.
  if (!exact) {
    const fence = embeddedFenceAt(scanMarkdown(text), range.start);
    if (fence) {
      const rest = consumed >= 4 && segments[2] === "blocks" ? segments.slice(4) : consumed === 3 ? segments.slice(2) : undefined;
      const inside = rest?.length ? locateYaml(text.slice(fence.bodyFrom, fence.bodyTo), rest, part) : undefined;
      if (inside) return { offset: inside.offset + fence.bodyFrom, length: inside.length, exact: inside.exact };
    }
  }
  const title = consumed === 3 && (field === "title" || field === "subtitle");
  const item = exact && segments.length >= 4 && /^\d+$/.test(segments[segments.length - 1]!) && segments[segments.length - 2] !== "blocks";
  if (exact && (title || item)) {
    const marked = afterMarker(text, range);
    if (marked) {
      const span = part === "key" ? marked.marker : part === "entry" ? firstLine(text, range) : marked.content;
      if (span.length > 0) return { ...span, exact: true };
    }
  }
  if (part === "open") return { ...firstLine(text, range), exact };
  return { offset: range.start, length: Math.max(0, range.end - range.start), exact };
}

export interface MarkdownPathResult {
  path: string[];
  part: "key" | "value" | "between" | "none";
  range?: Span;
}

const unescapeSegment = (segment: string): string => segment.replaceAll("~1", "/").replaceAll("~0", "~");
const spanOf = (range: Range): Span => ({ offset: range.start, length: range.end - range.start });

/** The document path under an offset of Markdown text. */
export function pathAtMarkdown(text: string, offset: number): MarkdownPathResult {
  const { ctx, front } = readMarkdown(text);
  if (front && offset >= front.start && offset <= front.end) {
    const inside = pathAtYaml(text.slice(front.start, front.end), offset - front.start);
    return { path: inside.path, part: inside.part === "none" ? "between" : inside.part, ...(inside.range ? { range: { offset: inside.range.offset + front.start, length: inside.range.length } } : {}) };
  }
  const scan = scanMarkdown(text);
  // Inside the YAML of an embedded fence: the YAML knows the path below the fence's own.
  const fence = embeddedFenceAt(scan, offset);
  if (fence && offset >= fence.bodyFrom && offset <= fence.bodyTo) {
    const inside = pathAtYaml(text.slice(fence.bodyFrom, fence.bodyTo), offset - fence.bodyFrom);
    if (inside.part !== "none" && inside.path.length) {
      const block = fence.kind === "opf-block" ? blockIndex(ctx.ranges, fence.slide, fence.from) : -1;
      const prefix = block >= 0 ? ["slides", String(fence.slide), "blocks", String(block)] : ["slides", String(fence.slide)];
      return { path: [...prefix, ...inside.path], part: inside.part, ...(inside.range ? { range: { offset: inside.range.offset + fence.bodyFrom, length: inside.range.length } } : {}) };
    }
  }
  // The deepest recorded range that contains the offset (the smallest of those at one depth).
  let best: { pointer: string; range: Range; depth: number } | undefined;
  for (const [pointer, range] of ctx.ranges) {
    if (!pointer.startsWith("/slides/") || offset < range.start || offset > range.end) continue;
    const depth = pointer.split("/").length;
    if (!best || depth > best.depth || (depth === best.depth && range.end - range.start < best.range.end - best.range.start)) best = { pointer, range, depth };
  }
  if (!best) return { path: [], part: "none" };
  const path = best.pointer.split("/").slice(1).map(unescapeSegment);
  // An options comment holds several keys at one range: the one under the offset.
  const field = path[2];
  if (path.length === 3 && field && SLIDE_OPTIONS.has(field) && OPTIONS_COMMENT.test(text.slice(best.range.start, best.range.end))) {
    for (const key of SLIDE_OPTIONS) {
      for (let nth = 0; ; nth++) {
        const token = optionToken(text, best.range, key, nth);
        if (!token) break;
        const at = key === "beat" ? [path[0]!, path[1]!, key, String(nth)] : [path[0]!, path[1]!, key];
        if (offset >= token.key.offset && offset <= token.key.offset + token.key.length) return { path: at, part: "key", range: token.key };
        if (token.value && offset >= token.value.offset && offset <= token.value.offset + token.value.length) return { path: at, part: "value", range: token.value };
      }
    }
    return { path: path.slice(0, 2), part: "between", range: spanOf(best.range) };
  }
  return { path, part: "value", range: spanOf(best.range) };
}

/** The index of the block of slide `slide` whose range starts at `start`, or -1. */
function blockIndex(ranges: ReadonlyMap<string, Range>, slide: number, start: number): number {
  for (let index = 0; ranges.has(`/slides/${slide}/blocks/${index}`); index++) if (ranges.get(`/slides/${slide}/blocks/${index}`)!.start === start) return index;
  return -1;
}
