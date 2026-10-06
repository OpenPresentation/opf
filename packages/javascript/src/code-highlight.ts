/**
 * Line emphasis for code blocks (`code.highlight`), shared by the SVG preview, the PPTX export and the
 * validator so they cannot disagree.
 *
 * `code.highlight` lists 1-based source lines: a line number or an inclusive `[start, end]` range.
 * Lines are counted by line break in `code.source`, so a soft-wrapped line is still one line and every
 * displayed line of it takes the same number (`codeLineNumbers`). Engines draw one band behind each
 * run of marked displayed lines (`codeHighlightBands`) and set the unmarked lines in a slightly dimmed
 * colour (`codeHighlightColors`); both colour sets keep WCAG contrast >= 4.5:1 against what they sit on.
 * Everything here is deterministic: no clock, locale or network.
 */

import { contrast, fromHsl, legible, normalize, toHex, toHsl, channels } from './legible-color.js';
import { CODE_PANEL_BACKGROUND, CODE_SYNTAX_MIN_CONTRAST, codeSyntaxPaletteForScheme, type CodeSyntaxPalette } from './code-syntax.js';

/** One `code.highlight` entry: a line number or an inclusive `[start, end]` range. */
export type CodeHighlightEntry = number | [number, number];

export interface CodeHighlightIssue {
  code: 'code-highlight-out-of-range' | 'code-highlight-range-reversed' | 'code-highlight-invalid';
  /** Index of the entry in `code.highlight`. */
  index: number;
  message: string;
}

export interface CodeHighlightLines {
  /** Lines in the source (a final empty line after a trailing line break is not counted). */
  lineCount: number;
  /** The marked lines inside the source, ascending and unique. Empty when nothing is marked. */
  lines: number[];
  /** Entries that are ignored: past the last line, written end before start, or not line numbers. */
  issues: CodeHighlightIssue[];
}

/** Number of lines in a code source, by line break (CR, LF and CRLF); a trailing line break does not start a line. */
export function codeLineCount(source: string): number {
  let count = 1;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '\r' && source[index + 1] === '\n') index++;
    if (char === '\r' || char === '\n') count++;
  }
  return count > 1 && /(?:\r\n|\r|\n)$/.test(source) ? count - 1 : count;
}

const isLine = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1;

/** Resolve `code.highlight` against its source: the marked lines, and the entries that are ignored. */
export function codeHighlightLines(highlight: unknown, source: string): CodeHighlightLines {
  const lineCount = codeLineCount(source), marked = new Set<number>(), issues: CodeHighlightIssue[] = [];
  if (!Array.isArray(highlight)) return { lineCount, lines: [], issues };
  highlight.forEach((entry: unknown, index) => {
    const range = Array.isArray(entry) ? entry : [entry, entry];
    if (range.length !== 2 || !isLine(range[0]) || !isLine(range[1])) {
      issues.push({ code: 'code-highlight-invalid', index, message: 'A code highlight entry is a line number or a [start, end] pair of line numbers from 1.' });
      return;
    }
    const [start, end] = range as [number, number];
    if (start > end) {
      issues.push({ code: 'code-highlight-range-reversed', index, message: `The highlight range [${start}, ${end}] ends before it starts, so it marks no line; write [${end}, ${start}].` });
      return;
    }
    if (end > lineCount) issues.push({ code: 'code-highlight-out-of-range', index, message: `The highlight ${start === end ? `line ${start}` : `range [${start}, ${end}]`} is past the last line (the code has ${lineCount} ${lineCount === 1 ? 'line' : 'lines'}); lines beyond it are ignored.` });
    for (let line = start; line <= Math.min(end, lineCount); line++) marked.add(line);
  });
  return { lineCount, lines: [...marked].sort((a, b) => a - b), issues };
}

/** Marked lines as the shortest `code.highlight` list: single numbers and inclusive ranges. */
export function codeHighlightList(lines: readonly number[]): CodeHighlightEntry[] {
  const sorted = [...new Set(lines)].sort((a, b) => a - b), out: CodeHighlightEntry[] = [];
  for (let index = 0; index < sorted.length;) {
    let end = index;
    while (sorted[end + 1] === sorted[end]! + 1) end++;
    out.push(end === index ? sorted[index]! : [sorted[index]!, sorted[end]!]);
    index = end + 1;
  }
  return out;
}

