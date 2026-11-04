/**
 * LH-11: where a line may not break. Core's line breaker (the measurement every engine reads) breaks prose at whitespace and, inside
 * a word too long for its line, between graphemes. Two rules limit both:
 * - a number stays with its unit: "26 %", "$4.8 M", "12 km", "3 x", "5 pm" are one unbreakable piece, and so are the digits, the
 *   decimal separator and the sign or currency symbol of a figure ("4.8", "$4");
 * - a line never starts with a closing mark (`. , ; : ! ? ) ] } %`, a closing quotation mark, their CJK and Arabic forms) and never
 *   ends with an opening one;
 * - LH-150: a ratio, a figure, a slash and a figure ("4.6 / 5", "3/4", "$2 / $3"), is one piece: it never breaks at or beside its slash.
 * The rules read characters only (no language tag), so they hold for right-to-left and CJK text. A unit outside the lexicon is bound
 * by the author with a no-break space, which the breaker already keeps whole. `bindNoBreak` writes the same rule as U+00A0 for a
 * PowerPoint that wraps the text itself.
 */

/** The whitespace a break may replace between a number and its unit: one space or one thin space. */
const GLUE_SPACE = /^[ \u2009]$/;
/** The start of whitespace or a line break (a no-break space and the zero-width no-break space start a word, not a gap). */
const BREAKING_SPACE = /^[^\S\u00a0\u202f\ufeff]/u;
const SYMBOL_UNITS = '%\u2030\u066a\u00b0\u2032\u2033\u2103\u2109\u00d7\u2116';
/** Units written after a number with a space (case matters: "M" is millions, "m" metres). Symbols and magnitude words are not language-bound. */
const UNITS = new Set([
  'x', 'X', 'k', 'K', 'M', 'B', 'bn', 'Bn', 'mn', 'mm', 'cm', 'dm', 'm', 'km', 'kg', 'g', 'mg', 't', 'lb', 'lbs', 'oz', 'ml', 'cl', 'dl', 'l', 'L', 'kl',
  's', 'ms', 'ns', 'sec', 'secs', 'min', 'mins', 'h', 'hr', 'hrs', 'd', 'yr', 'yrs', 'wk', 'wks', 'am', 'pm', 'a.m.', 'p.m.',
  'Hz', 'kHz', 'MHz', 'GHz', 'W', 'kW', 'MW', 'GW', 'Wh', 'kWh', 'MWh', 'GWh', 'V', 'kV', 'mV', 'mA', 'bit', 'bits', 'bps', 'kbps', 'Mbps', 'Gbps',
  'KB', 'MB', 'GB', 'TB', 'PB', 'kb', 'Mb', 'Gb', 'Tb', 'px', 'pt', 'pts', 'pp', 'bp', 'ft', 'yd', 'mi', 'mph', 'kph', 'km/h', 'm/s',
  'm\u00b2', 'm\u00b3', 'km\u00b2', 'cm\u00b2', 'mm\u00b2', 'cm\u00b3', 'mm\u00b3',
  'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN', 'BRL', 'MXN',
  'million', 'millions', 'billion', 'billions', 'trillion', 'thousand', 'percent', 'pct', 'Mio', 'Mio.', 'Mrd', 'Mrd.', 'Tsd', 'Tsd.', 'Mill.', 'Mld', 'Mld.',
  // Arabic and Hebrew: million, billion, kilometre, kilogram.
  '\u0645\u0644\u064a\u0648\u0646', '\u0645\u0644\u064a\u0627\u0631', '\u0643\u0645', '\u0643\u062c\u0645', '\u05de\u05d9\u05dc\u05d9\u05d5\u05df', '\u05de\u05d9\u05dc\u05d9\u05e8\u05d3', '\u05e7\u05f4\u05de',
]);
const CLOSING_MARKS = '.,;:!?)]}\u00bb\u203a\u201d\u2019\u2026%\u2030\u066a\u060c\u061b\u061f\u3002\u3001\uff0c\uff0e\uff1a\uff1b\uff01\uff1f\uff09\uff3d\uff5d\u300d\u300f\u3011\u3009\u300b\u3015\u30fb\u30fc';
const OPENING_MARKS = '([{\u00ab\u2039\u201c\u2018\u00bf\u00a1\u300c\u300e\uff08\uff3b\uff5b\u3010\u3008\u300a\u3014';
const TRAILING = /[)\]}.,;:!?\u00bb\u201d\u2019\u2026\u060c\u061b\u061f]+$/u;
/** Characters a CJK number is followed by without a space: 2024年, 3万, 500円, 12個, 3개. */
const CJK_UNITS = '\u4e07\u4ebf\u5104\u5146\u5186\u5143\u5e74\u6708\u65e5\u6642\u65f6\u5206\u79d2\u500b\u4e2a\u4eba\u540d\u4ef6\u53f0\u56de\u500d\u5272\uc6d0\ub9cc\uc5b5\uac1c\uba85\ub144\uc6d4\uc77c\uc2dc';

