/**
 * The JSON syntax recovery analyzer: the root cause of a syntax error, once, in plain words, with the repairs that fix it.
 *
 * A JSON parser reports the token where it gave up, and goes on to report the damage that first mistake caused. A person wants
 * the mistake. This is a small tolerant parser over its own tokens (single and typographic quotes, bare words, comments and
 * cut-off strings are tokens, not errors) that remembers what each construct should have been, so that
 *
 *     "design":                       is reported at "design": (a key with no value), once,
 *     "organization": { ... }         not at the token after it, and not again as a missing comma.
 *
 * It returns one `SyntaxProblem` per cause in position order, at most `limit` (5). Every problem has a range for the squiggle,
 * a message, a hint (`next`) and the fixes that repair it. It never throws and accepts any text (empty, a BOM, CRLF). It does
 * not look at duplicate keys or the schema: those are other findings.
 *
 * Browser-safe. Used by `parseSource` (so `validate(text)`, the CLI and agents report the same text) and by source editors.
 */
import { type FieldInfo, createSchemaValue, describeField, schemaAtPath } from "./schema-navigation.js";
import { type TextEdit, type TextRange, createLocator } from "./source-text.js";

export interface SyntaxFix {
  id: string;
  /** What a menu shows: `Insert comma`, `Remove "design"`, `Add { }`. */
  title: string;
  /** Mechanical and unambiguous: an editor may offer to apply it without a second look. */
  safe: boolean;
  /** Replacements in the offsets of the analyzed text, non-overlapping. Empty for `action`. */
  edits: TextEdit[];
  /** Where the caret goes, as an offset in the NEW text. */
  caret?: number;
  /** `switch-format`: the editor converts the text to `format`; `edits` is empty. */
  action?: "switch-format";
  format?: "yaml" | "md";
}

export interface SyntaxProblem {
  /** The cause, in kebab-case. */
  code: SyntaxProblemCode;
  severity: "error";
  /** The squiggle: the smallest text the message is about. */
  range: TextRange;
  /** What is wrong, one or two sentences, American spelling. */
  message: string;
  /** What to do, without a leading "Next:". */
  next: string;
  /** The document path of the node the problem is about, when it is known. */
  path?: (string | number)[];
  fixes: SyntaxFix[];
}

export type SyntaxProblemCode =
  | "missing-value"
  | "missing-comma"
  | "trailing-comma"
  | "double-comma"
  | "missing-colon"
  | "unclosed-object"
  | "unclosed-array"
  | "unclosed-string"
  | "unclosed-comment"
  | "content-after-root"
  | "single-quotes"
  | "typographic-quotes"
  | "bare-word"
  | "unquoted-key"
  | "comment"
  | "invalid-number"
  | "invalid-escape"
  | "invalid-unicode"
  | "control-character"
  | "looks-like-yaml"
  | "looks-like-markdown"
  | "empty-document"
  | "not-an-object"
  | "invalid-symbol";

export interface AnalyzeOptions {
  /** The most problems returned (default 5). */
  limit?: number;
}

// ---- Tokens ------------------------------------------------------------------------------------------------------------------

type Kind = "lbrace" | "rbrace" | "lbracket" | "rbracket" | "comma" | "colon" | "string" | "number" | "literal" | "badnumber" | "word" | "unknown" | "comment" | "eof";

interface Token {
  kind: Kind;
  start: number;
  /** Exclusive. */
  end: number;
  quote?: "double" | "single" | "typographic";
  terminated?: boolean;
  /** Source text of the token. */
  text: string;
  block?: boolean;
}

const WORD = /[\p{L}\p{N}_$.+\-%]/u;
const NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
const TYPOGRAPHIC = /[\u2018-\u201F\u00AB\u00BB]/;
const HEX = /^[0-9a-fA-F]{4}$/;
const isBreak = (char: string | undefined): boolean => char === "\n" || char === "\r";

interface Lexical {
  /** Offsets of the first invalid escape (the backslash) of each double-quoted string, and all of them. */
  escapes: Map<Token, number[]>;
  unicode: Map<Token, number[]>;
  controls: Map<Token, number[]>;
}