/** The source line number (from 1) of every displayed line; wrapped lines repeat their line's number. */
export function codeLineNumbers(sourceLines: readonly { boundary: 'soft' | 'hard' | 'end' }[]): number[] {
  let line = 1;
  return sourceLines.map(entry => {
    const number = line;
    if (entry.boundary === 'hard') line++;
    return number;
  });
}

/** A run of consecutive displayed lines (indexes into `sourceLines`, inclusive) whose source lines are marked. */
export interface CodeHighlightBand { first: number; last: number }

/** One band per run of consecutive displayed lines that belong to a marked line. */
export function codeHighlightBands(sourceLines: readonly { boundary: 'soft' | 'hard' | 'end' }[], lines: readonly number[]): CodeHighlightBand[] {
  if (!lines.length) return [];
  const marked = new Set(lines), numbers = codeLineNumbers(sourceLines), bands: CodeHighlightBand[] = [];
  numbers.forEach((number, index) => {
    if (!marked.has(number)) return;
    const last = bands.at(-1);
    if (last && last.last === index - 1) last.last = index;
    else bands.push({ first: index, last: index });
  });
  return bands;
}

/** `code.highlight` for the page that holds `source.slice(start, end)` of a paginated block: kept lines renumbered from 1. */
export function codeHighlightSlice(highlight: unknown, source: string, start: number, end: number): CodeHighlightEntry[] | undefined {
  const { lines } = codeHighlightLines(highlight, source);
  if (!lines.length) return undefined;
  const breaks = (text: string) => (text.match(/\r\n|\r|\n/g) ?? []).length;
  const before = breaks(source.slice(0, start)), count = codeLineCount(source.slice(start, end));
  const kept = lines.filter(line => line > before && line <= before + count).map(line => line - before);
  return kept.length ? codeHighlightList(kept) : undefined;
}

/** How far unmarked lines move toward the panel colour, and how much of the theme colour tints the band. */
export const CODE_HIGHLIGHT_DIM = 0.35;
export const CODE_HIGHLIGHT_BAND_TINT = 0.3;

export interface CodeHighlightColors {
  /** The band behind marked lines: the panel colour tinted with the theme's primary colour. */
  band: string;
  /** Marked lines: the syntax palette, each colour at least 4.5:1 on `band`. */
  lit: CodeSyntaxPalette;
  /** Unmarked lines: the syntax palette moved toward the panel, never below 4.5:1 on it. */
  dim: CodeSyntaxPalette;
}

const blend = (from: string, to: string, amount: number): string => {
  const a = channels(from), b = channels(to);
  return toHex(a.map((value, index) => value + (b[index]! - value) * amount));
};

/**
 * The highlight colours for a resolved colour scheme record. The band takes the scheme's `primary`
 * (or `accent1`); the palette is `codeSyntaxPaletteForScheme(scheme)` so highlighted lines keep their syntax
 * colours. Preview and export call this with the scheme they resolved.
 */
export function codeHighlightColors(scheme: unknown, palette: CodeSyntaxPalette = codeSyntaxPaletteForScheme(scheme)): CodeHighlightColors {
  const record = (scheme && typeof scheme === 'object' ? scheme : {}) as Record<string, unknown>;
  const primary = normalize(record.primary) ?? normalize(record.accent1) ?? '#2563EB';
  // Tint with the theme colour's hue at a bounded lightness so the band stays a dark surface.
  const [hue, saturation] = toHsl(primary);
  const tint = fromHsl(hue, Math.min(saturation, 0.7), 0.45);
  const band = blend(CODE_PANEL_BACKGROUND, tint, CODE_HIGHLIGHT_BAND_TINT);
  const lit = {} as CodeSyntaxPalette, dim = {} as CodeSyntaxPalette;
  for (const key of Object.keys(palette) as (keyof CodeSyntaxPalette)[]) {
    lit[key] = legible(palette[key], band, CODE_SYNTAX_MIN_CONTRAST);
    dim[key] = legible(blend(palette[key], CODE_PANEL_BACKGROUND, CODE_HIGHLIGHT_DIM), CODE_PANEL_BACKGROUND, CODE_SYNTAX_MIN_CONTRAST);
  }
  return { band, lit, dim };
}

/** Lowest contrast of the colours against a background; used by tests and audits. */
export const codeHighlightContrast = (colors: CodeSyntaxPalette, background: string): number => Math.min(...Object.values(colors).map(color => contrast(color, background)));
