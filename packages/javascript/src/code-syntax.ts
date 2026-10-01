/**
 * Deterministic syntax highlighting shared by the SVG preview and the PPTX export (RR-07).
 *
 * `tokenizeCode(source, language)` returns coloured token ranges over the exact source
 * string; everything between tokens is plain. `codeSyntaxPalette` derives one colour per
 * token kind from the deck theme and keeps each at WCAG contrast >= 4.5:1 against the code
 * panel. The scanner is a small hand-written one (no dependency, no network, no locale or
 * clock input): it recognises comments, strings, numbers, keywords, definition names, calls,
 * capitalised types and the structure of JSON, YAML, TOML, HTML/XML and CSS. It never edits
 * the text: callers colour ranges of `code.source` and the concatenated runs equal the source.
 * An unknown or missing language yields no tokens (plain text).
 */

import { channels, fromHsl, legible, normalize, toHsl } from './legible-color.js';

export type CodeTokenKind = 'comment' | 'keyword' | 'string' | 'number' | 'function' | 'type' | 'property';
export interface CodeToken { start: number; end: number; kind: CodeTokenKind }
/** A slice of one source line: `kind` is absent for plain text. */
export interface CodeRun { start: number; end: number; kind?: CodeTokenKind }
export type CodeSyntaxPalette = Record<CodeTokenKind | 'plain', string>;

/** Source longer than this is left plain: highlighting must stay bounded. */
export const CODE_HIGHLIGHT_MAX_LENGTH = 200_000;
/** Contrast the palette keeps against the code panel. */
export const CODE_SYNTAX_MIN_CONTRAST = 4.5;
/** The code panel colour the preview and the PPTX export both draw. */
export const CODE_PANEL_BACKGROUND = '#111827';
export const CODE_PANEL_FOREGROUND = '#E5E7EB';

interface Language {
  line?: string[];
  block?: [string, string][];
  strings?: string;
  rawStrings?: string;
  triple?: string[];
  keywords?: string;
  literals?: string;
  types?: string;
  defs?: Record<string, 'function' | 'type'>;
  ci?: boolean;
  capsTypes?: boolean;
  calls?: boolean;
  decorators?: boolean;
  variables?: boolean;
  macros?: boolean;
  directives?: boolean;
  quotedKeys?: boolean;
  noEscapes?: string;
  kind?: 'yaml' | 'ini' | 'markup' | 'css';
}

const set = (words?: string) => new Set((words ?? '').split(/\s+/).filter(Boolean));