const isDigit = (character: string | undefined): boolean => character !== undefined && /^\p{Nd}$/u.test(character);

/** Whether the word ends a figure ("26", "4.8", "$4.8", "(26"): its last character is a digit. */
const endsNumber = (word: string): boolean => isDigit(Array.from(word).at(-1));
/** Whether the word is a unit a figure keeps close to: "%", "M", "km)", "°C". */
function isUnitWord(word: string): boolean {
  const bare = word.replace(TRAILING, '');
  if (bare === '') return false;
  if (UNITS.has(bare) || UNITS.has(word)) return true;
  return SYMBOL_UNITS.includes(bare[0]!) && bare.length <= 3;
}
/** Whether the word is nothing but closing marks (".", ")", "%)", a closing quotation mark). */
const onlyClosing = (word: string): boolean => [...word].every(character => CLOSING_MARKS.includes(character) || character === '"' || character === "'");
/** Whether a space between `previous` and `next` is one a line may not break at. */
function glues(previous: string, next: string): boolean {
  // A closing mark after a space (French "mot :", "mot ?") stays with the word before it.
  return onlyClosing(next) || endsNumber(previous) && isUnitWord(next);
}
/** LH-150: the slashes of a ratio: the solidus, the division slash and the fraction slash. */
const RATIO_SLASHES = new Set(['/', '∕', '⁄']);
/** Whether the word starts a figure ("5", "$3", "-2"): a digit, after at most a sign or currency symbol. */
const startsNumber = (word: string | undefined): boolean => word !== undefined && /^[\p{Sc}+\-−]?\p{Nd}/u.test(word);
/** LH-150: whether `first`, a lone slash and `last` (words with one space between each) read as a ratio, "4.6 / 5". */
const ratio = (first: string | undefined, slash: string | undefined, last: string | undefined): boolean => first !== undefined && endsNumber(first) && slash !== undefined && RATIO_SLASHES.has(slash) && startsNumber(last);

/** A token of the prose line breaker: its source offset and text, the shape of a `matchAll` result (`index`, `[0]`). */
export interface ProseToken { index: number; 0: string }
const PROSE_TOKENS = /\r\n|\r|\n|[^\S\r\n\u00a0\u202f\ufeff]+|(?:[^\s]|\u00a0|\u202f|\ufeff)+/gu;

/**
 * The tokens of prose in source order: line breaks, whitespace runs and words, where a word bound to the next one by the rules above
 * ("26 %") is one token with its space inside. Concatenated, the tokens are the text.
 */
export function proseTokens(text: string): ProseToken[] {
  const tokens: ProseToken[] = [];
  const raw = [...text.matchAll(PROSE_TOKENS)];
  for (let index = 0; index < raw.length; index++) {
    const token = raw[index]!, start = token.index!;
    let end = start + token[0].length, last = token[0];
    // Word, one plain space, word: merge while the pair is bound ("4 x 5" binds both pairs).
    while (!BREAKING_SPACE.test(token[0]) && index + 2 < raw.length) {
      const space = raw[index + 1]!, word = raw[index + 2]!;
      if (!GLUE_SPACE.test(space[0]) || BREAKING_SPACE.test(word[0]) || space.index !== end || word.index !== end + 1) break;
      // LH-150: figure, slash, figure ("4.6 / 5") binds both spaces at once.
      const after = raw[index + 3], figure = raw[index + 4];
      if (!glues(last, word[0]) && after && figure && GLUE_SPACE.test(after[0]) && after.index === word.index + word[0].length && figure.index === after.index + 1 && ratio(last, word[0], figure[0])) {
        end = figure.index + figure[0].length;
        last = figure[0];
        index += 4;
        continue;
      }
      if (!glues(last, word[0])) break;
      end = word.index + word[0].length;
      last = word[0];
      index += 2;
    }
    tokens.push({ index: start, 0: text.slice(start, end) });
  }
  return tokens;
}

/** The words of a stretch of prose (a bound pair is one word) with their offsets; whitespace and line breaks separate words. */
export function proseWords(text: string): { start: number; end: number; text: string }[] {
  return proseTokens(text).filter(token => !BREAKING_SPACE.test(token[0]))
    .map(token => ({ start: token.index, end: token.index + token[0].length, text: token[0] }));
}

