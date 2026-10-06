// Inline text of the OPF Markdown dialect: parsing `**bold**`, `*italic*`, `~~strike~~`, `<u>`, `<sup>`, `<sub>`,
// `[text](url)`, `[text]{color=... size=... font=... lang=...}`, `` `code` `` spans and backslash escapes into OPF TextRun values, and the
// reverse. Pure and deterministic; no HTML and no entities. Internal module.
import { FORMATTING, type Obj, type Run, isRecord, runText } from "../convert/shared.js";

/** A style applied to a stretch of text. Every key is optional; absent means off. */
interface Style {
  bold?: true;
  italic?: true;
  underline?: true;
  strikethrough?: true;
  superscript?: true;
  subscript?: true;
  code?: true;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  link?: string;
  lang?: string;
}
interface Seg {
  text: string;
  style: Style;
}

export type InlineIssue = (rule: string, message: string) => void;

const PUNCT = /[\p{P}\p{S}]/u;
const WS = /\s/u;
const ALNUM = /[\p{L}\p{N}]/u;
const ASCII_PUNCT = /^[!-/:-@[-`{-~]$/;

// --- span attributes ---------------------------------------------------------------------------

/** Deepest nesting of links and spans that is read; deeper brackets stay literal text. */
const MAX_DEPTH = 16;
/** Longest link destination, title or span attribute list that is read. */
const MAX_TARGET = 2000;
/** Longest span attribute list. */
const MAX_SPAN = 300;

const SPAN_FLAGS: Record<string, keyof Style> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strikethrough",
  strikethrough: "strikethrough",
  sup: "superscript",
  superscript: "superscript",
  sub: "subscript",
  subscript: "subscript",
};
const SPAN_VALUES: Record<string, "color" | "fontSize" | "fontFamily" | "lang"> = { color: "color", size: "fontSize", fontsize: "fontSize", font: "fontFamily", fontfamily: "fontFamily", lang: "lang" };

/** Read `key`, `key=bare` and `key="json string"` pairs separated by spaces or commas. Returns undefined text for a syntax error. */
export function parseAttributes(source: string): { pairs: [string, string | true][]; error?: string } {
  const pairs: [string, string | true][] = [];
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /[\s,]/.test(source[i]!)) i++;
    if (i >= source.length) break;
    const key = /^[A-Za-z][\w-]*/.exec(source.slice(i))?.[0];
    if (!key) return { pairs, error: `Expected an attribute name at ${JSON.stringify(source.slice(i, i + 12))}.` };
    i += key.length;
    if (source[i] !== "=") {
      pairs.push([key, true]);
      continue;
    }
    i++;
    if (source[i] === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') j += source[j] === "\\" ? 2 : 1;
      if (j >= source.length) return { pairs, error: `Unterminated quoted value for ${key}.` };
      try {
        pairs.push([key, JSON.parse(source.slice(i, j + 1)) as string]);
      } catch {
        return { pairs, error: `Invalid quoted value for ${key}; use JSON string escapes.` };
      }
      i = j + 1;
    } else {
      const value = /^[^\s,"]+/.exec(source.slice(i))?.[0];
      if (!value) return { pairs, error: `Missing value for ${key}.` };
      pairs.push([key, value]);
      i += value.length;
    }
  }
  return { pairs };
}

function spanStyle(source: string, issue: InlineIssue): Style {
  const style: Style = {};
  const { pairs, error } = parseAttributes(source);
  if (error) issue("markdown/span-attributes", `${error} A span reads {bold italic color=#ff0000 size=24 font="Open Sans"}.`);
  for (const [rawKey, value] of pairs) {
    const key = rawKey.toLowerCase();
    const flag = SPAN_FLAGS[key];
    const field = SPAN_VALUES[key];
    if (flag) {
      if (value === true || value === "true") (style as Obj)[flag] = true;
      else if (value !== "false") issue("markdown/span-attributes", `Span flag ${rawKey} takes no value (or =true/false).`);
    } else if (field === "fontSize") {
      const size = value === true ? Number.NaN : Number(value);
      if (Number.isFinite(size) && size > 0) style.fontSize = size;
      else issue("markdown/span-attributes", `Span size must be a positive number, not ${JSON.stringify(value)}.`);
    } else if (field) {
      if (typeof value === "string" && value) style[field] = value;
      else issue("markdown/span-attributes", `Span ${rawKey} needs a value.`);
    } else issue("markdown/span-attributes", `Unknown span attribute ${JSON.stringify(rawKey)}. Known: bold, italic, underline, strike, sup, sub, color, size, font, lang.`);
  }
  return style;
}

// --- tokens ------------------------------------------------------------------------------------

type Token =
  | { t: "text"; v: string }
  | { t: "node"; children: Seg[]; apply: Style }
  | { t: "delim"; ch: "*" | "_" | "~"; n: number; orig: number; canOpen: boolean; canClose: boolean; opens: (keyof Style)[]; closes: (keyof Style)[] }
  | { t: "tag"; name: "underline" | "superscript" | "subscript"; close: boolean; matched: boolean };

const TAGS: Record<string, "underline" | "superscript" | "subscript"> = { u: "underline", sup: "superscript", sub: "subscript" };

/** Index of the `]` that closes the `[` at `start`, skipping escapes and balanced pairs, or -1. */
export function matchBracket(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") i++;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return i;
  }
  return -1;
}

const ANGLE_AT = /<([^<>\n]*)>/y;

/** Read a link destination and optional title after `(`: returns the url and the index after `)`. */
export function readDestination(s: string, open: number): { url: string; end: number; title?: string } | undefined {
  let i = open + 1;
  while (s[i] === " ") i++;
  let url = "";
  if (s[i] === "<") {
    ANGLE_AT.lastIndex = i;
    const angle = ANGLE_AT.exec(s);
    if (!angle) return undefined;
    url = unescapeInline(angle[1]!);
    i += angle[0].length;
  } else {
    let depth = 0;
    const from = i;
    for (; i < s.length && i - from <= MAX_TARGET; i++) {
      const c = s[i]!;
      if (c === "\\" && ASCII_PUNCT.test(s[i + 1] ?? "")) {
        i++;
        continue;
      }
      if (/\s/.test(c)) break;
      if (c === "(") depth++;
      else if (c === ")") {
        if (depth === 0) break;
        depth--;
      }
    }
    if (i - from > MAX_TARGET) return undefined;
    url = unescapeInline(s.slice(from, i));
  }
  while (s[i] === " ") i++;
  // An optional "title": kept for an image, ignored for a link (a TextRun link has no title).
  let title: string | undefined;
  if (s[i] === '"' || s[i] === "'") {
    const quote = s[i]!;
    let j = i + 1;
    while (j < s.length && j - i <= MAX_TARGET && s[j] !== quote) j += s[j] === "\\" ? 2 : 1;
    if (j >= s.length || j - i > MAX_TARGET) return undefined;
    title = unescapeInline(s.slice(i + 1, j));
    i = j + 1;
    while (s[i] === " ") i++;
  }
  if (s[i] !== ")") return undefined;
  return title === undefined ? { url, end: i + 1 } : { url, end: i + 1, title };
}

export function unescapeInline(text: string): string {
  return text.replace(/\\([!-/:-@[-`{-~])/g, "$1");
}

/** Flanking rules from CommonMark, with the intraword restriction on `_`. */
function flanking(prev: string, next: string, ch: string): { canOpen: boolean; canClose: boolean } {
  const left = !WS.test(next) && (!PUNCT.test(next) || WS.test(prev) || PUNCT.test(prev));
  const right = !WS.test(prev) && (!PUNCT.test(prev) || WS.test(next) || PUNCT.test(next));
  if (ch === "_") return { canOpen: left && (!right || PUNCT.test(prev)), canClose: right && (!left || PUNCT.test(next)) };
  return { canOpen: left, canClose: right };
}

/** The index of the `]` for every `[` that has one, in one pass. */
function bracketPairs(s: string): Map<number, number> {
  const pairs = new Map<number, number>();
  const open: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") i++;
    else if (c === "[") open.push(i);
    else if (c === "]" && open.length) pairs.set(open.pop()!, i);
  }
  return pairs;
}

/** Index of the first backtick run of exactly `n` characters at or after `from`, or -1 (CommonMark code spans). */
function findCodeClose(s: string, from: number, n: number, unclosed: Set<number>): number {
  if (unclosed.has(n)) return -1;
  for (let i = from; i < s.length; ) {
    if (s[i] !== "`") {
      i++;
      continue;
    }
    let j = i;
    while (s[j] === "`") j++;
    if (j - i === n) return i;
    i = j;
  }
  unclosed.add(n);
  return -1;
}

/** The text of a code span: line breaks become spaces, and one space is removed from each side when both sides have one. */
function codeSpanText(body: string): string {
  const text = body.replace(/\r\n|\r|\n/g, " ");
  return text.length > 2 && text.startsWith(" ") && text.endsWith(" ") && /[^ ]/.test(text) ? text.slice(1, -1) : text;
}

const TAG_AT = /<(\/?)(u|sup|sub)>/iy;
const BR_AT = /<br\s*\/?>/iy;
const AUTOLINK_AT = /<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*)>/y;

/** Work left for reading link destinations in one inline text, so that adversarial input stays linear: past it, brackets stay literal. */
interface Budget {
  left: number;
}

function tokenize(s: string, issue: InlineIssue, depth: number, budget: Budget): Token[] {
  const tokens: Token[] = [];
  const pairs = bracketPairs(s);
  let text = "";
  const flush = () => {
    if (text) tokens.push({ t: "text", v: text });
    text = "";
  };
  const before = (i: number) => (i > 0 ? s[i - 1]! : " ");
  // Backtick run lengths known to have no closing run after the point they were searched from.
  const unclosed = new Set<number>();
  for (let i = 0; i < s.length; ) {
    const c = s[i]!;
    if (c === "\\" && i + 1 < s.length && ASCII_PUNCT.test(s[i + 1]!)) {
      text += s[i + 1];
      i += 2;
      continue;
    }
    if (c === "`") {
      let j = i;
      while (s[j] === "`") j++;
      const n = j - i;
      const close = findCodeClose(s, j, n, unclosed);
      if (close < 0) {
        text += s.slice(i, j);
        i = j;
        continue;
      }
      flush();
      tokens.push({ t: "node", children: [{ text: codeSpanText(s.slice(j, close)), style: { code: true } }], apply: {} });
      i = close + n;
      continue;
    }
    if (c === "[") {
      const close = depth < MAX_DEPTH ? (pairs.get(i) ?? -1) : -1;
      if (close > 0) {
        const next = s[close + 1];
        if (next === "(" && budget.left > 0) {
          const dest = readDestination(s, close + 1);
          budget.left -= dest ? dest.end - close : Math.min(MAX_TARGET, s.length - close);
          if (dest) {
            flush();
            tokens.push({ t: "node", children: parseSegs(s.slice(i + 1, close), issue, depth + 1, budget), apply: dest.url ? { link: dest.url } : {} });
            i = dest.end;
            continue;
          }
        } else if (next === "{") {
          const end = s.slice(close + 2, close + 2 + MAX_SPAN).indexOf("}") + close + 2;
          if (end > close + 1 && !s.slice(close + 2, end).includes("\n")) {
            flush();
            tokens.push({ t: "node", children: parseSegs(s.slice(i + 1, close), issue, depth + 1, budget), apply: spanStyle(s.slice(close + 2, end), issue) });
            i = end + 1;
            continue;
          }
        }
      }
      text += c;
      i++;
      continue;
    }
    if (c === "<") {
      TAG_AT.lastIndex = i;
      const tag = TAG_AT.exec(s);
      if (tag) {
        flush();
        tokens.push({ t: "tag", name: TAGS[tag[2]!.toLowerCase()]!, close: tag[1] === "/", matched: false });
        i += tag[0].length;
        continue;
      }
      BR_AT.lastIndex = i;
      const br = BR_AT.exec(s);
      if (br) {
        text += "\n";
        i += br[0].length;
        continue;
      }
      AUTOLINK_AT.lastIndex = i;
      const auto = AUTOLINK_AT.exec(s);
      if (auto) {
        flush();
        tokens.push({ t: "node", children: [{ text: auto[1]!, style: {} }], apply: { link: auto[1]! } });
        i += auto[0].length;
        continue;
      }
    }
    if (c === "*" || c === "_" || c === "~") {
      let j = i;
      while (s[j] === c) j++;
      const n = j - i;
      // `*` and `_` runs of one to three characters; `~` only as the pair `~~`; longer runs stay literal.
      if (n <= 3 && (c !== "~" || n === 2)) {
        flush();
        const { canOpen, canClose } = flanking(before(i), s[j] ?? " ", c);
        tokens.push({ t: "delim", ch: c, n, orig: n, canOpen, canClose, opens: [], closes: [] });
        i = j;
        continue;
      }
      text += s.slice(i, j);
      i = j;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  return tokens;
}

/** Match emphasis, strike and tag delimiters over one scope (CommonMark's nearest-opener rule). */
function resolve(tokens: Token[]): void {
  const stack: number[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k]!;
    if (token.t === "tag") {
      if (!token.close) stack.push(k);
      else {
        for (let s = stack.length - 1; s >= 0; s--) {
          const other = tokens[stack[s]!];
          if (other?.t === "tag" && other.name === token.name && !other.matched) {
            other.matched = token.matched = true;
            stack.length = s;
            break;
          }
        }
      }
      continue;
    }
    if (token.t !== "delim") continue;
    if (token.canClose) {
      while (token.n > 0) {
        let found = -1;
        for (let s = stack.length - 1; s >= 0; s--) {
          const other = tokens[stack[s]!];
          if (other?.t === "delim" && other.ch === token.ch && other.n > 0 && other.canOpen) {
            // The "multiple of 3" rule: a delimiter that can both open and close only pairs when the lengths allow.
            if ((other.canClose || token.canOpen) && (other.orig + token.orig) % 3 === 0 && !(other.orig % 3 === 0 && token.orig % 3 === 0)) continue;
            found = s;
            break;
          }
        }
        if (found < 0) break;
        const opener = tokens[stack[found]!] as Extract<Token, { t: "delim" }>;
        const use = token.ch === "~" ? 2 : Math.min(opener.n, token.n) >= 2 ? 2 : 1;
        const style: keyof Style = token.ch === "~" ? "strikethrough" : use === 2 ? "bold" : "italic";
        opener.n -= use;
        token.n -= use;
        opener.opens.push(style);
        token.closes.push(style);
        // Delimiters between the pair cannot match anything outside it.
        stack.length = opener.n > 0 ? found + 1 : found;
      }
    }
    if (token.n > 0 && token.canOpen) stack.push(k);
  }
}

function addStyle(base: Style, add: Style): Style {
  return { ...add, ...base };
}

/** Segments of a stretch of inline text, each with its style. */
function parseSegs(s: string, issue: InlineIssue, depth: number, budget: Budget): Seg[] {
  const tokens = tokenize(s, issue, depth, budget);
  resolve(tokens);
  const segs: Seg[] = [];
  const counts: Record<string, number> = {};
  const current = (): Style => {
    const style: Style = {};
    for (const key of ["bold", "italic", "strikethrough", "underline", "superscript", "subscript"] as const) if ((counts[key] ?? 0) > 0) style[key] = true;
    return style;
  };
  const push = (text: string, style: Style = current()) => {
    if (text) segs.push({ text, style });
  };
  for (const token of tokens) {
    if (token.t === "text") push(token.v);
    else if (token.t === "node") for (const child of token.children) segs.push({ text: child.text, style: addStyle(child.style, addStyle(token.apply, current())) });
    else if (token.t === "tag") {
      if (!token.matched) push(`<${token.close ? "/" : ""}${token.name === "underline" ? "u" : token.name === "superscript" ? "sup" : "sub"}>`);
      else counts[token.name] = (counts[token.name] ?? 0) + (token.close ? -1 : 1);
    } else {
      // Opening side: leftover literal characters first, then the style starts (outermost last pushed).
      for (const style of token.closes) counts[style] = (counts[style] ?? 0) - 1;
      push(token.ch.repeat(token.n));
      for (const style of [...token.opens].reverse()) counts[style] = (counts[style] ?? 0) + 1;
    }
  }
  return segs;
}

const sameStyle = (a: Style, b: Style): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Style>;
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
};

/** Parse inline text (a soft break is already a space, a hard break is `\n`) into the merged runs. */
export function parseInlineSegments(text: string, issue: InlineIssue = () => {}): Seg[] {
  const merged: Seg[] = [];
  const budget = { left: 40 * text.length + 1000 };
  for (const seg of parseSegs(text, issue, 0, budget)) {
    const last = merged.at(-1);
    if (last && sameStyle(last.style, seg.style)) last.text += seg.text;
    else merged.push({ text: seg.text, style: seg.style });
  }
  return merged;
}

const toRun = (seg: Seg): Run => {
  const keys = Object.keys(seg.style);
  if (!keys.length) return seg.text;
  const run: Obj = { text: seg.text };
  for (const key of FORMATTING) if ((seg.style as Obj)[key] !== undefined) run[key] = (seg.style as Obj)[key];
  return run;
};

/** Inline text to a TextRun value: a string when nothing is formatted, otherwise the merged runs. */
export function parseInline(text: string, issue: InlineIssue = () => {}): string | Run[] {
  const segs = parseInlineSegments(text, issue);
  if (!segs.length) return "";
  if (segs.every((seg) => !Object.keys(seg.style).length)) return segs.map((seg) => seg.text).join("");
  return segs.map(toRun);
}

/** Inline text for a field that holds plain text only (a title, a quote, a cell label): formatting is dropped and reported. */
export function parsePlainInline(text: string, issue: InlineIssue = () => {}): string {
  const segs = parseInlineSegments(text, issue);
  if (segs.some((seg) => Object.keys(seg.style).some((key) => key !== "code"))) issue("markdown/formatting-dropped", "This field holds plain text, so bold, italic, links and other formatting in it were dropped.");
  // Backticks in a plain field stay literal characters, as they were before inline code existed.
  return segs.map((seg) => (seg.style.code ? codeSpan(seg.text) : seg.text)).join("");
}

// --- serialization -----------------------------------------------------------------------------

const BLOCK_START = [
  /^#{1,6}(?:\s|$)/, // heading
  /^>/, // quote
  /^[-+*](?:\s|$)/, // bullet
  /^\d{1,9}[.)](?:\s|$)/, // numbered item
  /^(?:`{3,}|~{3,})/, // fence
  /^-{3,}\s*$/, // slide separator
  /^\|/, // table
  /^!\[/, // image
  /^Notes?:/, // speaker notes
  /^<!--/, // comment
  /^:(?:\s|$)/, // list item description
];

/** Escape the first character of a line when it would otherwise start a block. */
export function escapeLineStart(line: string): string {
  if (!BLOCK_START.some((pattern) => pattern.test(line))) return line;
  const match = /^(\d{1,9})([.)])/.exec(line);
  if (match) return `${match[1]}\\${line.slice(match[1]!.length)}`;
  const notes = /^(Notes?)(:)/.exec(line);
  if (notes) return `${notes[1]}\\${line.slice(notes[1]!.length)}`;
  return `\\${line}`;
}

/** Escape one stretch of plain text for the inline dialect. */
export function escapeInline(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const next = text[i + 1];
    // A backslash only needs escaping before punctuation or at the end of the text; a < only before something that could start a tag, an autolink or a comment.
    if (c === "\\") out += next === undefined || ASCII_PUNCT.test(next) ? "\\\\" : c;
    else if (c === "*" || c === "[" || c === "]" || c === "`") out += `\\${c}`;
    else if (c === "<") out += next !== undefined && /[A-Za-z/!]/.test(next) ? "\\<" : c;
    else if (c === "_") out += ALNUM.test(text[i - 1] ?? "") && ALNUM.test(text[i + 1] ?? "") ? c : "\\_";
    else if (c === "~") out += text[i - 1] === "~" || text[i + 1] === "~" ? "\\~" : c;
    else out += c;
  }
  return out;
}

/** Serialize one run; undefined when the run holds something the dialect cannot write. */
function serializeRun(run: Run, breakText: string): string | undefined {
  const text = runText(run);
  if (typeof run === "string") return text.split("\n").map(escapeInline).join(breakText);
  if (!isRecord(run) || typeof run.text !== "string") return undefined;
  for (const key of Object.keys(run)) if (key !== "text" && !(FORMATTING as readonly string[]).includes(key)) return undefined;
  const edge = (s: string) => s.split("\n").map(escapeInline).join(breakText);
  let lead = "";
  let trail = "";
  let out: string;
  if (run.code === true) {
    // The text of a code span is literal and has no line break; the other formatting wraps the span.
    if (!text) return "";
    if (/[\r\n]/.test(text)) return undefined;
    out = codeSpan(text);
  } else {
    lead = /^\s*/.exec(text)![0];
    trail = /\s*$/.exec(text.slice(lead.length))![0];
    const core = text.slice(lead.length, text.length - trail.length);
    if (!core) return edge(text);
    out = core.split("\n").map(escapeInline).join(breakText);
  }
  if (run.color !== undefined || run.fontSize !== undefined || run.fontFamily !== undefined || run.lang !== undefined) {
    const attrs: string[] = [];
    if (run.color !== undefined) attrs.push(`color=${attrValue(String(run.color))}`);
    if (run.fontSize !== undefined) attrs.push(`size=${String(run.fontSize)}`);
    if (run.fontFamily !== undefined) attrs.push(`font=${attrValue(String(run.fontFamily))}`);
    if (run.lang !== undefined) attrs.push(`lang=${attrValue(String(run.lang))}`);
    out = `[${out}]{${attrs.join(" ")}}`;
  }
  if (run.subscript === true) out = `<sub>${out}</sub>`;
  if (run.superscript === true) out = `<sup>${out}</sup>`;
  if (run.underline === true) out = `<u>${out}</u>`;
  if (run.strikethrough === true) out = `~~${out}~~`;
  if (run.italic === true) out = `*${out}*`;
  if (run.bold === true) out = `**${out}**`;
  if (run.link !== undefined) {
    const url = String(run.link);
    if (!url || /[\n\r<>]/.test(url)) return undefined;
    out = `[${out}](${/^[^\s()]+$/.test(url) ? url : `<${url}>`})`;
  }
  return edge(lead) + out + edge(trail);
}

/** A code span for `text`: a backtick fence longer than any backtick run inside, padded with a space where the text needs one. */
export function codeSpan(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = /^`|`$/.test(text) || (text.startsWith(" ") && text.endsWith(" ") && /[^ ]/.test(text)) ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

const attrValue = (value: string): string => (/^[^\s,"}]+$/.test(value) ? value : JSON.stringify(value));

/**
 * Serialize a TextRun value for one line of Markdown. `\n` inside the text becomes a backslash hard break (or `<br>`
 * inside a table cell). Returns the lines, or undefined when a run cannot be written.
 */
export function serializeRuns(value: unknown, mode: "paragraph" | "cell" = "paragraph"): string[] | undefined {
  const runs = typeof value === "string" ? [value] : Array.isArray(value) ? (value as Run[]) : undefined;
  if (!runs) return undefined;
  const parts: string[] = [];
  for (const run of runs) {
    const part = serializeRun(run, mode === "cell" ? "<br>" : "\\\n");
    if (part === undefined) return undefined;
    parts.push(part);
  }
  const lines = parts.join("").split("\n");
  return mode === "cell" ? [lines.join("")] : lines.map(escapeLineStart);
}