const JS_KEYWORDS = 'break case catch class const continue debugger default delete do else enum export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await as get set declare namespace module abstract implements interface private protected public readonly override keyof satisfies type is infer';
const JS: Language = { line: ['//'], block: [['/*', '*/']], strings: '\'"`', keywords: JS_KEYWORDS, literals: 'true false null undefined NaN Infinity', types: 'string number boolean object symbol bigint never unknown any void', defs: { function: 'function', class: 'type', interface: 'type', enum: 'type', type: 'type' }, capsTypes: true, calls: true, decorators: true };
const C_LIKE_KEYWORDS = 'auto break case catch char class const constexpr continue default delete do double else enum explicit extern false final float for friend goto if inline int long mutable namespace new noexcept nullptr operator override private protected public register return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while';
const LANGUAGES: Record<string, Language> = {
  javascript: JS,
  typescript: JS,
  python: { line: ['#'], strings: '\'"', triple: ['"""', "'''"], keywords: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case self cls', literals: 'True False None', types: 'int float str bool bytes list dict set tuple object type', defs: { def: 'function', class: 'type' }, capsTypes: true, calls: true, decorators: true },
  rust: { line: ['//'], block: [['/*', '*/']], strings: '"', rawStrings: 'r', keywords: 'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while', literals: 'true false', types: 'i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box', defs: { fn: 'function', struct: 'type', enum: 'type', trait: 'type', type: 'type', mod: 'type' }, capsTypes: true, calls: true, macros: true },
  go: { line: ['//'], block: [['/*', '*/']], strings: '"\'`', noEscapes: '`', keywords: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var', literals: 'true false nil iota', types: 'int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 string bool byte rune error any', defs: { func: 'function', type: 'type' }, capsTypes: true, calls: true },
  bash: { line: ['#'], strings: '\'"', noEscapes: '\'', keywords: 'if then else elif fi for while until do done case esac in function select time return exit break continue export local readonly declare unset set shift source alias trap eval exec', literals: 'true false', variables: true, calls: false },
  json: { line: ['//'], block: [['/*', '*/']], strings: '"', literals: 'true false null', quotedKeys: true },
  yaml: { kind: 'yaml' },
  toml: { kind: 'ini', line: ['#'] },
  ini: { kind: 'ini', line: ['#', ';'] },
  markup: { kind: 'markup' },
  css: { kind: 'css' },
  sql: { line: ['--'], block: [['/*', '*/']], strings: '\'"', ci: true, keywords: 'add all alter and any as asc between by case check column commit constraint create cross database default delete desc distinct drop else end exists foreign from full group having if in index inner insert into is join key left like limit not null offset on or order outer primary references replace right rollback select set table then top union unique update values view when where with', literals: 'true false', types: 'int integer bigint smallint decimal numeric float real double varchar char text date time timestamp boolean serial uuid json' },
  java: { line: ['//'], block: [['/*', '*/']], strings: '"\'', keywords: 'abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try var volatile while record sealed permits', literals: 'true false null', types: 'boolean byte char double float int long short void String Object', defs: { class: 'type', interface: 'type', enum: 'type', record: 'type' }, capsTypes: true, calls: true, decorators: true },
  csharp: { line: ['//'], block: [['/*', '*/']], strings: '"\'', keywords: 'abstract as async await base break case catch checked class const continue default delegate do else enum event explicit extern finally fixed for foreach goto if implicit in interface internal is lock namespace new operator out override params private protected public readonly ref return sealed sizeof stackalloc static struct switch this throw try typeof unchecked unsafe using var virtual volatile while record init required', literals: 'true false null', types: 'bool byte char decimal double float int long object sbyte short string uint ulong ushort void dynamic', defs: { class: 'type', interface: 'type', struct: 'type', enum: 'type', record: 'type' }, capsTypes: true, calls: true, decorators: false },
  kotlin: { line: ['//'], block: [['/*', '*/']], strings: '"\'', triple: ['"""'], keywords: 'abstract actual annotation as break by catch class companion const constructor continue crossinline data do else enum expect external final finally for fun get if import in infix init inline inner interface internal is it lateinit lazy noinline object open operator out override package private protected public reified return sealed set super suspend tailrec this throw try typealias val var vararg when where while', literals: 'true false null', types: 'Int Long Short Byte Float Double Boolean Char String Unit Any Nothing', defs: { fun: 'function', class: 'type', interface: 'type', object: 'type' }, capsTypes: true, calls: true, decorators: true },
  swift: { line: ['//'], block: [['/*', '*/']], strings: '"', triple: ['"""'], keywords: 'actor as associatedtype async await break case catch class continue default defer deinit do else enum extension fallthrough fileprivate for func guard if import in init inout internal is let nonisolated open operator private protocol public repeat rethrows return self Self static struct subscript super switch throw throws try typealias var where while', literals: 'true false nil', types: 'Int Double Float Bool String Character Array Dictionary Set Optional Any', defs: { func: 'function', class: 'type', struct: 'type', enum: 'type', protocol: 'type', extension: 'type' }, capsTypes: true, calls: true, decorators: true },
  ruby: { line: ['#'], strings: '\'"', keywords: 'alias and begin break case class def defined do else elsif end ensure for if in module next not or redo rescue retry return self super then undef unless until when while yield require require_relative include extend attr_accessor attr_reader attr_writer private protected public', literals: 'true false nil', defs: { def: 'function', class: 'type', module: 'type' }, capsTypes: true, calls: true },
  php: { line: ['//', '#'], block: [['/*', '*/']], strings: '\'"', keywords: 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield', literals: 'true false null TRUE FALSE NULL', defs: { function: 'function', class: 'type', interface: 'type', trait: 'type' }, capsTypes: true, calls: true, variables: true },
  c: { line: ['//'], block: [['/*', '*/']], strings: '"\'', keywords: C_LIKE_KEYWORDS, literals: 'true false NULL nullptr', types: 'size_t ssize_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t bool FILE', calls: true, capsTypes: false, directives: true, defs: { struct: 'type', enum: 'type', union: 'type', class: 'type' } },
  hcl: { line: ['#', '//'], block: [['/*', '*/']], strings: '"', keywords: 'resource data variable output locals module provider terraform for in if else dynamic content backend required_providers lifecycle', literals: 'true false null', types: 'string number bool list map set object tuple any', calls: true },
  dockerfile: { line: ['#'], strings: '\'"', keywords: 'FROM RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL AS', variables: true },
};
const ALIASES: Record<string, string> = {
  js: 'javascript', javascript: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', node: 'javascript', nodejs: 'javascript',
  ts: 'typescript', typescript: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  python: 'python', py: 'python', python3: 'python', py3: 'python',
  rust: 'rust', rs: 'rust', go: 'go', golang: 'go',
  bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', shellscript: 'bash', fish: 'bash',
  json: 'json', jsonc: 'json', json5: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', ini: 'ini', conf: 'ini', cfg: 'ini', properties: 'ini', env: 'ini',
  markup: 'markup', html: 'markup', xml: 'markup', svg: 'markup', xhtml: 'markup', vue: 'markup', plist: 'markup',
  css: 'css', scss: 'css', less: 'css', sass: 'css', sql: 'sql', postgres: 'sql', postgresql: 'sql', mysql: 'sql', sqlite: 'sql', pgsql: 'sql',
  java: 'java', csharp: 'csharp', cs: 'csharp', 'c#': 'csharp', kotlin: 'kotlin', kt: 'kotlin', swift: 'swift', ruby: 'ruby', rb: 'ruby', php: 'php',
  c: 'c', h: 'c', cpp: 'c', 'c++': 'c', cc: 'c', cxx: 'c', hpp: 'c', hh: 'c', objc: 'c',
  hcl: 'hcl', terraform: 'hcl', tf: 'hcl', tfvars: 'hcl', dockerfile: 'dockerfile', docker: 'dockerfile',
};

/** Language ids with a scanner (the keys the aliases resolve to). */
export const CODE_HIGHLIGHT_LANGUAGES: readonly string[] = Object.freeze(Object.keys(LANGUAGES));

/** The scanner id for a `code.language` value, or undefined when the language is not highlighted. */
export function resolveCodeLanguage(language: unknown): string | undefined {
  if (typeof language !== 'string') return undefined;
  const key = language.trim().toLowerCase().replace(/^(?:language|lang)[-:]/, '').replace(/^\./, '');
  return Object.hasOwn(ALIASES, key) ? ALIASES[key] : undefined;
}

const IDENT = /[\p{L}_$][\p{L}\p{N}_$]*/uy;
const NUMBER = /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)[a-zA-Z]{0,4}/y;
const isIdentChar = (character: string | undefined) => character !== undefined && /[\p{L}\p{N}_$]/u.test(character);

function endOfLine(source: string, from: number) {
  const index = source.slice(from).search(/\r\n|\r|\n/);
  return index < 0 ? source.length : from + index;
}

function pushToken(tokens: CodeToken[], start: number, end: number, kind: CodeTokenKind) {
  if (end <= start) return;
  const last = tokens[tokens.length - 1];
  if (last && last.kind === kind && last.end === start && kind !== 'function' && kind !== 'property') last.end = end;
  else tokens.push({ start, end, kind });
}

function scanQuoted(source: string, from: number, quote: string, escapes: boolean, multiline: boolean) {
  let index = from + 1;
  while (index < source.length) {
    const character = source[index]!;
    if (escapes && character === '\\') { index += 2; continue; }
    if (character === quote) return index + 1;
    if (!multiline && (character === '\n' || character === '\r')) return index;
    index++;
  }
  return source.length;
}

function scanGeneric(source: string, def: Language): CodeToken[] {
  const tokens: CodeToken[] = [];
  const keywords = set(def.keywords), literals = set(def.literals), types = set(def.types);
  const fold = (word: string) => def.ci ? word.toLowerCase() : word;
  if (def.ci) for (const list of [keywords, literals, types]) for (const word of [...list]) { list.delete(word); list.add(word.toLowerCase()); }
  const strings = def.strings ?? '', lineComments = def.line ?? [], blocks = def.block ?? [], triples = def.triple ?? [];
  let index = 0, pendingDef: 'function' | 'type' | undefined;
  const atLineStart = (position: number) => /^[ \t]*$/.test(source.slice(Math.max(source.lastIndexOf('\n', position - 1), source.lastIndexOf('\r', position - 1)) + 1, position));
  while (index < source.length) {
    const character = source[index]!;
    if (/\s/.test(character)) { index++; continue; }
    // Comments.
    const lineComment = lineComments.find(opener => source.startsWith(opener, index));
    if (lineComment && !(lineComment === '#' && def.directives) && !(lineComment === '#' && def.variables && source[index - 1] === '$')
      && !(def.variables && lineComment === '#' && index > 0 && !/[\s;&|(]/.test(source[index - 1]!))) {
      const end = endOfLine(source, index);
      pushToken(tokens, index, end, 'comment'); index = end; continue;
    }
    const block = blocks.find(([opener]) => source.startsWith(opener, index));
    if (block) {
      const close = source.indexOf(block[1], index + block[0].length);
      const end = close < 0 ? source.length : close + block[1].length;
      pushToken(tokens, index, end, 'comment'); index = end; continue;
    }
    // C preprocessor lines.
    if (def.directives && character === '#' && atLineStart(index)) {
      const match = /#[ \t]*\w+/y; match.lastIndex = index;
      const found = match.exec(source);
      if (found) {
        pushToken(tokens, index, index + found[0].length, 'keyword'); index += found[0].length;
        if (/include/.test(found[0])) {
          const header = /[ \t]*(<[^>\n]*>)/y; header.lastIndex = index;
          const matched = header.exec(source);
          if (matched) { const start = index + matched[0].length - matched[1]!.length; pushToken(tokens, start, start + matched[1]!.length, 'string'); index += matched[0].length; }
        }
        continue;
      }
    }
    // Strings.
    const triple = triples.find(opener => source.startsWith(opener, index));
    if (triple) {
      const close = source.indexOf(triple, index + 3);
      const end = close < 0 ? source.length : close + 3;
      pushToken(tokens, index, end, 'string'); index = end; pendingDef = undefined; continue;
    }
    if (def.rawStrings && character === def.rawStrings && /^r#*"/.test(source.slice(index, index + 8)) && !isIdentChar(source[index - 1])) {
      const hashes = /^r(#*)"/.exec(source.slice(index, index + 8))![1]!;
      const close = source.indexOf(`"${hashes}`, index + 2 + hashes.length);
      const end = close < 0 ? source.length : close + 1 + hashes.length;
      pushToken(tokens, index, end, 'string'); index = end; continue;
    }
    if (strings.includes(character)) {
      // Rust lifetimes and labels ('a) are not character literals.
      if (def === LANGUAGES.rust && character === "'" && !/^'(?:\\.[^']*|[^\\'])'/.test(source.slice(index, index + 12))) {
        const match = /'[\p{L}_][\p{L}\p{N}_]*/uy; match.lastIndex = index;
        const found = match.exec(source);
        const end = index + (found ? found[0].length : 1);
        if (found) pushToken(tokens, index, end, 'type');
        index = end; continue;
      }
      // Apostrophes in languages that use ' only as a prefix-free quote are strings.
      const escapes = !(def.noEscapes ?? '').includes(character);
      const multiline = character === '`';
      const end = scanQuoted(source, index, character, escapes, multiline);
      let kind: CodeTokenKind = 'string';
      if (def.quotedKeys) { const after = /^[ \t]*:/.exec(source.slice(end, end + 40)); if (after) kind = 'property'; }
      pushToken(tokens, index, end, kind); index = end; pendingDef = undefined; continue;
    }
    // Variables: $name, ${name}, $1, $@.
    if (def.variables && character === '$') {
      const match = /\$(?:\{[^}\n]*\}|[A-Za-z_]\w*|[0-9@#?!$*-])/y; match.lastIndex = index;
      const found = match.exec(source);
      if (found) { pushToken(tokens, index, index + found[0].length, 'property'); index += found[0].length; continue; }
    }
    // Decorators and annotations.
    if (def.decorators && character === '@' && /[\p{L}_]/u.test(source[index + 1] ?? '')) {
      const match = /@[\p{L}_][\p{L}\p{N}_$.]*/uy; match.lastIndex = index;
      const found = match.exec(source)!;
      pushToken(tokens, index, index + found[0].length, 'function'); index += found[0].length; continue;
    }
    // Numbers (never the digits inside an identifier: identifiers are consumed whole below).
    if (/\d/.test(character) && !isIdentChar(source[index - 1])) {
      NUMBER.lastIndex = index;
      const found = NUMBER.exec(source);
      if (found) { pushToken(tokens, index, index + found[0].length, 'number'); index += found[0].length; pendingDef = undefined; continue; }
    }
    // String prefixes (f"", r"", b'', u""): the prefix colours with its string.
    if (def === LANGUAGES.python && /[rRbBfFuU]/.test(character) && /^[rRbBfFuU]{1,2}['"]/.test(source.slice(index, index + 3)) && !isIdentChar(source[index - 1])) {
      const prefix = /^[rRbBfFuU]{1,2}/.exec(source.slice(index, index + 3))![0].length;
      const quote = source[index + prefix]!;
      const triple = source.startsWith(quote.repeat(3), index + prefix);
      let end: number;
      if (triple) { const close = source.indexOf(quote.repeat(3), index + prefix + 3); end = close < 0 ? source.length : close + 3; }
      else end = scanQuoted(source, index + prefix, quote, !/[rR]/.test(source.slice(index, index + prefix)), false);
      pushToken(tokens, index, end, 'string'); index = end; pendingDef = undefined; continue;
    }
    IDENT.lastIndex = index;
    const identifier = IDENT.exec(source);
    if (identifier) {
      const word = identifier[0], end = index + word.length, folded = fold(word);
      let kind: CodeTokenKind | undefined;
      if (pendingDef && !keywords.has(folded)) kind = pendingDef;
      else if (keywords.has(folded)) { kind = 'keyword'; pendingDef = def.defs && Object.hasOwn(def.defs, folded) ? def.defs[folded] : undefined; pushToken(tokens, index, end, kind); index = end; continue; }
      else if (literals.has(word) || literals.has(folded)) kind = 'number';
      else if (types.has(folded)) kind = 'type';
      else if (def.calls && source[end] === '(' ) kind = 'function';
      else if (def.macros && source[end] === '!' && /[([{]/.test(source[end + 1] ?? '')) kind = 'function';
      else if (def.capsTypes && /^[A-Z]/.test(word) && /[a-z]/.test(word)) kind = 'type';
      pendingDef = undefined;
      if (kind) pushToken(tokens, index, end, kind);
      index = end; continue;
    }
    pendingDef = undefined;
    index++;
  }
  return tokens;
}

const YAML_LITERALS = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off', '~', 'True', 'False', 'Null', 'TRUE', 'FALSE', 'NULL']);

function scanYamlValue(source: string, start: number, end: number, tokens: CodeToken[], comments: string) {
  let index = start;
  while (index < end) {
    const character = source[index]!;
    if (character === '#' && (index === start || /\s/.test(source[index - 1]!)) && comments.includes('#')) { pushToken(tokens, index, end, 'comment'); return; }
    if (character === ';' && comments.includes(';') && (index === start || /\s/.test(source[index - 1]!))) { pushToken(tokens, index, end, 'comment'); return; }
    if (character === '"' || character === "'") {
      const close = scanQuoted(source, index, character, character === '"', false);
      pushToken(tokens, index, Math.min(close, end), 'string'); index = Math.min(close, end); continue;
    }
    if ((character === '&' || character === '*') && /[\w-]/.test(source[index + 1] ?? '')) {
      const match = /[&*][\w-]+/y; match.lastIndex = index; const found = match.exec(source)!;
      pushToken(tokens, index, index + found[0].length, 'type'); index += found[0].length; continue;
    }
    if (!isIdentChar(source[index - 1]) && /[\d-]/.test(character)) {
      const match = /-?\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?(?=[\s,\]}]|$)/y; match.lastIndex = index;
      const found = match.exec(source);
      if (found && index + found[0].length <= end) { pushToken(tokens, index, index + found[0].length, 'number'); index += found[0].length; continue; }
    }
    const word = /[\w.~-]+/y; word.lastIndex = index;
    const found = word.exec(source);
    if (found) {
      if (YAML_LITERALS.has(found[0]) && !/[\w.-]/.test(source[index + found[0].length] ?? '')) pushToken(tokens, index, index + found[0].length, 'number');
      index += found[0].length; continue;
    }
    index++;
  }
}

function lineRanges(source: string) {
  const ranges: { start: number; end: number }[] = [];
  let cursor = 0;
  const pattern = /\r\n|\r|\n/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) { ranges.push({ start: cursor, end: match.index }); cursor = match.index + match[0].length; }
  ranges.push({ start: cursor, end: source.length });
  return ranges;
}

function scanYaml(source: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let blockIndent = -1;
  for (const { start, end } of lineRanges(source)) {
    const text = source.slice(start, end), indent = /^ */.exec(text)![0].length;
    if (blockIndent >= 0) {
      if (text.trim() === '' || indent > blockIndent) { if (text.trim() !== '') pushToken(tokens, start + indent, end, 'string'); continue; }
      blockIndent = -1;
    }
    if (/^\s*#/.test(text)) { pushToken(tokens, start + indent, end, 'comment'); continue; }
    if (/^(?:---|\.\.\.)(?:\s|$)/.test(text)) { pushToken(tokens, start, start + 3, 'keyword'); scanYamlValue(source, start + 3, end, tokens, '#'); continue; }
    let cursor = start + indent;
    const dash = /^(?:-\s+)+/.exec(text.slice(indent));
    if (dash) cursor += dash[0].length;
    const key = /^(?:"(?:[^"\\\n]|\\.)*"|'[^'\n]*'|[^\s#:'"{}[\],&*!|>%@`-][^#\n]*?|-[^\s#:][^#\n]*?)\s*:(?=\s|$)/.exec(source.slice(cursor, end));
    let valueStart = cursor;
    if (key) {
      const name = /^(.*?)(\s*:)$/s.exec(key[0])!;
      pushToken(tokens, cursor, cursor + name[1]!.length, 'property');
      valueStart = cursor + key[0].length;
    }
    scanYamlValue(source, valueStart, end, tokens, '#');
    if (/(?:^|\s)[|>][+-]?\d?\s*(?:#.*)?$/.test(text.slice(valueStart - start))) blockIndent = indent;
  }
  return tokens;
}

function scanIni(source: string, def: Language): CodeToken[] {
  const tokens: CodeToken[] = [], comments = (def.line ?? []).join('');
  for (const { start, end } of lineRanges(source)) {
    const text = source.slice(start, end), indent = /^\s*/.exec(text)![0].length, first = text[indent];
    if (first === undefined) continue;
    if (comments.includes(first)) { pushToken(tokens, start + indent, end, 'comment'); continue; }
    if (first === '[') {
      const close = text.indexOf(']', indent);
      const stop = close < 0 ? end : start + close + 1;
      pushToken(tokens, start + indent, stop, 'type');
      scanYamlValue(source, stop, end, tokens, comments); continue;
    }
    const key = /^("[^"\n]*"|'[^'\n]*'|[^\s=:#;"']+(?:\s+[^\s=:#;"']+)*)\s*[=:]/.exec(text.slice(indent));
    let valueStart = start + indent;
    if (key) { pushToken(tokens, start + indent, start + indent + key[1]!.length, 'property'); valueStart = start + indent + key[0].length; }
    scanYamlValue(source, valueStart, end, tokens, comments);
  }
  return tokens;
}

function scanMarkup(source: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf('<', index);
    if (open < 0) break;
    if (source.startsWith('<!--', open)) {
      const close = source.indexOf('-->', open + 4);
      const end = close < 0 ? source.length : close + 3;
      pushToken(tokens, open, end, 'comment'); index = end; continue;
    }
    if (source.startsWith('<![CDATA[', open)) {
      const close = source.indexOf(']]>', open);
      const end = close < 0 ? source.length : close + 3;
      pushToken(tokens, open, end, 'string'); index = end; continue;
    }
    const name = /<([/?!]?)([A-Za-z][\w:.-]*|DOCTYPE)?/y; name.lastIndex = open;
    const found = name.exec(source);
    if (!found || !found[2]) { index = open + 1; continue; }
    pushToken(tokens, open + 1, open + found[0].length, 'keyword');
    index = open + found[0].length;
    while (index < source.length && source[index] !== '>') {
      const character = source[index]!;
      if (character === '"' || character === "'") {
        const close = source.indexOf(character, index + 1);
        const end = close < 0 ? source.length : close + 1;
        pushToken(tokens, index, end, 'string'); index = end; continue;
      }
      const attribute = /[A-Za-z_:@#][\w:.@#-]*/y; attribute.lastIndex = index;
      const matched = attribute.exec(source);
      if (matched) { pushToken(tokens, index, index + matched[0].length, 'property'); index += matched[0].length; continue; }
      index++;
    }
    if (source[index] === '>') index++;
  }
  return tokens;
}

function scanCss(source: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let index = 0, depth = 0;
  while (index < source.length) {
    const character = source[index]!;
    if (/\s/.test(character)) { index++; continue; }
    if (source.startsWith('/*', index)) {
      const close = source.indexOf('*/', index + 2);
      const end = close < 0 ? source.length : close + 2;
      pushToken(tokens, index, end, 'comment'); index = end; continue;
    }
    if (character === '"' || character === "'") {
      const end = scanQuoted(source, index, character, true, false);
      pushToken(tokens, index, end, 'string'); index = end; continue;
    }
    if (character === '{') { depth++; index++; continue; }
    if (character === '}') { depth = Math.max(0, depth - 1); index++; continue; }
    if (character === '@') {
      const match = /@[\w-]+/y; match.lastIndex = index; const found = match.exec(source);
      if (found) { pushToken(tokens, index, index + found[0].length, 'keyword'); index += found[0].length; continue; }
    }
    if (character === '!' ) {
      const match = /!\s*important/y; match.lastIndex = index; const found = match.exec(source);
      if (found) { pushToken(tokens, index, index + found[0].length, 'keyword'); index += found[0].length; continue; }
    }
    if (character === '#' && depth > 0) {
      const match = /#[\da-fA-F]{3,8}\b/y; match.lastIndex = index; const found = match.exec(source);
      if (found) { pushToken(tokens, index, index + found[0].length, 'number'); index += found[0].length; continue; }
    }
    if (depth > 0 && (/\d/.test(character) || ((character === '-' || character === '.' || character === '+') && /\d/.test(source[index + 1] ?? '')))) {
      const match = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?:%|[a-zA-Z]+)?/y; match.lastIndex = index; const found = match.exec(source);
      if (found && !isIdentChar(source[index - 1])) { pushToken(tokens, index, index + found[0].length, 'number'); index += found[0].length; continue; }
    }
    const word = /-?[\p{L}_][\p{L}\p{N}_-]*/uy; word.lastIndex = index;
    const found = word.exec(source);
    if (found) {
      const end = index + found[0].length;
      let back = index - 1; while (back >= 0 && /\s/.test(source[back]!)) back--;
      const before = back >= 0 ? source[back]! : '';
      if (depth > 0 && /^\s*:(?!:)/.test(source.slice(end, end + 8)) && (before === '{' || before === ';' || before === '')) pushToken(tokens, index, end, 'property');
      else if (source[end] === '(') pushToken(tokens, index, end, 'function');
      index = end; continue;
    }
    if (depth === 0 && (character === '.' || character === '#')) {
      const match = /[.#][\p{L}_-][\p{L}\p{N}_-]*/uy; match.lastIndex = index; const matched = match.exec(source);
      if (matched) { pushToken(tokens, index, index + matched[0].length, 'type'); index += matched[0].length; continue; }
    }
    index++;
  }
  return tokens;
}

/**
 * Token ranges of `source` for a `code.language` value, sorted and non-overlapping. Empty for
 * an unknown language, a missing language, or source longer than CODE_HIGHLIGHT_MAX_LENGTH.
 */
export function tokenizeCode(source: string, language?: unknown): CodeToken[] {
  const id = resolveCodeLanguage(language);
  if (id === undefined || typeof source !== 'string' || source.length === 0 || source.length > CODE_HIGHLIGHT_MAX_LENGTH) return [];
  const def = LANGUAGES[id]!;
  let tokens: CodeToken[];
  switch (def.kind) {
    case 'yaml': tokens = scanYaml(source); break;
    case 'ini': tokens = scanIni(source, def); break;
    case 'markup': tokens = scanMarkup(source); break;
    case 'css': tokens = scanCss(source); break;
    default: tokens = scanGeneric(source, def);
  }
  return tokens.filter(token => token.end > token.start).sort((a, b) => a.start - b.start);
}

/**
 * The runs of one source line `[start, end)`: consecutive slices that cover the line exactly.
 * A token that crosses the line boundary is clipped, so each native text line can be coloured
 * on its own while concatenating the runs returns the line text unchanged. With `source`, a tab
 * character is always its own plain run, as in the preview where a tab is a measured segment: a
 * token (a multi-line string, say) never colours a tab stop.
 */
export function codeLineRuns(tokens: readonly CodeToken[], start: number, end: number, source?: string): CodeRun[] {
  const runs: CodeRun[] = [];
  const push = (from: number, to: number, kind?: CodeTokenKind) => {
    if (kind === undefined || source === undefined || !source.slice(from, to).includes('\t')) { runs.push(kind === undefined ? { start: from, end: to } : { start: from, end: to, kind }); return; }
    let at = from;
    for (let index = from; index < to; index++) {
      if (source[index] !== '\t') continue;
      if (index > at) runs.push({ start: at, end: index, kind });
      runs.push({ start: index, end: index + 1 });
      at = index + 1;
    }
    if (at < to) runs.push({ start: at, end: to, kind });
  };
  let cursor = start;
  for (const token of tokens) {
    if (token.end <= start) continue;
    if (token.start >= end) break;
    const from = Math.max(token.start, start), to = Math.min(token.end, end);
    if (from > cursor) push(cursor, from);
    push(from, to, token.kind);
    cursor = to;
  }
  if (cursor < end) push(cursor, end);
  return runs;
}

const distance = (a: string, b: string) => Math.hypot(...channels(a).map((value, index) => value - channels(b)[index]!));

export interface CodeSyntaxPaletteOptions {
  background?: string;
  foreground?: string;
  minimumContrast?: number;
}
export interface CodeSyntaxPaletteTheme { primary?: string; secondary?: string; accent?: string; mutedText?: string }

const FALLBACK: Record<CodeTokenKind, string> = { keyword: '#C4B5FD', string: '#86EFAC', number: '#FCD34D', function: '#93C5FD', type: '#67E8F9', property: '#F9A8D4', comment: '#94A3B8' };

/**
 * One colour per token kind from the deck theme: keyword = primary, string = accent,
 * number = secondary, comment = a fixed slate; function, type and property take fixed hues
 * (blue, cyan, pink) rotated away from any theme colour they would collide with. Every
 * colour is lightened until it keeps `minimumContrast` (4.5:1) against the code panel, so a
 * dark theme colour is raised rather than dropped. Deterministic for a given theme.
 */
export function codeSyntaxPalette(theme: CodeSyntaxPaletteTheme = {}, options: CodeSyntaxPaletteOptions = {}): CodeSyntaxPalette {
  const background = normalize(options.background) ?? CODE_PANEL_BACKGROUND, plain = normalize(options.foreground) ?? CODE_PANEL_FOREGROUND;
  const minimum = options.minimumContrast ?? CODE_SYNTAX_MIN_CONTRAST;
  const palette = { plain: legible(plain, background, minimum) } as CodeSyntaxPalette;
  const taken = [palette.plain];
  const slots: [Exclude<CodeTokenKind, never>, unknown][] = [['keyword', theme.primary], ['string', theme.accent], ['number', theme.secondary], ['comment', theme.mutedText], ['function', undefined], ['type', undefined], ['property', undefined]];
  for (const [kind, themed] of slots) {
    // The theme colour first, then the fixed hue, then that hue rotated until it is far enough
    // from every colour already chosen: token kinds must stay distinguishable.
    const candidates = [normalize(themed), FALLBACK[kind]].filter((value): value is string => value !== undefined).map(value => legible(value, background, minimum));
    let [h, s, l] = toHsl(FALLBACK[kind]);
    let pick = candidates.find(candidate => taken.every(other => distance(candidate, other) >= 48));
    for (let turn = 0; pick === undefined && turn < 9; turn++) {
      h += 40;
      const candidate = legible(fromHsl(h, s, l), background, minimum);
      if (taken.every(other => distance(candidate, other) >= 48)) pick = candidate;
    }
    palette[kind] = pick ?? candidates[candidates.length - 1]!;
    taken.push(palette[kind]);
  }
  return palette;
}

/**
 * The palette for a resolved colour scheme record (`primary`, `secondary`, `accent`, or the
 * `accent1` to `accent3` slots they default to). The preview and the PPTX export both call this
 * with the scheme they resolved, so they cannot disagree on the inputs.
 */
export function codeSyntaxPaletteForScheme(scheme: unknown, options: CodeSyntaxPaletteOptions = {}): CodeSyntaxPalette {
  const record = (scheme && typeof scheme === 'object' ? scheme : {}) as Record<string, unknown>;
  const pick = (role: string, slot: string, fallback: string) => normalize(record[role]) ?? normalize(record[slot]) ?? fallback;
  return codeSyntaxPalette({ primary: pick('primary', 'accent1', '#2563EB'), secondary: pick('secondary', 'accent2', '#0F766E'), accent: pick('accent', 'accent3', '#F59E0B') }, options);
}