function tokenize(text: string): { tokens: Token[]; lexical: Lexical } {
  const tokens: Token[] = [];
  const lexical: Lexical = { escapes: new Map(), unicode: new Map(), controls: new Map() };
  const length = text.length;
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const push = (token: Omit<Token, "text">): Token => {
    const full = { ...token, text: text.slice(token.start, token.end) };
    tokens.push(full);
    return full;
  };
  while (index < length) {
    const char = text[index] as string;
    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      index++;
      continue;
    }
    const start = index;
    if (char === "{" || char === "}" || char === "[" || char === "]" || char === "," || char === ":") {
      index++;
      push({ kind: char === "{" ? "lbrace" : char === "}" ? "rbrace" : char === "[" ? "lbracket" : char === "]" ? "rbracket" : char === "," ? "comma" : "colon", start, end: index });
      continue;
    }
    if (char === '"') {
      index++;
      const escapes: number[] = [];
      const unicode: number[] = [];
      const controls: number[] = [];
      let terminated = false;
      while (index < length) {
        const current = text[index] as string;
        if (current === '"') {
          terminated = true;
          index++;
          break;
        }
        if (isBreak(current)) break;
        if (current === "\\") {
          const following = text[index + 1];
          if (following === undefined || isBreak(following)) {
            escapes.push(index);
            index++;
          } else if (following === "u") {
            if (HEX.test(text.slice(index + 2, index + 6))) index += 6;
            else {
              unicode.push(index);
              index += 2;
            }
          } else if ('"\\/bfnrt'.includes(following)) index += 2;
          else {
            escapes.push(index);
            index += 1 + ((following.codePointAt(0) ?? 0) > 0xffff ? 2 : 1);
          }
          continue;
        }
        if (current < " ") controls.push(index);
        index++;
      }
      const token = push({ kind: "string", start, end: index, quote: "double", terminated });
      if (escapes.length) lexical.escapes.set(token, escapes);
      if (unicode.length) lexical.unicode.set(token, unicode);
      if (controls.length) lexical.controls.set(token, controls);
      continue;
    }
    if (char === "'") {
      index++;
      let terminated = false;
      while (index < length) {
        const current = text[index] as string;
        if (isBreak(current)) break;
        if (current === "\\" && index + 1 < length && !isBreak(text[index + 1])) {
          index += 2;
          continue;
        }
        index++;
        if (current === "'") {
          terminated = true;
          break;
        }
      }
      push({ kind: "string", start, end: index, quote: "single", terminated });
      continue;
    }
    if (TYPOGRAPHIC.test(char)) {
      index++;
      let terminated = false;
      while (index < length) {
        const current = text[index] as string;
        if (isBreak(current)) break;
        index++;
        if (current === '"' || TYPOGRAPHIC.test(current)) {
          terminated = true;
          break;
        }
      }
      push({ kind: "string", start, end: index, quote: "typographic", terminated });
      continue;
    }
    if (char === "/" && text[index + 1] === "/") {
      while (index < length && !isBreak(text[index])) index++;
      push({ kind: "comment", start, end: index });
      continue;
    }
    if (char === "/" && text[index + 1] === "*") {
      const close = text.indexOf("*/", index + 2);
      index = close < 0 ? length : close + 2;
      push({ kind: "comment", start, end: index, block: true, terminated: close >= 0 });
      continue;
    }
    if (WORD.test(String.fromCodePoint(text.codePointAt(index) ?? 0))) {
      while (index < length) {
        const code = text.codePointAt(index) ?? 0;
        if (!WORD.test(String.fromCodePoint(code))) break;
        index += code > 0xffff ? 2 : 1;
      }
      const lexeme = text.slice(start, index);
      const kind: Kind = NUMBER.test(lexeme) ? "number" : lexeme === "true" || lexeme === "false" || lexeme === "null" ? "literal" : /^[+\-.]?[0-9]|^[+-]$/.test(lexeme) ? "badnumber" : "word";
      push({ kind, start, end: index });
      continue;
    }
    // Anything else: a run of characters that no JSON token starts with.
    while (index < length) {
      const code = text.codePointAt(index) ?? 0;
      const next = String.fromCodePoint(code);
      if (/[\s{}[\],:"'/]/.test(next) || TYPOGRAPHIC.test(next) || WORD.test(next)) break;
      index += code > 0xffff ? 2 : 1;
    }
    if (index === start) index += (text.codePointAt(index) ?? 0) > 0xffff ? 2 : 1;
    push({ kind: "unknown", start, end: index });
  }
  push({ kind: "eof", start: length, end: length });
  return { tokens, lexical };
}

// ---- Text helpers ------------------------------------------------------------------------------------------------------------

const KIND_NAMES: Record<string, string> = { layouts: "layout", themes: "theme", colorSchemes: "color scheme", fontSchemes: "font scheme", narratives: "narrative", audiences: "audience", purposes: "purpose", tones: "tone" };

function clip(value: string, max = 40): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

function lineBounds(text: string, offset: number): { start: number; end: number } {
  let start = offset;
  while (start > 0 && !isBreak(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && !isBreak(text[end])) end++;
  return { start, end };
}

const indentOf = (text: string, offset: number): string => /^[ \t]*/.exec(text.slice(lineBounds(text, offset).start))?.[0] ?? "";

function unquoteSingle(raw: string): string {
  // raw includes the quotes: 'it\'s "x"' -> "it's \"x\""
  const inner = raw.endsWith("'") && raw.length > 1 ? raw.slice(1, -1) : raw.slice(1);
  let result = "";
  for (let index = 0; index < inner.length; index++) {
    const char = inner[index] as string;
    if (char === "\\" && inner[index + 1] === "'") {
      result += "'";
      index++;
    } else if (char === "\\" && index + 1 < inner.length) {
      result += char + inner[index + 1];
      index++;
    } else if (char === '"') result += '\\"';
    else result += char;
  }
  return `"${result}"`;
}

// ---- The analyzer ------------------------------------------------------------------------------------------------------------

interface Container {
  type: "{" | "[";
  open: Token;
  path: (string | number)[];
}

interface ValueNode {
  start: number;
  end: number;
  kind: "object" | "array" | "string" | "scalar";
}

const YAML_START = /^[A-Za-z_][\w.-]*\s*:(?:\s|$)/;
const MINIMAL_DECK = '{\n  "slides": [\n    { "title": "" }\n  ]\n}\n';
/** The forms named in a "needs a value" hint: the one a template uses and the next different one. */
const HINT_FORMS_LIMIT = 2;

class Analyzer {
  readonly problems: Array<{ problem: SyntaxProblem; order: number }> = [];
  private readonly tokens: Token[];
  private readonly comments: Token[];
  private readonly lexical: Lexical;
  private readonly locate: (offset: number, length: number) => TextRange;
  private index = 0;
  private muteIndex = -1;
  private last: Token | undefined;
  private readonly stack: Container[] = [];
  private order = 0;
  // Containers left open at the same place close together: the outer one's fix inserts the inner ones' closers first.
  private cascade: { last: Token | undefined; inserts: string[] } = { last: undefined, inserts: [] };

  constructor(private readonly text: string) {
    const lexed = tokenize(text);
    this.comments = lexed.tokens.filter((token) => token.kind === "comment");
    this.tokens = lexed.tokens.filter((token) => token.kind !== "comment");
    this.lexical = lexed.lexical;
    this.locate = createLocator(text);
  }

  // -- reporting --

  private add(problem: Omit<SyntaxProblem, "severity">): void {
    this.problems.push({ problem: { severity: "error", ...problem }, order: this.order++ });
  }

  /** A structural problem about the token at the read position: dropped when it is the aftershock of the cause just reported. */
  private structural(problem: Omit<SyntaxProblem, "severity">): void {
    if (this.index <= this.muteIndex) return;
    this.add(problem);
  }

  private mute(): void {
    this.muteIndex = this.index;
  }

  private range(start: number, end: number): TextRange {
    return this.locate(start, Math.max(0, end - start));
  }

  private line(offset: number): number {
    return this.locate(offset, 0).line;
  }

  // -- tokens --

  private peek(ahead = 0): Token {
    return this.tokens[Math.min(this.index + ahead, this.tokens.length - 1)] as Token;
  }

  private take(): Token {
    const token = this.peek();
    if (token.kind !== "eof") {
      this.index++;
      this.last = token;
    }
    return token;
  }

  private startsEntry(offset = 0): boolean {
    const token = this.peek(offset);
    return token.kind === "string" || (token.kind === "word" && this.peek(offset + 1).kind === "colon");
  }

  // -- the document --

  run(): void {
    const first = this.peek();
    // Text that is another format is one problem; whatever else the JSON scan would say about it is noise.
    if (first.kind !== "eof" && first.kind !== "lbrace" && first.kind !== "lbracket" && this.looksLikeOtherFormat(first)) return;
    this.lexicalProblems();
    if (first.kind === "eof") {
      this.emptyDocument();
      return;
    }
    if (first.kind === "word" || first.kind === "unknown" || first.kind === "colon" || first.kind === "comma" || first.kind === "rbrace" || first.kind === "rbracket") {
      this.add({
        code: "invalid-symbol",
        range: this.range(first.start, first.end),
        message: `Unexpected ${first.kind === "word" || first.kind === "unknown" ? `\`${clip(first.text, 24)}\`` : `\`${first.text}\``} at the start of the document.`,
        next: "start with { for a deck, for example { \"slides\": [ { \"title\": \"…\" } ] }.",
        fixes: [],
      });
      return;
    }
    const root = this.parseValue([], undefined);
    if (root) {
      if (root.kind !== "object") this.notAnObject(root, first);
      // Whatever follows the root value is one problem: the rest of the text is the cause, not each token in it.
      const extra = this.peek();
      if (extra.kind !== "eof") {
        const end = this.text.trimEnd().length;
        const closer = root.kind === "object" ? "}" : root.kind === "array" ? "]" : "value";
        this.add({
          code: "content-after-root",
          range: this.range(extra.start, Math.max(end, extra.end)),
          message: `Unexpected content after the closing ${closer === "value" ? "value" : `\`${closer}\``} on line ${this.line(Math.max(root.end - 1, 0))}. A JSON file holds one value.`,
          next: "remove the extra text, or put it inside the object.",
          fixes: [{ id: "remove-extra", title: "Remove the extra text", safe: false, edits: [{ offset: root.end, length: Math.max(end, extra.end) - root.end, insert: "" }] }],
        });
      }
    }
  }

  private emptyDocument(): void {
    const length = this.text.length;
    this.add({
      code: "empty-document",
      range: this.range(0, length),
      message: "The document is empty.",
      next: 'start with { "slides": [ { "title": "…" } ] }.',
      fixes: [{ id: "insert-minimal-deck", title: "Insert minimal deck", safe: false, edits: [{ offset: 0, length, insert: MINIMAL_DECK }], caret: MINIMAL_DECK.indexOf('""') + 1 }],
    });
  }

  private looksLikeOtherFormat(first: Token): boolean {
    const head = this.text.slice(first.start);
    const lineEnd = lineBounds(this.text, first.start).end;
    const range = this.range(first.start, Math.max(first.end, this.text.slice(0, lineEnd).trimEnd().length));
    if (/^---(?:\s|$)/.test(head) || (!head.startsWith("#") && YAML_START.test(head)) || /^-\s+\S/.test(head)) {
      this.add({
        code: "looks-like-yaml",
        range,
        message: "This is not JSON. It looks like YAML.",
        next: "switch the format to YAML (read it with fromYaml, then validate the presentation it returns), or add braces and quotes to make it JSON.",
        fixes: [{ id: "switch-yaml", title: "Switch format to YAML", safe: false, edits: [], action: "switch-format", format: "yaml" }],
      });
      return true;
    }
    if (head.startsWith("#") || head.startsWith("```") || /^>\s/.test(head) || /^[*]\s+\S/.test(head)) {
      this.add({
        code: "looks-like-markdown",
        range,
        message: "This is not JSON. It looks like Markdown.",
        next: "switch the format to Markdown (read it with fromMarkdown, then validate the presentation it returns), or write the deck as a JSON object.",
        fixes: [{ id: "switch-markdown", title: "Switch format to Markdown", safe: false, edits: [], action: "switch-format", format: "md" }],
      });
      return true;
    }
    return false;
  }

  private notAnObject(root: ValueNode, first: Token): void {
    const literal = this.text.slice(root.start, root.end);
    const what = root.kind === "array" ? "an array" : root.kind === "string" ? "a string" : literal === "true" || literal === "false" ? "a boolean" : literal === "null" ? "null" : "a number";
    const wrap: SyntaxFix[] =
      root.kind === "array"
        ? [
            {
              id: "wrap-slides",
              title: 'Wrap in { "slides" ... }',
              safe: false,
              edits: [
                { offset: root.start, length: 0, insert: '{ "slides": ' },
                { offset: root.end, length: 0, insert: " }" },
              ],
            },
          ]
        : [];
    this.add({
      code: "not-an-object",
      range: this.range(first.start, root.kind === "array" ? first.end : root.end),
      message: `The top level must be an object { … }, but this is ${what}.`,
      next: root.kind === "array" ? 'wrap it as { "slides": [ … ] }.' : 'write an object such as { "slides": [ { "title": "…" } ] }.',
      fixes: wrap,
    });
  }

  // -- lexical problems (no structure needed) --

  private lexicalProblems(): void {
    for (const token of this.comments) {
      const unclosed = token.block && token.terminated === false;
      const whole = this.removalOf(token);
      if (unclosed) {
        this.add({
          code: "unclosed-comment",
          range: this.range(token.start, token.start + 2),
          message: "This `/*` comment is never closed.",
          next: "end it with `*/`, or remove it. Everything after `/*` is part of the comment.",
          fixes: [
            { id: "close-comment", title: "Close comment", safe: false, edits: [{ offset: this.text.length, length: 0, insert: " */" }] },
            { id: "remove-comment", title: "Remove comment", safe: false, edits: [whole] },
          ],
        });
      } else {
        this.add({
          code: "comment",
          range: this.range(token.start, token.end),
          message: "JSON does not allow comments.",
          next: "remove it, or switch to YAML, where # comments are kept.",
          fixes: [
            { id: "remove-comment", title: "Remove comment", safe: true, edits: [whole] },
            { id: "switch-yaml", title: "Switch format to YAML", safe: false, edits: [], action: "switch-format", format: "yaml" },
          ],
        });
      }
    }
    for (const token of this.tokens) {
      if (token.kind === "string") this.stringProblems(token);
      else if (token.kind === "badnumber") this.numberProblem(token);
      else if (token.kind === "unknown") this.unknownProblem(token);
    }
  }

  /** The edit that removes a comment: its whole line when it stands alone on it, else just the comment and the spaces before it. */
  private removalOf(token: Token): TextEdit {
    let start = token.start;
    let end = token.end;
    while (start > 0 && (this.text[start - 1] === " " || this.text[start - 1] === "\t")) start--;
    const alone = start === 0 || isBreak(this.text[start - 1]);
    let after = end;
    while (after < this.text.length && (this.text[after] === " " || this.text[after] === "\t")) after++;
    if (alone && (after >= this.text.length || isBreak(this.text[after]))) {
      end = after;
      if (this.text[end] === "\r" && this.text[end + 1] === "\n") end += 2;
      else if (end < this.text.length) end++;
      return { offset: start, length: end - start, insert: "" };
    }
    return { offset: start, length: end - start, insert: "" };
  }

  private stringProblems(token: Token): void {
    const { text } = this;
    if (token.quote === "single") {
      this.add({
        code: "single-quotes",
        range: this.range(token.start, token.end),
        message: "JSON strings use double quotes, not single quotes.",
        next: `write ${unquoteSingle(token.text)} instead of ${clip(token.text, 30)}.`,
        fixes: [{ id: "double-quotes", title: "Use double quotes", safe: true, edits: [{ offset: token.start, length: token.end - token.start, insert: unquoteSingle(token.text) }] }],
      });
      return;
    }
    if (token.quote === "typographic") {
      const edits: TextEdit[] = [{ offset: token.start, length: 1, insert: '"' }];
      if (token.terminated) edits.push({ offset: token.end - 1, length: 1, insert: '"' });
      this.add({
        code: "typographic-quotes",
        range: this.range(token.start, token.end),
        message: 'These are typographic quotes; JSON needs straight quotes (").',
        next: "replace them with straight double quotes. Word processors and chat apps change them as you paste.",
        fixes: [{ id: "straight-quotes", title: "Replace with straight quotes", safe: token.terminated === true, edits }],
      });
      return;
    }
    const escapes = this.lexical.escapes.get(token);
    const unicode = this.lexical.unicode.get(token);
    const controls = this.lexical.controls.get(token);
    if (token.terminated === false) {
      const lineEnd = token.start + clipTrailing(text.slice(token.start, token.end)).length;
      this.add({
        code: "unclosed-string",
        range: this.range(token.start, lineEnd),
        message: "This string is not closed before the end of the line.",
        next: "close it with a double quote. JSON strings stay on one line: write a line break as \\n.",
        fixes: [{ id: "close-string", title: "Close the string", safe: false, edits: [{ offset: lineEnd, length: 0, insert: '"' }] }],
      });
    }
    if (escapes?.length) {
      const first = escapes[0] as number;
      const shown = text.slice(first, first + 2);
      this.add({
        code: "invalid-escape",
        range: this.range(first, Math.min(token.end, first + 2)),
        message: `\`${shown.trim() || "\\"}\` is not a JSON escape.`,
        next: 'write a backslash as \\\\ (the valid escapes are \\" \\\\ \\/ \\b \\f \\n \\r \\t and \\uXXXX).',
        fixes: [{ id: "double-backslash", title: escapes.length > 1 ? "Double the backslashes" : "Double the backslash", safe: false, edits: escapes.map((offset) => ({ offset, length: 0, insert: "\\" })) }],
      });
    }
    if (unicode?.length) {
      const first = unicode[0] as number;
      this.add({
        code: "invalid-unicode",
        range: this.range(first, Math.min(token.end, first + 6)),
        message: "`\\u` must be followed by four hex digits.",
        next: "write the character as \\u00e9 (four digits 0 to 9 and a to f), or as the character itself.",
        fixes: [],
      });
    }
    if (controls?.length) {
      const first = controls[0] as number;
      this.add({
        code: "control-character",
        range: this.range(first, first + 1),
        message: "A tab or control character sits inside this string.",
        next: "write it as \\t, or as \\n for a line break.",
        fixes: [
          {
            id: "escape-controls",
            title: "Replace with escape",
            safe: true,
            edits: controls.map((offset) => {
              const code = text.charCodeAt(offset);
              const named: Record<number, string> = { 8: "\\b", 9: "\\t", 12: "\\f" };
              return { offset, length: 1, insert: named[code] ?? `\\u${code.toString(16).padStart(4, "0")}` };
            }),
          },
        ],
      });
    }
  }

  private numberProblem(token: Token): void {
    const word = token.text;
    const fixes: SyntaxFix[] = [];
    let message = `\`${word}\` is not a JSON number.`;
    let next = "Numbers have no leading zero, plus sign or trailing dot; put text such as 12% in quotes.";
    const numeric = (id: string, title: string, value: string): void => {
      fixes.push({ id, title, safe: false, edits: [{ offset: token.start, length: token.end - token.start, insert: value }] });
    };
    if (/^0[0-9]+$/.test(word) || /^-0[0-9]+$/.test(word)) {
      message = `\`${word}\` has a leading zero, which JSON numbers do not allow.`;
      next = 'remove the leading zero, or put it in quotes if it is an identifier such as "007".';
      numeric("remove-leading-zero", "Remove leading zeros", word.replace(/^(-?)0+(?=[0-9])/, "$1"));
    } else if (/^\+[0-9]/.test(word) && NUMBER.test(word.slice(1))) {
      message = `\`${word}\` has a plus sign, which JSON numbers do not allow.`;
      next = "remove the plus sign.";
      numeric("remove-plus", "Remove plus sign", word.slice(1));
    } else if (/^-?\.[0-9]+(?:[eE][+-]?[0-9]+)?$/.test(word)) {
      message = `\`${word}\` is missing the digit before the dot.`;
      next = `write ${word.startsWith("-") ? "-0" : "0"}${word.replace("-", "")}.`;
      numeric("add-leading-zero", "Add leading zero", `${word.startsWith("-") ? "-0" : "0"}${word.replace("-", "")}`);
    } else if (/^-?[0-9]+\.(?:[eE][+-]?[0-9]+)?$/.test(word)) {
      message = `\`${word}\` ends with a dot, which JSON numbers do not allow.`;
      next = "remove the dot or add digits after it.";
      numeric("remove-trailing-dot", "Remove trailing dot", word.replace(".", ""));
    }
    fixes.push({ id: "quote-value", title: "Quote the value", safe: false, edits: [{ offset: token.start, length: token.end - token.start, insert: JSON.stringify(word) }] });
    this.add({ code: "invalid-number", range: this.range(token.start, token.end), message, next, fixes });
  }

  private unknownProblem(token: Token): void {
    // A run of characters no JSON token starts with. Only the ones in the document body matter: the leading one of a document is
    // reported by `run` (the document does not start with a value).
    if (token === this.tokens[0]) return;
    const shown = clip(token.text, 12);
    const invisible = /^[\s\u200B-\u200D\u2060\uFEFF]+$/u.test(token.text);
    this.add({
      code: "invalid-symbol",
      range: this.range(token.start, token.end),
      message: invisible ? "An invisible or non-standard space sits here." : `Unexpected character \`${shown}\`.`,
      next: invisible ? "remove it, or replace it with a regular space. JSON allows only space, tab and line breaks between tokens." : "remove it. JSON has no use for this character outside a string.",
      fixes: [{ id: "remove-character", title: invisible ? "Replace with a space" : "Remove the character", safe: invisible, edits: [{ offset: token.start, length: token.end - token.start, insert: invisible ? " " : "" }] }],
    });
  }

  // -- values --

  private parseValue(path: (string | number)[], key: string | undefined): ValueNode | undefined {
    const token = this.peek();
    switch (token.kind) {
      case "lbrace":
        return this.parseObject(path);
      case "lbracket":
        return this.parseArray(path);
      case "string": {
        this.take();
        if (token.terminated === false) this.mute();
        return { start: token.start, end: token.end, kind: "string" };
      }
      case "number":
      case "literal":
      case "badnumber":
        this.take();
        return { start: token.start, end: token.end, kind: "scalar" };
      case "word":
        this.take();
        this.bareWord(token, path, key);
        return { start: token.start, end: token.end, kind: "scalar" };
      case "unknown":
        this.take();
        return { start: token.start, end: token.end, kind: "scalar" };
      default:
        return undefined;
    }
  }

  private bareWord(token: Token, path: (string | number)[], key: string | undefined): void {
    const word = token.text;
    const lower = word.toLowerCase();
    const edit = (insert: string): TextEdit[] => [{ offset: token.start, length: token.end - token.start, insert }];
    let message: string;
    let next: string;
    const fixes: SyntaxFix[] = [];
    if (lower === "true" || lower === "false") {
      message = `\`${word}\` is not JSON. Write ${lower} in lowercase.`;
      next = `write ${lower}, or "${word}" in quotes if it is text.`;
      fixes.push({ id: `use-${lower}`, title: `Use ${lower}`, safe: true, edits: edit(lower) });
    } else if (["none", "nil", "null", "undefined", "nan", "infinity", "-infinity", "+infinity", "inf"].includes(lower)) {
      message = lower === "null" ? "`" + word + "` is not JSON. Write null in lowercase." : `\`${word}\` is not JSON. Use null for no value.`;
      next = 'write null, or put it in quotes if it is text. JSON has no NaN, Infinity or undefined.';
      fixes.push({ id: "use-null", title: "Use null", safe: lower === "null", edits: edit("null") });
    } else {
      message = key !== undefined ? `\`${key}\` needs a quoted string: ${JSON.stringify(word)}.` : `\`${clip(word, 24)}\` needs quotes to be text: ${JSON.stringify(word)}.`;
      next = `put it in double quotes: ${JSON.stringify(word)}.`;
    }
    fixes.push({ id: "quote-value", title: "Quote the value", safe: false, edits: edit(JSON.stringify(word)) });
    this.add({ code: "bare-word", range: this.range(token.start, token.end), message, next, path: [...path], fixes });
  }

  private parseObject(path: (string | number)[]): ValueNode {
    const open = this.take();
    const container: Container = { type: "{", open, path };
    this.stack.push(container);
    let expectKey = true;
    let comma: Token | undefined;
    let lastEntry: { start: number; text: string } | undefined;
    let valueEnd = open.end;
    for (;;) {
      const token = this.peek();
      if (token.kind === "rbrace") {
        if (comma && expectKey) this.trailingComma(comma, container, lastEntry);
        this.take();
        this.stack.pop();
        return { start: open.start, end: token.end, kind: "object" };
      }
      if (token.kind === "eof") {
        this.unclosed(container);
        this.stack.pop();
        return { start: open.start, end: this.last?.end ?? open.end, kind: "object" };
      }
      if (token.kind === "rbracket") {
        if (this.closeMismatched(container, token)) return { start: open.start, end: token.end, kind: "object" };
        this.unclosed(container);
        this.stack.pop();
        return { start: open.start, end: this.last?.end ?? open.end, kind: "object" };
      }
      if (token.kind === "comma") {
        if (expectKey) this.doubleComma(token, container, comma !== undefined || lastEntry !== undefined);
        else comma = token;
        this.take();
        expectKey = true;
        continue;
      }
      if (!expectKey) {
        // A value ended and something other than a comma or the closing brace follows.
        if (this.startsEntry()) {
          this.structural({
            code: "missing-comma",
            range: this.range(valueEnd - 1, valueEnd),
            path: [...path],
            ...this.missingComma(valueEnd, lastEntry),
          });
        } else if (token.kind === "lbrace" || token.kind === "lbracket") {
          this.unclosed(container);
          this.stack.pop();
          return { start: open.start, end: this.last?.end ?? open.end, kind: "object" };
        } else {
          this.take();
          this.unexpected(token, "a comma or }");
          valueEnd = token.end;
          continue;
        }
      }
      // An entry: a name, a colon, a value.
      const entryStart = token.start;
      if (token.kind === "string" || (token.kind === "word" && this.peek(1).kind === "colon")) {
        const keyToken = this.take();
        if (token.kind === "word") this.unquotedKey(keyToken, path);
        if (keyToken.terminated === false) this.mute();
        const entryKey = keyToken.kind === "string" ? keyName(keyToken) : keyToken.text;
        const entryPath = [...path, entryKey];
        let hasColon = false;
        let colon: Token | undefined;
        if (this.peek().kind === "colon") {
          colon = this.take();
          hasColon = true;
        } else {
          const following = this.peek();
          const valueFollows = following.kind === "lbrace" || following.kind === "lbracket" || following.kind === "number" || following.kind === "literal" || following.kind === "badnumber" || following.kind === "unknown" || ((following.kind === "string" || following.kind === "word") && this.peek(1).kind !== "colon");
          this.missingColon(keyToken, entryKey, entryPath, valueFollows, container);
          if (!valueFollows) {
            // A name with nothing after it: the entry is as complete as it will get.
            this.mute();
            expectKey = false;
            comma = undefined;
            valueEnd = keyToken.end;
            lastEntry = { start: entryStart, text: clip(this.text.slice(entryStart, keyToken.end)) };
            continue;
          }
        }
        let value: ValueNode | undefined;
        const after = this.peek();
        const keyIsNext = (after.kind === "string" || after.kind === "word") && this.peek(1).kind === "colon";
        if (hasColon && (after.kind === "rbrace" || after.kind === "rbracket" || after.kind === "comma" || after.kind === "eof" || keyIsNext)) {
          this.missingValue(keyToken, colon as Token, entryKey, entryPath);
          this.mute();
          valueEnd = (colon as Token).end;
        } else {
          value = this.parseValue(entryPath, entryKey);
          valueEnd = value?.end ?? keyToken.end;
        }
        const entryEnd = value?.end ?? valueEnd;
        lastEntry = { start: entryStart, text: entryText(this.text, entryStart, entryEnd, value?.kind) };
        expectKey = false;
        comma = undefined;
        continue;
      }
      // Not a name: skip it, and parse a nested value whole so that its contents do not become more problems.
      if (token.kind === "lbrace" || token.kind === "lbracket") {
        this.unexpected(token, "a property name");
        valueEnd = this.parseValue([...path], undefined)?.end ?? valueEnd;
        this.mute();
      } else {
        this.take();
        this.unexpected(token, "a property name (a quoted string)");
        // A name that follows without a comma is the same mistake, not another one.
        this.mute();
        valueEnd = token.end;
      }
      expectKey = false;
      comma = undefined;
    }
  }

  private parseArray(path: (string | number)[]): ValueNode {
    const open = this.take();
    const container: Container = { type: "[", open, path };
    this.stack.push(container);
    let expectItem = true;
    let comma: Token | undefined;
    let count = 0;
    let valueEnd = open.end;
    let lastItem: { start: number; text: string } | undefined;
    for (;;) {
      const token = this.peek();
      if (token.kind === "rbracket") {
        if (comma && expectItem) this.trailingComma(comma, container, lastItem);
        this.take();
        this.stack.pop();
        return { start: open.start, end: token.end, kind: "array" };
      }
      if (token.kind === "eof") {
        this.unclosed(container);
        this.stack.pop();
        return { start: open.start, end: this.last?.end ?? open.end, kind: "array" };
      }
      if (token.kind === "rbrace") {
        if (this.closeMismatched(container, token)) return { start: open.start, end: token.end, kind: "array" };
        this.unclosed(container);
        this.stack.pop();
        return { start: open.start, end: this.last?.end ?? open.end, kind: "array" };
      }
      if (token.kind === "comma") {
        if (expectItem) this.doubleComma(token, container, comma !== undefined || lastItem !== undefined);
        else comma = token;
        this.take();
        expectItem = true;
        continue;
      }
      const startsValue = token.kind === "string" || token.kind === "number" || token.kind === "literal" || token.kind === "badnumber" || token.kind === "word" || token.kind === "lbrace" || token.kind === "lbracket";
      if (!startsValue) {
        this.take();
        this.unexpected(token, "a value");
        this.mute();
        valueEnd = token.end;
        continue;
      }
      if (!expectItem) {
        this.structural({
          code: "missing-comma",
          range: this.range(valueEnd - 1, valueEnd),
          path: [...path],
          ...this.missingComma(valueEnd, lastItem),
        });
      }
      const itemStart = token.start;
      const value = this.parseValue([...path, count], undefined);
      count++;
      valueEnd = value?.end ?? token.end;
      lastItem = { start: itemStart, text: entryText(this.text, itemStart, valueEnd, value?.kind) };
      expectItem = false;
      comma = undefined;
    }
  }

  // -- structural problems --

  private missingComma(valueEnd: number, previous: { start: number; text: string } | undefined): Pick<SyntaxProblem, "message" | "next" | "fixes"> {
    const line = this.line(Math.max(valueEnd - 1, 0));
    return {
      message: `Missing comma after ${previous ? `\`${previous.text}\`` : "the previous value"} (line ${line}).`,
      next: `add \`,\` right after it, on line ${line}.`,
      fixes: [{ id: "insert-comma", title: "Insert comma", safe: true, edits: [{ offset: valueEnd, length: 0, insert: "," }], caret: valueEnd + 1 }],
    };
  }

  private trailingComma(comma: Token, container: Container, previous: { start: number; text: string } | undefined): void {
    const what = container.type === "{" ? "property" : "item";
    this.add({
      code: "trailing-comma",
      range: this.range(comma.start, comma.end),
      path: [...container.path],
      message: previous ? `Trailing comma after \`${previous.text}\`. JSON does not allow a comma after the last ${what}.` : "Trailing comma. JSON does not allow a comma here.",
      next: "remove the comma.",
      fixes: [{ id: "remove-comma", title: "Remove comma", safe: true, edits: [{ offset: comma.start, length: comma.end - comma.start, insert: "" }] }],
    });
  }

  private doubleComma(comma: Token, container: Container, afterSomething: boolean): void {
    this.add({
      code: "double-comma",
      range: this.range(comma.start, comma.end),
      path: [...container.path],
      message: afterSomething ? "Two commas in a row." : `This comma has nothing before it in the ${container.type === "{" ? "object" : "list"}.`,
      next: "remove the extra comma.",
      fixes: [{ id: "remove-comma", title: "Remove comma", safe: true, edits: [{ offset: comma.start, length: comma.end - comma.start, insert: "" }] }],
    });
  }

  private unquotedKey(token: Token, path: (string | number)[]): void {
    this.add({
      code: "unquoted-key",
      range: this.range(token.start, token.end),
      path: [...path, token.text],
      message: `Property names need double quotes: ${JSON.stringify(token.text)}.`,
      next: `write ${JSON.stringify(token.text)} with quotes.`,
      fixes: [{ id: "quote-key", title: "Quote the property name", safe: true, edits: [{ offset: token.start, length: token.end - token.start, insert: JSON.stringify(token.text) }] }],
    });
  }

  private unexpected(token: Token, expected: string): void {
    this.add({
      code: "invalid-symbol",
      range: this.range(token.start, token.end),
      message: `Unexpected \`${clip(token.text, 20)}\`. Expected ${expected} here.`,
      next: "remove it, or add the missing punctuation before it.",
      fixes: [{ id: "remove-token", title: `Remove ${clip(token.text, 12)}`, safe: false, edits: [{ offset: token.start, length: token.end - token.start, insert: "" }] }],
    });
  }

  private missingColon(keyToken: Token, key: string, path: (string | number)[], valueFollows: boolean, container: Container): void {
    const keyEnd = keyToken.end;
    const shown = clip(key, 30);
    const removal = this.removeEntry(keyToken.start, keyEnd);
    this.structural({
      code: "missing-colon",
      range: this.range(keyToken.start, keyToken.end),
      path,
      message: valueFollows ? `\`${shown}\` is missing a colon.` : `\`${shown}\` has no colon and value.`,
      next: valueFollows ? "add `:` after the property name." : `write ${JSON.stringify(key)}: and a value, or remove the property.`,
      fixes: [
        { id: "insert-colon", title: "Add colon", safe: valueFollows, edits: [{ offset: keyEnd, length: 0, insert: valueFollows ? ":" : ": " }], caret: keyEnd + (valueFollows ? 1 : 2) },
        ...(valueFollows ? [] : [{ id: "remove-key", title: `Remove ${JSON.stringify(key)}`, safe: false, edits: removal }]),
      ],
    });
  }

  private missingValue(keyToken: Token, colon: Token, key: string, path: (string | number)[]): void {
    const needsComma = (() => {
      const next = this.peek();
      return (next.kind === "string" || next.kind === "word") && this.peek(1).kind === "colon";
    })();
    const hint = valueHint(path);
    const gap = this.text[colon.end] === " " || this.text[colon.end] === "\t" ? 0 : 1;
    const at = colon.end + (gap === 0 ? 1 : 0);
    // The value, and the comma the next property lacks when it follows on directly (a second edit at the same place).
    const edits: TextEdit[] = [{ offset: at, length: 0, insert: `${gap ? " " : ""}${hint.insert}` }];
    if (needsComma) edits.push({ offset: at, length: 0, insert: "," });
    const fixes: SyntaxFix[] = [{ id: "add-value", title: hint.title, safe: false, edits, caret: at + (gap ? 1 : 0) + hint.caret }];
    fixes.push({ id: "remove-key", title: `Remove ${JSON.stringify(key)}`, safe: false, edits: this.removeEntry(keyToken.start, colon.end) });
    this.structural({
      code: "missing-value",
      range: this.range(keyToken.start, colon.end),
      path,
      message: `\`${key}\` needs a value.`,
      next: `${hint.next} Press Ctrl+Space after the colon for options.`,
      fixes,
    });
  }

  /** The edits that remove an entry whose value is missing (key through colon), and the comma that belonged to it. */
  private removeEntry(start: number, end: number): TextEdit[] {
    const { text } = this;
    const before = [...this.tokens].reverse().find((token) => token.end <= start);
    const first = this.tokens.find((token) => token.start >= end);
    const second = first?.kind === "comma" ? this.tokens[this.tokens.indexOf(first) + 1] : first;
    const entryFollows = (token: Token | undefined): boolean => token !== undefined && (token.kind === "string" || (token.kind === "word" && this.tokens[this.tokens.indexOf(token) + 1]?.kind === "colon"));
    let from = start;
    let to = end;
    if (first?.kind === "comma") to = first.end;
    // Last in its object and a comma before it: that comma goes, or the property before ends in a comma.
    else if (!entryFollows(second) && before?.kind === "comma") from = before.start;
    const alone = from === start && /^[ \t]*$/.test(text.slice(lineBounds(text, start).start, start)) && /^[ \t]*$/.test(text.slice(to, lineBounds(text, Math.max(to - 1, 0)).end));
    if (alone) {
      const bounds = lineBounds(text, start);
      let lineEnd = lineBounds(text, Math.max(to - 1, 0)).end;
      if (text[lineEnd] === "\r" && text[lineEnd + 1] === "\n") lineEnd += 2;
      else if (lineEnd < text.length) lineEnd++;
      return [{ offset: bounds.start, length: lineEnd - bounds.start, insert: "" }];
    }
    return [{ offset: from, length: to - from, insert: "" }];
  }

  private unclosed(container: Container): void {
    const { text } = this;
    const closer = container.type === "{" ? "}" : "]";
    const open = container.open;
    const last = this.last && this.last.start >= open.start ? this.last : open;
    // The text ends in a string that was never closed: that is the cause, and the closer would only land inside the string.
    if (last.kind === "string" && last.terminated === false) {
      this.mute();
      return;
    }
    // The closer goes right after the last thing inside; a dangling comma is replaced by it.
    const dangling = last.kind === "comma" && last !== open;
    const insertAt = dangling ? last.start : last.end;
    const removed = dangling ? last.end - last.start : 0;
    const sameLine = this.line(open.start) === this.line(Math.max(last.end - 1, 0));
    const own = sameLine ? closer : `\n${indentOf(text, open.start)}${closer}`;
    const inner = this.cascade.last === this.last && removed === 0 ? this.cascade.inserts : [];
    const insert = inner.join("") + own;
    this.cascade = { last: this.last, inserts: [...inner, own] };
    const closers = insert.replace(/\s/g, "");
    const key = container.path.at(-1);
    const entry = typeof key === "string" ? `"${key}": ${open.text}` : open.text;
    const context = container.type === "{" ? firstEntryOf(text, open) : undefined;
    const what = container.type === "{" ? "property" : "item";
    this.add({
      code: container.type === "{" ? "unclosed-object" : "unclosed-array",
      range: this.range(open.start, open.end),
      path: [...container.path],
      message: container.type === "{" ? `The \`${entry}\` on line ${this.line(open.start)}${context ? ` (starting \`${context}\`)` : ""} is never closed.` : `The list \`${entry}\` on line ${this.line(open.start)} is never closed.`,
      next: `add \`${closer}\` after its last ${what}${sameLine ? "" : ", on its own line"}.`,
      fixes: [{ id: "insert-closer", title: `Insert ${closers}`, safe: false, edits: [{ offset: insertAt, length: removed, insert }], caret: insertAt + insert.length }],
    });
    this.mute();
  }

  /** A closing bracket of the other kind. With an enclosing container of its kind it ends that one (the current is unclosed); alone, it is a typo for the right one. */
  private closeMismatched(container: Container, token: Token): boolean {
    const wanted = container.type === "{" ? "[" : "{";
    if (this.stack.some((other) => other !== container && other.type === wanted)) return false;
    const closer = container.type === "{" ? "}" : "]";
    const open = container.open;
    this.take();
    this.stack.pop();
    this.add({
      code: container.type === "{" ? "unclosed-object" : "unclosed-array",
      range: this.range(open.start, open.end),
      path: [...container.path],
      message: `The \`${open.text}\` on line ${this.line(open.start)} is closed with \`${token.text}\`, which does not match.`,
      next: `end it with \`${closer}\`.`,
      fixes: [{ id: "replace-closer", title: `Replace ${token.text} with ${closer}`, safe: false, edits: [{ offset: token.start, length: token.end - token.start, insert: closer }] }],
    });
    return true;
  }
}

function keyName(token: Token): string {
  if (token.quote === "double" && token.terminated !== false) {
    try {
      return JSON.parse(token.text) as string;
    } catch {
      // A key with a bad escape is read as written.
    }
  }
  const inner = token.text.slice(1, token.terminated === false ? undefined : -1);
  return inner;
}

function clipTrailing(value: string): string {
  return value.replace(/[ \t]+$/, "");
}

function entryText(text: string, start: number, end: number, kind: ValueNode["kind"] | undefined): string {
  const raw = text.slice(start, end);
  if (kind === "object" || kind === "array") {
    const head = raw.slice(0, raw.indexOf(kind === "object" ? "{" : "["));
    return clip(`${head}${kind === "object" ? "{…}" : "[…]"}`, 40);
  }
  return clip(raw, 40);
}

function firstEntryOf(text: string, open: Token): string | undefined {
  const rest = text.slice(open.end, open.end + 200);
  const match = /^\s*("(?:[^"\\\n]|\\.)*"\s*:\s*(?:"(?:[^"\\\n]|\\.)*"|[^\s,{}[\]]+))/.exec(rest);
  return match?.[1] ? clip(match[1], 36) : undefined;
}

// ---- Value hints from the schema -----------------------------------------------------------------------------------------

interface ValueHint {
  next: string;
  title: string;
  insert: string;
  /** Caret position inside `insert`. */
  caret: number;
}

function jsonShort(value: unknown): string | undefined {
  const text = JSON.stringify(value);
  return text !== undefined && text.length <= 32 ? text : undefined;
}

function exampleOf(info: FieldInfo): string {
  const example = info.examples.map(jsonShort).find((item) => item !== undefined) ?? (info.enum?.[0] ? jsonShort(info.enum[0].value) : undefined);
  if (example) return example;
  const type = info.types[0];
  return type === "boolean" ? "true" : type === "number" || type === "integer" ? "1" : type === "object" ? "{ … }" : type === "array" ? "[ … ]" : '"…"';
}

function listValues(values: readonly { value: unknown }[]): string {
  const shown = values.slice(0, 5).map((entry) => String(entry.value));
  return values.length > 5 ? `one of ${values.length} values (${shown.slice(0, 3).join(", ")}, …)` : `one of ${shown.join(", ")}`;
}

function joinAlternatives(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")}, or ${items.at(-1)}`;
}

const article = (word: string): string => (/^[aeiou]/i.test(word) ? "an" : "a");

/** What a missing value could be, from the schema at `path`: the hint for the message and the one repair to offer. */
function valueHint(path: (string | number)[]): ValueHint {
  let info: FieldInfo | undefined;
  try {
    info = describeField(path);
  } catch {
    info = undefined;
  }
  if (!info?.known || !info.variants.length) {
    return { next: "write a value (text in quotes, a number, true, false, null, an object { } or a list [ ]), or remove the key.", title: 'Add ""', insert: '""', caret: 1 };
  }
  const phrases: string[] = [];
  const phrased = new Set<string>();
  const order = [info.primary, ...info.variants.map((_, index) => index).filter((index) => index !== info.primary)];
  for (const index of order) {
    const variant = info.variants[index];
    // Two forms of the same type (an audience by id or by name) read as one.
    if (!variant || phrases.length >= HINT_FORMS_LIMIT || phrased.has(variant.type)) continue;
    phrased.add(variant.type);
    let phrase: string | undefined;
    if (variant.enum?.length) phrase = listValues(variant.enum);
    else if (variant.type === "string" && info.catalogKind) {
      const example = info.examples.find((item): item is string => typeof item === "string");
      const name = KIND_NAMES[info.catalogKind] ?? "catalog";
      phrase = `${article(name)} ${name} id${example ? ` such as ${JSON.stringify(example)}` : ""}`;
    } else if (variant.type === "string") {
      const example = info.examples.find((item): item is string => typeof item === "string" && item.length <= 24);
      phrase = example ? `a string such as ${JSON.stringify(example)}` : "text in double quotes";
    } else if (variant.type === "boolean") phrase = "true or false";
    else if (variant.type === "integer" || variant.type === "number") {
      const example = info.examples.find((item): item is number => typeof item === "number");
      phrase = `a number${example !== undefined ? ` such as ${example}` : ""}`;
    } else if (variant.type === "object") {
      const keyName = variant.requiredChildren[0] ?? info.children.find((child) => !child.advanced)?.key;
      if (keyName) {
        const child = describeField([...path, keyName]);
        phrase = `an object such as { ${JSON.stringify(keyName)}: ${exampleOf(child)} }`;
      } else phrase = "an object { }";
    } else if (variant.type === "array") {
      const item = info.itemInfo;
      phrase = item?.known ? `a list such as [ ${exampleOf(item)} ]` : "a list [ ]";
    }
    if (phrase && !phrases.includes(phrase)) phrases.push(phrase);
  }
  const primary = info.variants[info.primary];
  const next = `${joinAlternatives([...phrases, "remove the key"])}.`;
  let title = 'Add ""';
  let insert = '""';
  let caret = 1;
  if (primary?.type === "object") {
    title = "Add { }";
    insert = "{}";
    caret = 1;
  } else if (primary?.type === "array") {
    title = "Add [ ]";
    insert = "[]";
    caret = 1;
  } else if (primary?.enum?.length) {
    const value = JSON.stringify(primary.enum[0]?.value);
    title = `Add ${value}`;
    insert = value;
    caret = value.length;
  } else if (primary?.type === "boolean") {
    title = "Add false";
    insert = "false";
    caret = insert.length;
  } else if (primary?.type === "integer" || primary?.type === "number") {
    let value = "0";
    try {
      const made = createSchemaValue(schemaAtPath({}, path));
      if (typeof made === "number") value = String(made);
    } catch {
      // The default stands.
    }
    title = `Add ${value}`;
    insert = value;
    caret = insert.length;
  }
  return { next, title, insert, caret };
}

/**
 * The root causes of the syntax errors in a JSON text, one problem per cause, in position order, at most `options.limit` (5).
 * Each carries the range for a squiggle, a message, a hint and the fixes. Accepts any text and never throws. A text that is valid
 * JSON returns `[]`, except that a top level which is not an object (`not-an-object`) is a problem for an OPF document.
 */
export function analyzeJsonSyntax(text: string, options: AnalyzeOptions = {}): SyntaxProblem[] {
  const limit = Math.max(0, options.limit ?? 5);
  const analyzer = new Analyzer(String(text ?? ""));
  try {
    analyzer.run();
  } catch {
    // The analyzer is advice about broken text; a failure in it must not break reading it.
    return [];
  }
  const seen = new Set<string>();
  return analyzer.problems
    .sort((a, b) => a.problem.range.offset - b.problem.range.offset || a.order - b.order)
    .map((entry) => entry.problem)
    .filter((problem) => {
      const id = `${problem.code}:${problem.range.offset}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, limit);
}
