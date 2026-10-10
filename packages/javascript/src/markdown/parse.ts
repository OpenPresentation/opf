// Markdown to OPF: front matter, slide boundaries and every block of the dialect. Internal module.
import { type Obj, type Run, isRecord } from "../convert/shared.js";
import { levelsFromIndents, parseCodeFence, parseQuoteLines, splitWhen } from "../convert/text-lines.js";
import { type InlineIssue, matchBracket, parseAttributes, parseInline, parsePlainInline, readDestination, unescapeInline } from "./inline.js";
import { Ctx, DECIMAL, type Line, type Range, lineRange, readCsv, readYamlMapping, splitLines } from "./support.js";

export interface ParseOptions {
  /**
   * How the Markdown is cut into slides. `auto` (the default): by `---` lines, and an outline (no `---` line, and two or more `# `
   * headings outside fences, comments and notes) by its headings. `rules`: by `---` lines only, so a second `# ` heading on a slide is a second title.
   * `headings`: a `# ` heading also starts a new slide (outline input).
   */
  split?: "auto" | "rules" | "headings";
}

export const SLIDE_OPTION_KEYS = ["id", "type", "layout", "section", "tag", "hidden", "beat"] as const;
export const BLOCK_OPTION_KEYS = ["id", "type", "as", "region"] as const;

// --- line classes ------------------------------------------------------------------------------