const codePointBefore = (text: string, index: number): string | undefined => {
  if (index <= 0) return undefined;
  const low = text.charCodeAt(index - 1);
  return low >= 0xdc00 && low <= 0xdfff && index >= 2 ? text.slice(index - 2, index) : text[index - 1];
};
const codePointAt = (text: string, index: number): string | undefined => {
  const point = text.codePointAt(index);
  return point === undefined ? undefined : String.fromCodePoint(point);
};
const LETTERS = /^[\p{L}\p{M}\u00b2\u00b3/.]+/u;

/**
 * Whether a line may start at `index` of `text` when it is a break inside a word (the breaker cuts an over-long word between
 * graphemes). False for a break that parts a figure ("2|6", "4.|8", "$|4"), a figure from its unit ("26|%", "3|万", "12|km"),
 * goes before a closing mark or after an opening one, or leaves a space at the start of the line. The caller moves such a break to
 * the nearest earlier one that is allowed, and keeps it when there is none (an over-long word still wraps).
 */
export function lineMayStartAt(text: string, index: number): boolean {
  const before = codePointBefore(text, index), at = codePointAt(text, index);
  if (before === undefined || at === undefined) return true;
  if (/^\s$/u.test(at)) return false;
  if (CLOSING_MARKS.includes(at) || at === '"' || at === "'") return false;
  if (OPENING_MARKS.includes(before)) return false;
  const beforeThat = codePointBefore(text, index - before.length);
  if (isDigit(at) && (isDigit(before) || /^\p{Sc}$/u.test(before) || ((before === '.' || before === ',') && isDigit(beforeThat)))) return false;
  if (isDigit(before) && (SYMBOL_UNITS.includes(at) || CJK_UNITS.includes(at))) return false;
  // LH-150: a ratio written without spaces ("3/4", "4.6/5") stays whole at its slash.
  if ((RATIO_SLASHES.has(at) && isDigit(before)) || (RATIO_SLASHES.has(before) && isDigit(at) && isDigit(beforeThat))) return false;
  if (isDigit(before) && /^\p{L}$/u.test(at)) {
    const unit = LETTERS.exec(text.slice(index, index + 16))?.[0].replace(TRAILING, '');
    if (unit && UNITS.has(unit)) return false;
  }
  return true;
}

/**
 * The text with each space a line may not break at replaced by U+00A0, for a PowerPoint that wraps the text itself ("26 %" becomes
 * "26" + U+00A0 + "%"). Core's own breaker reads the result the same way (a no-break space is never a break opportunity), so the lines agree.
 */
export function bindNoBreak(text: string): string {
  if (!/[ \u2009]/u.test(text)) return text;
  let result = '', copied = 0, changed = false;
  for (const token of proseTokens(text)) {
    if (!/[ \u2009]/u.test(token[0]) || BREAKING_SPACE.test(token[0])) continue;
    result += text.slice(copied, token.index) + token[0].replace(/[ \u2009]/gu, '\u00a0');
    copied = token.index + token[0].length;
    changed = true;
  }
  return changed ? result + text.slice(copied) : text;
}

/** The text with each U+00A0 that `bindNoBreak` would have written back as the space it replaced; an author's other no-break spaces stay. */
export function unbindNoBreak(text: string): string {
  if (!text.includes('\u00a0')) return text;
  const pieces = text.split('\u00a0');
  let result = pieces[0]!;
  const lastWord = (text: string): string => text.slice(text.search(/[^\s\u00a0]*$/u));
  for (let index = 1; index < pieces.length; index++) {
    const previous = lastWord(result), [next, following] = pieces.slice(index).join('\u00a0').split(/[\s\u00a0]+/u);
    const before = lastWord(result.slice(0, result.length - previous.length).replace(/[\s\u00a0]+$/u, ''));
    // Only the pair the rule binds: a figure and its unit, or a word and a closing mark, and the two spaces of a ratio (LH-150); the
    // author's other no-break spaces stay.
    const bound = !!previous && !!next && (glues(previous, next) || ratio(previous, next, following) || ratio(before, previous, next));
    result += (bound ? ' ' : '\u00a0') + pieces[index]!;
  }
  return result;
}

/**
 * The offset a line starts at when an over-long word must break at `cuts[k]` (the grapheme boundaries of the word, ascending): that
 * boundary if the rules allow it, else the nearest earlier allowed one after `floor` (the line's start), else `cuts[k]` itself.
 */
export function allowedBreak(text: string, cuts: readonly number[], k: number, floor: number): number {
  for (let index = k; index >= 0; index--) {
    const at = cuts[index]!;
    if (at <= floor) break;
    if (lineMayStartAt(text, at)) return at;
  }
  return cuts[k]!;
}