const BLANK = /^\s*$/;
const TIMELINE_STATUS_PREFIX = /^\[([x> ])\]\s+(?=\S)/;
const TIMELINE_STATUS_OF_MARK: Record<string, string> = { x: "done", ">": "current", " ": "planned" };
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const SEPARATOR = /^-{3,}[ \t]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const QUOTE = /^ {0,3}>/;
const LIST_ITEM = /^([ \t]*)([-+*]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const TABLE_ROW = /^ {0,3}\|/;
const TABLE_DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const IMAGE = /^ {0,3}!\[/;
const COMMENT = /^ {0,3}<!--/;
const NOTES = /^(Notes?):[ \t]*(.*)$/;

const indentWidth = (space: string): number => [...space].reduce((width, char) => width + (char === "\t" ? 4 : 1), 0);

function fenceClose(open: string): RegExp {
  return new RegExp(`^ {0,3}${open[0] === "`" ? "`" : "~"}{${open.length},}[ \\t]*$`);
}

/** Whether a line opens a fence (backtick fences cannot carry a backtick in the info string). */
function fenceStart(text: string): { fence: string; info: string } | undefined {
  const match = FENCE_OPEN.exec(text);
  if (!match) return undefined;
  if (match[2]![0] === "`" && match[3]!.includes("`")) return undefined;
  return { fence: match[2]!, info: match[3]!.trim() };
}

const tableStart = (lines: Line[], i: number): boolean => TABLE_ROW.test(lines[i]!.text) && lines[i + 1] !== undefined && TABLE_DELIMITER.test(lines[i + 1]!.text) && lines[i + 1]!.text.includes("-");

function listMarker(text: string): { indent: number; marker: string; content: string; ordered: boolean; family: string } | undefined {
  const match = LIST_ITEM.exec(text);
  if (!match) return undefined;
  const marker = match[2]!;
  const ordered = /^\d/.test(marker);
  return { indent: indentWidth(match[1]!), marker, content: match[3] ?? "", ordered, family: ordered ? marker.slice(-1) : marker };
}

/** Whether the line at `i` starts a block, and so ends a paragraph. */
function interrupts(lines: Line[], i: number): boolean {
  const text = lines[i]!.text;
  if (BLANK.test(text) || fenceStart(text) || (HEADING.test(text) && !/^ {0,3}#{7}/.test(text)) || QUOTE.test(text) || COMMENT.test(text) || NOTES.test(text) || SEPARATOR.test(text)) return true;
  if (tableStart(lines, i)) return true;
  if (IMAGE.test(text) && /^ {0,3}!\[(?:[^\]\\]|\\.)*\]\(.*\)[ \t]*$/.test(text)) return true;
  const item = listMarker(text);
  // Like CommonMark: a bullet with text, or a numbered item that starts at 1, may interrupt a paragraph.
  return !!item && item.indent < 4 && item.content.trim() !== "" && (!item.ordered || /^0*1[.)]$/.test(item.marker));
}

// --- segments ----------------------------------------------------------------------------------

/** Cut the lines after the front matter into one list of lines per slide, honouring fences, comments and notes. */
export function splitSegments(lines: Line[], split: "rules" | "headings"): Line[][] {
  const segments: Line[][] = [[]];
  let fence: string | undefined;
  let comment = false;
  let notes = false;
  const hasContent = (segment: Line[]) => segment.some((line) => !BLANK.test(line.text) && !(/^\s*<!--.*-->\s*$/.test(line.text)));
  for (const line of lines) {
    const text = line.text;
    const current = segments.at(-1)!;
    if (fence !== undefined) {
      if (fenceClose(fence).test(text)) fence = undefined;
      current.push(line);
      continue;
    }
    if (comment) {
      if (text.includes("-->")) comment = false;
      current.push(line);
      continue;
    }
    if (SEPARATOR.test(text)) {
      segments.push([]);
      notes = false;
      continue;
    }
    // In an outline a level-1 heading always starts a slide, even inside speaker notes.
    if (split === "headings" && /^#(?:[ \t]|$)/.test(text) && hasContent(current)) {
      segments.push([line]);
      notes = false;
      continue;
    }
    if (!notes) {
      const open = fenceStart(text);
      if (open) fence = open.fence;
      else if (COMMENT.test(text) && !text.includes("-->", text.indexOf("<!--") + 4)) comment = true;
      else if (NOTES.test(text)) notes = true;
    }
    current.push(line);
  }
  return segments;
}

/**
 * RR-75 (`split: "auto"`): true when the lines read as an outline: no `---` line between slides, and at least two level-1
 * headings outside fences, comments and speaker notes. Such a deck is cut at its headings; any other is cut at `---` lines.
 */
export function isOutline(lines: Line[]): boolean {
  let fence: string | undefined;
  let comment = false;
  let notes = false;
  let headings = 0;
  for (const { text } of lines) {
    if (fence !== undefined) {
      if (fenceClose(fence).test(text)) fence = undefined;
      continue;
    }
    if (comment) {
      if (text.includes("-->")) comment = false;
      continue;
    }
    if (SEPARATOR.test(text)) return false;
    if (notes) continue;
    if (/^#(?:[ \t]|$)/.test(text)) headings++;
    const open = fenceStart(text);
    if (open) fence = open.fence;
    else if (COMMENT.test(text) && !text.includes("-->", text.indexOf("<!--") + 4)) comment = true;
    else if (NOTES.test(text)) notes = true;
  }
  return headings >= 2;
}

// --- text helpers ------------------------------------------------------------------------------

/** Join the lines of one paragraph: a soft break is a space, a backslash at the end of a line a hard break. */
export function joinParagraph(lines: string[]): string {
  let out = "";
  lines.forEach((raw, k) => {
    let text = raw.trim();
    let separator = " ";
    if (k < lines.length - 1) {
      const slashes = /\\+$/.exec(text)?.[0].length ?? 0;
      if (slashes % 2 === 1) {
        text = text.slice(0, -1);
        separator = "\n";
      }
    }
    out += text + (k < lines.length - 1 ? separator : "");
  });
  return out;
}

const bold = (value: string | Run[]): Run[] => (typeof value === "string" ? [{ text: value, bold: true }] : value.map((run) => (typeof run === "string" ? { text: run, bold: true } : { ...run, bold: true })));

// --- parsing one slide -------------------------------------------------------------------------

interface Block {
  payload: Obj;
  options?: Obj;
  range: Range;
  /** The one content key of a native block, when the block is rootable. */
  key?: string;
}

interface Pending {
  options: Obj;
  range: Range;
}

export function parseOptions(text: string, keys: readonly string[], kind: "slide" | "block", ctx: Ctx, range: Range): Obj | undefined {
  const { pairs, error } = parseAttributes(text);
  const help = `A ${kind} options comment reads <!-- ${kind}: ${kind === "slide" ? 'id=cover layout=title section="Part 1" hidden' : "id=chart-1 as=bullets region=top:left"} -->. Keys: ${keys.join(", ")}.`;
  if (error) {
    ctx.error("options-syntax", error, help, range);
    return undefined;
  }
  const out: Obj = {};
  let ok = true;
  for (const [key, value] of pairs) {
    if (!keys.includes(key)) {
      ctx.error("options-unknown-key", `Unknown ${kind} option ${JSON.stringify(key)}.`, `${help} Anything else goes in a fenced opf-${kind} block.`, range);
      ok = false;
    } else if (key === "hidden") {
      if (value === true || value === "true") out.hidden = true;
      else if (value === "false") out.hidden = false;
      else {
        ctx.error("options-value", `hidden takes true or false, not ${JSON.stringify(value)}.`, help, range);
        ok = false;
      }
    } else if (value === true) {
      ctx.error("options-value", `Option ${key} needs a value: ${key}=value.`, help, range);
      ok = false;
    } else if (key === "beat" && out.beat !== undefined) out.beat = [...(Array.isArray(out.beat) ? out.beat : [out.beat]), value];
    else if (key in out) {
      ctx.error("options-duplicate", `Option ${key} is given twice.`, help, range);
      ok = false;
    } else if (key === "as" && value !== "bullets" && value !== "video") {
      ctx.error("options-value", `as takes bullets (a list stored as bullets) or video (an image line stored as video), not ${JSON.stringify(value)}.`, help, range);
      ok = false;
    } else out[key] = value;
  }
  return ok ? out : undefined;
}

class SlideParser {
  readonly slide: Obj = {};
  private readonly blocks: Block[] = [];
  private slideOptions: Obj | undefined;
  private slideOptionsRange: Range | undefined;
  private pending: Pending | undefined;
  private title: string | Run[] | undefined;
  private subtitle: string | Run[] | undefined;
  private notes: string | undefined;
  private extras: Obj | undefined;
  private notesRange: Range | undefined;
  private i = 0;

  constructor(
    private readonly ctx: Ctx,
    private readonly lines: Line[],
    private readonly path: string,
  ) {}

  private issueAt(range: Range): InlineIssue {
    return (rule, message) => (rule === "markdown/formatting-dropped" ? this.ctx.warn("formatting-dropped", message, "Use a plain string here, or put the field in a fenced opf-slide block.", range) : this.ctx.error(rule.replace(/^markdown\//, ""), message, "Fix the inline syntax.", range));
  }

  private inline(text: string, range: Range): string | Run[] {
    return parseInline(text, this.issueAt(range));
  }

  private plain(text: string, range: Range): string {
    return parsePlainInline(text, this.issueAt(range));
  }

  run(): Obj {
    const { lines, ctx } = this;
    while (this.i < lines.length) {
      const start = this.i;
      const line = lines[start]!;
      if (BLANK.test(line.text)) {
        this.i++;
        continue;
      }
      if (COMMENT.test(line.text)) this.comment();
      else if (NOTES.test(line.text)) this.parseNotes();
      else if (fenceStart(line.text)) this.fence();
      else if (HEADING.test(line.text) && !/^ {0,3}#{7}/.test(line.text)) this.heading();
      else if (QUOTE.test(line.text)) this.quote();
      else if (tableStart(lines, start)) this.table();
      else if (this.imageLine()) {
        // handled
      } else if (listMarker(line.text) && listMarker(line.text)!.indent < 4) this.list();
      else this.paragraph();
      if (this.i === start) this.i++;
    }
    if (this.pending) ctx.error("options-orphan", "A block options comment is not followed by a block.", "Put the <!-- block: ... --> comment directly before the block it describes.", this.pending.range, this.path);
    return this.finish();
  }

  private add(block: Block): void {
    if (this.pending) {
      block.options = this.pending.options;
      this.pending = undefined;
    }
    this.blocks.push(block);
  }

  private native(key: string, value: unknown, range: Range): void {
    const block: Block = { payload: { [key]: value }, range, key };
    this.add(block);
    if (block.options) {
      const as = block.options.as;
      const stored = as === "bullets" && key === "items" ? "bullets" : as === "video" && key === "image" ? "video" : key;
      if (as !== undefined && stored === key) this.ctx.error("options-value", `as=${as} does not apply to this block.`, "as=bullets goes before a list, as=video before an image line.", range, this.path);
      block.payload = { [stored]: value };
      block.key = stored;
    }
  }

  // --- comments --------------------------------------------------------------------------------

  private comment(): void {
    const { lines, ctx } = this;
    const first = lines[this.i]!;
    let end = this.i;
    while (end < lines.length && !lines[end]!.text.includes("-->", end === this.i ? lines[end]!.text.indexOf("<!--") + 4 : 0)) end++;
    if (end >= lines.length) {
      end = lines.length - 1;
      ctx.error("comment-unterminated", "An HTML comment is not closed.", "End the comment with -->.", lineRange(first, lines[end]!), this.path);
    }
    const last = lines[end]!;
    const range = lineRange(first, last);
    const body = lines
      .slice(this.i, end + 1)
      .map((line) => line.text)
      .join(" ");
    this.i = end + 1;
    const match = /^\s*<!--\s*(slide|block)(?::|(?=\s*-->))([\s\S]*?)-->([\s\S]*)$/.exec(body);
    if (!match) return;
    const kind = match[1] as "slide" | "block";
    if (match[3]!.trim()) ctx.error("options-trailing", "Text follows a closing --> on the same line.", "Put content on its own line after the options comment.", range, this.path);
    const options = parseOptions(match[2]!, kind === "slide" ? SLIDE_OPTION_KEYS : BLOCK_OPTION_KEYS, kind, ctx, range);
    if (!options) return;
    if (kind === "slide") {
      if (this.slideOptions) ctx.error("options-duplicate", "A slide has more than one <!-- slide: ... --> comment.", "Merge the options into one comment.", range, this.path);
      else {
        this.slideOptions = options;
        this.slideOptionsRange = range;
      }
    } else if (this.pending) ctx.error("options-duplicate", "Two block options comments in a row.", "Merge them into one comment.", range, this.path);
    else this.pending = { options, range };
  }

  // --- notes -----------------------------------------------------------------------------------

  private parseNotes(): void {
    const { lines } = this;
    const first = lines[this.i]!;
    const match = NOTES.exec(first.text)!;
    const rows = [match[2]!, ...lines.slice(this.i + 1).map((line) => line.text)];
    while (rows.length && BLANK.test(rows[0]!)) rows.shift();
    while (rows.length && BLANK.test(rows.at(-1)!)) rows.pop();
    const range = lineRange(first, lines.at(-1)!);
    this.notesRange = range;
    this.notes = rows.join("\n");
    this.i = lines.length;
  }

  // --- headings --------------------------------------------------------------------------------

  private heading(): void {
    const { lines, ctx } = this;
    const line = lines[this.i++]!;
    const match = HEADING.exec(line.text)!;
    const level = match[1]!.length;
    const text = (match[2] ?? "").replace(/(?:^|[ \t]+)#+[ \t]*$/, "").trim();
    const range = lineRange(line);
    if (!text) {
      ctx.error("empty-heading", "A heading has no text.", "Write the title after the #, or remove the line.", range, this.path);
      return;
    }
    if (level === 1) {
      if (this.title !== undefined) ctx.error("duplicate-title", "A slide has more than one # title.", "Use --- to start a new slide, or `##` for the subtitle.", range, `${this.path}/title`);
      else {
        this.title = this.inline(text, range);
        ctx.ranges.set(`${this.path}/title`, range);
      }
    } else if (level === 2) {
      if (this.subtitle !== undefined) ctx.error("duplicate-subtitle", "A slide has more than one ## subtitle.", "A slide has one subtitle. Use a paragraph for further lines.", range, `${this.path}/subtitle`);
      else {
        this.subtitle = this.inline(text, range);
        ctx.ranges.set(`${this.path}/subtitle`, range);
      }
    } else {
      ctx.warn("heading-demoted", `A level-${level} heading has no OPF form, so it became a bold paragraph.`, "Only # (title) and ## (subtitle) are slide fields. Use a bold paragraph on purpose to silence this.", range, this.path);
      this.native("text", bold(this.inline(text, range)), range);
    }
  }

  // --- paragraph -------------------------------------------------------------------------------

  private paragraph(): void {
    const { lines } = this;
    const first = this.i;
    const rows: string[] = [];
    do rows.push(lines[this.i++]!.text);
    while (this.i < lines.length && !interrupts(lines, this.i));
    const range = lineRange(lines[first]!, lines[this.i - 1]!);
    this.native("text", this.inline(joinParagraph(rows), range), range);
  }

  // --- quote -----------------------------------------------------------------------------------

  private quote(): void {
    const { lines, ctx } = this;
    const first = this.i;
    const rows: string[] = [];
    while (this.i < lines.length && QUOTE.test(lines[this.i]!.text)) rows.push(lines[this.i++]!.text.replace(/^ {0,3}> ?/, ""));
    const range = lineRange(lines[first]!, lines[this.i - 1]!);
    while (rows.length && BLANK.test(rows[0]!)) rows.shift();
    while (rows.length && BLANK.test(rows.at(-1)!)) rows.pop();
    if (!rows.length) {
      ctx.error("empty-quote", "A block quote has no text.", "Write the quote after >.", range, this.path);
      return;
    }
    const parsed = parseQuoteLines(rows);
    const paragraphs: string[][] = [[]];
    for (const row of parsed.text) {
      if (BLANK.test(row)) paragraphs.push([]);
      else paragraphs.at(-1)!.push(row);
    }
    // The quote text keeps inline formatting (a string, or TextRun[] when any run is formatted); attribution and source are plain strings.
    const text = this.inline(
      paragraphs
        .filter((paragraph) => paragraph.length)
        .map(joinParagraph)
        .join("\n\n"),
      range,
    );
    const value: Obj = { text };
    if (parsed.attribution !== undefined) value.attribution = this.plain(parsed.attribution, range);
    if (parsed.source !== undefined) value.source = this.plain(parsed.source, range);
    // The string shorthand exists only for a plain string; a rich text stays in its { text } object.
    this.native("quote", Object.keys(value).length === 1 && typeof value.text === "string" ? value.text : value, range);
  }

  // --- lists -----------------------------------------------------------------------------------

  private list(): void {
    const { lines, ctx } = this;
    const first = this.i;
    interface Entry {
      indent: number;
      rows: string[];
      description?: string[];
    }
    const entries: Entry[] = [];
    const head = listMarker(lines[first]!.text)!;
    let topIndent = head.indent;
    let numbered = false;
    let i = first;
    while (i < lines.length) {
      const text = lines[i]!.text;
      if (BLANK.test(text)) {
        let j = i + 1;
        while (j < lines.length && BLANK.test(lines[j]!.text)) j++;
        const item = j < lines.length ? listMarker(lines[j]!.text) : undefined;
        if (!item) break;
        if (item.indent <= topIndent && item.family !== head.family) break;
        i = j;
        continue;
      }
      const item = listMarker(text);
      if (item) {
        if (item.indent <= topIndent) {
          if (item.family !== head.family) break;
          topIndent = Math.min(topIndent, item.indent);
        }
        if (item.ordered) numbered = true;
        entries.push({ indent: item.indent, rows: [item.content.trim()] });
        i++;
        continue;
      }
      const current = entries.at(-1);
      if (!current || interrupts(lines, i)) break;
      const description = /^([ \t]+):[ \t]+(.*)$/.exec(text);
      if (description && indentWidth(description[1]!) > current.indent && !current.description) current.description = [description[2]!.trim()];
      else if (current.description) current.description.push(text.trim());
      else current.rows.push(text);
      i++;
    }
    this.i = i;
    const last = Math.max(first, i - 1);
    let end = last;
    while (end > first && BLANK.test(lines[end]!.text)) end--;
    const range = lineRange(lines[first]!, lines[end]!);
    if (numbered) ctx.warn("numbered-list", "Numbers in a list are not kept: the Markdown dialect does not read them as `numbering`, so each item became a bullet.", "Add `numbering` to the slide or block in an opf-slide or opf-block fence (docs/numbered-lists.md), write the numbers into the text, or use a bulleted list.", range, this.path);
    const levels = levelsFromIndents(entries.map((entry) => entry.indent));
    const items = entries.map((entry, k) => {
      const text = this.inline(joinParagraph(entry.rows), range);
      const description = entry.description ? this.inline(joinParagraph(entry.description), range) : undefined;
      const level = levels[k]!;
      if (!level && description === undefined) return text;
      const out: Obj = { text };
      if (description !== undefined) out.description = description;
      if (level) out.level = level;
      return out;
    });
    this.native("items", items, range);
  }

  // --- tables ----------------------------------------------------------------------------------

  private table(): void {
    const { lines, ctx } = this;
    const first = this.i;
    this.i += 2;
    while (this.i < lines.length && TABLE_ROW.test(lines[this.i]!.text)) this.i++;
    const range = lineRange(lines[first]!, lines[this.i - 1]!);
    const header = splitRow(lines[first]!.text);
    const rows = lines.slice(first + 2, this.i).map((line) => splitRow(line.text));
    const cell = (text: string): string | Run[] => this.inline(text, range);
    const out: Obj = {};
    if (header.some((text) => text !== "")) out.columns = header.map((text) => (text === "" ? null : cell(text)));
    out.rows = rows.map((row) => {
      if (header.length && row.length !== header.length) ctx.warn("table-ragged", `A table row has ${row.length} cells but the header has ${header.length}.`, "Give every row the same number of cells.", range, this.path);
      const cells = row.map((text) => (text === "" ? null : cell(text)));
      while (header.length && cells.length < header.length) cells.push(null);
      return cells;
    });
    this.native("table", out, range);
  }

  // --- images ----------------------------------------------------------------------------------

  private imageLine(): boolean {
    const { lines, ctx } = this;
    const line = lines[this.i]!;
    const text = line.text.replace(/^ {0,3}/, "");
    if (!text.startsWith("![")) return false;
    const close = matchBracket(text, 1);
    if (close < 0 || text[close + 1] !== "(") return false;
    const dest = readDestination(text, close + 1);
    if (!dest || text.slice(dest.end).trim() !== "") return false;
    this.i++;
    const range = lineRange(line);
    if (!dest.url) {
      ctx.error("image-source", "An image has no source.", "Write the file or URL inside the parentheses: ![alt](path.png).", range, this.path);
      return true;
    }
    const alt = unescapeInline(text.slice(2, close));
    const value: Obj = { src: dest.url };
    if (alt) value.alt = alt;
    if (dest.title !== undefined) value.title = dest.title;
    this.native("image", Object.keys(value).length === 1 ? value.src : value, range);
    return true;
  }

  // --- fences ----------------------------------------------------------------------------------

  private fence(): void {
    const { lines, ctx } = this;
    const first = this.i;
    const open = fenceStart(lines[first]!.text)!;
    const close = fenceClose(open.fence);
    let end = first + 1;
    while (end < lines.length && !close.test(lines[end]!.text)) end++;
    const terminated = end < lines.length;
    const lastLine = terminated ? lines[end]! : lines.at(-1)!;
    const range = lineRange(lines[first]!, lastLine);
    if (!terminated) ctx.error("fence-unterminated", "A fenced block is not closed.", `Add a closing ${open.fence} line.`, range, this.path);
    this.i = terminated ? end + 1 : lines.length;
    const body = lines.slice(first + 1, terminated ? end : lines.length);
    const bodyText = body.map((line) => line.text).join("\n");
    const bodyStart = body[0]?.start ?? lines[first]!.end;
    const info = open.info;
    const word = /^[^\s{]*/.exec(info)![0];
    const rest = info.slice(word.length).trim();
    if (word === "chart") this.chart(rest, bodyText, range);
    else if (word === "metric") this.metric(body, range);
    else if (word === "timeline") this.timeline(rest, body, range);
    else if (word === "opf-slide") this.embeddedSlide(bodyText, bodyStart, range);
    else if (word === "opf-block") this.embeddedBlock(bodyText, bodyStart, range);
    else {
      const parsed = parseCodeFence([lines[first]!.text, ...body.map((line) => line.text), open.fence]);
      if (!parsed) {
        ctx.error("code-fence", "This fenced block could not be read as code.", "Close the fence with at least as many backticks as opened it.", range, this.path);
        return;
      }
      const hasMeta = parsed.language !== undefined || parsed.filename !== undefined;
      const value: Obj = { source: parsed.source };
      if (parsed.language) value.language = parsed.language;
      if (parsed.filename) value.filename = parsed.filename;
      this.native("code", hasMeta ? value : parsed.source, range);
    }
  }

  private chart(rest: string, text: string, range: Range): void {
    const { ctx } = this;
    const type = /^[^\s]+/.exec(rest)?.[0];
    if (!type) {
      ctx.error("chart-type", "A chart block names its type after `chart`.", "Write ```chart column (or line, pie, bar, ...), then the data.", range, this.path);
      return;
    }
    // FA-09: ```chart column alt="What the data shows" (alt="" marks the chart decorative).
    const { pairs, error } = parseAttributes(rest.slice(type.length));
    const meta: Obj = {};
    if (error) ctx.error("chart-attributes", error, 'Write ```chart column alt="What the data shows" (alt is optional).', range, this.path);
    for (const [key, value] of pairs) {
      if (key === "alt" && typeof value === "string") meta.alt = value;
      else ctx.error("chart-attributes", `Unknown chart attribute ${JSON.stringify(key)}.`, "A chart fence takes alt, a text alternative in double quotes.", range, this.path);
    }
    const trimmed = text.trim();
    if (!trimmed) {
      ctx.error("chart-data", "A chart block has no data.", "Write CSV with a header row, or a JSON object with columns and rows or a data source.", range, this.path);
      return;
    }
    if (trimmed.startsWith("{")) {
      try {
        const data = JSON.parse(trimmed) as unknown;
        if (!isRecord(data)) throw new Error("not an object");
        this.native("chart", { type, ...meta, data }, range);
      } catch (error) {
        ctx.error("chart-data", `Chart JSON is invalid: ${(error as Error).message}.`, "Write a JSON object: {\"columns\": [...], \"rows\": [[...]]} or {\"src\": ...}.", range, this.path);
      }
      return;
    }
    const csv = readCsv(text);
    if (csv.error) {
      ctx.error("chart-data", `Chart CSV is invalid: ${csv.error}`, "Quote fields that contain commas, quotes or line breaks.", range, this.path);
      return;
    }
    const [head, ...body] = csv.rows.filter((row) => row.some((field) => field.value !== "" || field.quoted));
    if (!head || !body.length) {
      ctx.error("chart-data", "Chart CSV needs a header row and at least one data row.", "The first line names the columns.", range, this.path);
      return;
    }
    // The first column holds the category labels and stays text, as in the data import; the other columns are typed.
    const typed = (field: { value: string; quoted: boolean }): unknown => (field.quoted ? field.value : field.value === "" ? null : DECIMAL.test(field.value) ? Number(field.value) : field.value === "true" ? true : field.value === "false" ? false : field.value);
    const rows = body.map((row) => row.map((field, index) => (index === 0 ? field.value : typed(field))));
    if (rows.some((row) => row.length !== head.length)) ctx.warn("chart-ragged", `A chart row has a different number of values than the ${head.length} columns.`, "Give every row one value per column.", range, this.path);
    this.native("chart", { type, ...meta, data: { columns: head.map((field) => field.value), rows } }, range);
  }

  private metric(body: Line[], range: Range): void {
    const { ctx } = this;
    const allowed = ["value", "label", "description", "unit", "delta", "trend", "sentiment"];
    const help = `A metric block is key: value lines. Keys: ${allowed.join(", ")}. A value is plain text, or a JSON string in double quotes.`;
    const out: Obj = {};
    for (const line of body) {
      if (BLANK.test(line.text)) continue;
      const match = /^([A-Za-z]+):[ \t]*(.*?)[ \t]*$/.exec(line.text);
      const where = lineRange(line);
      if (!match) {
        ctx.error("metric-block", "Expected a key: value line.", help, where, this.path);
        return;
      }
      const [, key, raw] = match as unknown as [string, string, string];
      if (!allowed.includes(key) || key in out || raw === "") {
        ctx.error("metric-block", !allowed.includes(key) ? `Unknown metric key ${JSON.stringify(key)}.` : key in out ? `Metric key ${key} is given twice.` : `Metric key ${key} has no value.`, help, where, this.path);
        return;
      }
      if (raw.startsWith('"')) {
        try {
          const value = JSON.parse(raw) as unknown;
          if (typeof value !== "string") throw new Error("not a string");
          out[key] = value;
        } catch {
          ctx.error("metric-block", `The value of ${key} starts with a quote but is not a JSON string.`, help, where, this.path);
          return;
        }
      } else out[key] = (key === "value" || key === "delta") && DECIMAL.test(raw) ? Number(raw) : raw;
    }
    if (out.value === undefined) {
      ctx.error("metric-block", "A metric needs a value.", help, range, this.path);
      return;
    }
    const ordered: Obj = {};
    for (const key of allowed) if (out[key] !== undefined) ordered[key] = out[key];
    this.native("metric", Object.keys(ordered).length === 1 ? ordered.value : ordered, range);
  }

  private timeline(rest: string, body: Line[], range: Range): void {
    const { ctx } = this;
    const { pairs, error } = parseAttributes(rest);
    const meta: Obj = {};
    if (error) ctx.error("timeline-attributes", error, 'Write ```timeline name="Roadmap" description="..." (both optional).', range, this.path);
    for (const [key, value] of pairs) {
      if ((key === "name" || key === "description") && typeof value === "string") meta[key] = value;
      else ctx.error("timeline-attributes", `Unknown timeline attribute ${JSON.stringify(key)}.`, "A timeline fence takes name and description.", range, this.path);
    }
    const events: Obj[] = [], statuses: (string | undefined)[] = [];
    for (const line of body) {
      if (BLANK.test(line.text)) continue;
      if (/^[ \t]+\S/.test(line.text)) {
        const event = events.at(-1);
        if (!event) {
          ctx.error("timeline-description", "An indented line must follow an event.", "Put the event first, then its description indented below it.", lineRange(line), this.path);
          continue;
        }
        event.description = event.description === undefined ? line.text.trim() : `${event.description} ${line.text.trim()}`;
        continue;
      }
      let text = line.text.trim();
      // A task-list style prefix sets the event's status: [x] done, [>] current, [ ] planned.
      const marked = TIMELINE_STATUS_PREFIX.exec(text);
      const status = marked ? TIMELINE_STATUS_OF_MARK[marked[1]!] : undefined;
      if (marked) text = text.slice(marked[0].length).trim();
      // `when — what` (a spaced em dash) is the dialect's separator; the date rules of the conversions module also apply.
      const dash = text.indexOf(" — ");
      const split = dash > 0 && text.slice(dash + 3).trim() ? { when: text.slice(0, dash).trim(), what: text.slice(dash + 3).trim() } : splitWhen(text);
      events.push(split ? { when: split.when, what: split.what } : { what: text });
      statuses.push(status);
    }
    // The status key goes last, after any description, which is the canonical key order.
    events.forEach((event, index) => { if (statuses[index]) event.status = statuses[index]; });
    if (!events.length) {
      ctx.error("timeline-events", "A timeline has no events.", "Write one event per line: `2024 Q1 — Pilot`.", range, this.path);
      return;
    }
    this.native("timeline", Object.keys(meta).length ? { ...meta, events } : events, range);
  }

  private embeddedBlock(text: string, base: number, range: Range): void {
    const { ctx } = this;
    const parsed = readYamlMapping(text, base, ctx, "opf-block", range);
    if (!parsed.ok) return;
    if (this.pending) {
      ctx.error("options-embedded", "A block options comment cannot precede an opf-block fence.", "Put id and type inside the opf-block YAML.", this.pending.range, this.path);
      this.pending = undefined;
    }
    const keys = Object.keys(parsed.value);
    this.blocks.push({ payload: parsed.value, range, key: keys.length === 1 ? keys[0] : undefined });
  }

  private embeddedSlide(text: string, base: number, range: Range): void {
    const { ctx } = this;
    const parsed = readYamlMapping(text, base, ctx, "opf-slide", range);
    if (!parsed.ok) return;
    if (this.extras) ctx.error("options-duplicate", "A slide has more than one opf-slide block.", "Merge them into one.", range, this.path);
    else {
      this.extras = parsed.value;
      for (const [key, found] of parsed.keys) ctx.ranges.set(`${this.path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, found);
    }
  }

  // --- assembly --------------------------------------------------------------------------------

  private finish(): Obj {
    const { slide, ctx, path } = this;
    const set = (key: string, value: unknown, range?: Range) => {
      if (value === undefined) return;
      if (Object.hasOwn(slide, key)) ctx.error("slide-property-conflict", `The slide property ${JSON.stringify(key)} is set twice.`, "Set it either in Markdown or in the opf-slide block, not both.", this.slideOptionsRange ?? range ?? { start: 0, end: 0 }, `${path}/${key}`);
      else Object.defineProperty(slide, key, { value, enumerable: true, writable: true, configurable: true });
    };
    const options = this.slideOptions ?? {};
    if (this.slideOptionsRange) for (const key of Object.keys(options)) ctx.ranges.set(`${path}/${key}`, this.slideOptionsRange);
    set("id", options.id);
    set("type", options.type);
    set("beat", options.beat);
    set("layout", options.layout);
    set("section", options.section);
    set("tag", options.tag);
    set("title", this.title);
    set("subtitle", this.subtitle);
    // A block with region=... is a promoted region of the slide; the others are its content.
    const content = this.blocks.filter((block) => block.options?.region === undefined);
    const regions = this.blocks.filter((block) => block.options?.region !== undefined);
    const [only] = content;
    if (content.length === 1 && only?.key !== undefined && only.options?.id === undefined && only.options?.type === undefined && isContentKey(only.key) && Object.keys(only.payload).length === 1) {
      slide[only.key] = only.payload[only.key];
      ctx.ranges.set(`${path}/${only.key}`, only.range);
    } else if (content.length) {
      slide.blocks = content.map((block, index) => {
        ctx.ranges.set(`${path}/blocks/${index}`, block.range);
        const out: Obj = {};
        if (block.options?.id !== undefined) out.id = block.options.id;
        if (block.options?.type !== undefined) out.type = block.options.type;
        return Object.assign(out, block.payload);
      });
    }
    for (const block of regions) {
      const region = block.options!.region as string;
      const payload: Obj = {};
      if (block.options?.id !== undefined) payload.id = block.options.id;
      if (block.options?.type !== undefined) payload.type = block.options.type;
      Object.assign(payload, block.payload);
      ctx.ranges.set(`${path}/${region}`, block.range);
      set(region, payload, block.range);
    }
    set("notes", this.notes || undefined, this.notesRange);
    if (this.notesRange && this.notes) ctx.ranges.set(`${path}/notes`, this.notesRange);
    set("hidden", options.hidden);
    for (const [key, value] of Object.entries(this.extras ?? {})) set(key, value);
    return slide;
  }
}

const CONTENT = new Set(["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"]);
const isContentKey = (key: string): boolean => CONTENT.has(key);

function splitRow(text: string): string[] {
  let s = text.trim();
  if (s.startsWith("|")) s = s.slice(1);
  const cells: string[] = [];
  let cell = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "\\" && i + 1 < s.length) {
      cell += c + s[i + 1];
      i++;
    } else if (c === "|") {
      cells.push(cell.trim());
      cell = "";
    } else cell += c;
  }
  if (cell.trim() !== "" || !/\|\s*$/.test(text)) cells.push(cell.trim());
  return cells;
}

/** Parse the lines of one slide segment. Ranges for the slide, its fields and its blocks are recorded in `ctx.ranges`. */
export function parseSlide(ctx: Ctx, lines: Line[], index: number): Obj {
  const path = `/slides/${index}`;
  const first = lines.find((line) => !BLANK.test(line.text));
  const last = [...lines].reverse().find((line) => !BLANK.test(line.text));
  if (first && last) ctx.ranges.set(path, lineRange(first, last));
  return new SlideParser(ctx, lines, path).run();
}

export function emptySegment(lines: Line[]): boolean {
  return lines.every((line) => BLANK.test(line.text));
}

/** Parse one slide from text with its own findings: used to verify what the writer produced. */
export function parseSlideText(text: string): { slide: Obj | undefined; clean: boolean } {
  const ctx = new Ctx(text);
  const segments = splitSegments(splitLines(text), "rules").filter((segment) => !emptySegment(segment));
  if (segments.length !== 1) return { slide: undefined, clean: false };
  const slide = parseSlide(ctx, segments[0]!, 0);
  return { slide, clean: ctx.findings.length === 0 };
}

/** The front matter block of a source, if it starts with one: its lines and the index of the first body line. */
export function frontMatter(lines: Line[]): { yaml: Range; end: number } | "unterminated" | undefined {
  if (!lines.length || lines[0]!.text.trimEnd() !== "---") return undefined;
  for (let i = 1; i < lines.length; i++) {
    const text = lines[i]!.text.trimEnd();
    if (text === "---" || text === "...") return { yaml: { start: lines[0]!.end, end: lines[i]!.start }, end: i + 1 };
  }
  return "unterminated";
}

export { readYamlMapping };
