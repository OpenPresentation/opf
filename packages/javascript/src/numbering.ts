/**
 * Numbered lists: the `numbering` field of `items` and `bullets` payloads.
 *
 * Pure helpers shared by composition (marker text and hanging indent), the validator, pagination and the
 * exporters, so the preview and the native PowerPoint export number every entry identically. Nothing here
 * measures text or reads a document beyond the items it is given.
 */

/** The five number styles OPF supports; each maps to a native PowerPoint auto-number scheme. */
export const NUMBERING_STYLES = ['arabic', 'roman-upper', 'roman-lower', 'alpha-upper', 'alpha-lower'] as const;
export type NumberingStyleName = typeof NUMBERING_STYLES[number];

/** `period` draws `1.`, `paren` draws `1)` and `paren-both` draws `(1)`. */
export const NUMBERING_SUFFIXES = ['period', 'paren', 'paren-both'] as const;
export type NumberingSuffix = typeof NUMBERING_SUFFIXES[number];

/** Object form of one level's numbering. Every field is optional. */
export interface Numbering {
  /** Default `arabic`. */
  style?: NumberingStyleName;
  /** First number of the level, an integer from 1 to 32767 (the native `startAt` range). Default 1. */
  start?: number;
  /** Default `period`. */
  suffix?: NumberingSuffix;
}

/**
 * The `numbering` field: one style name, one {@link Numbering} object (both apply to every level) or an array with
 * one entry per list level (index = level; the last entry repeats for deeper levels).
 */
export type NumberingInput = NumberingStyleName | Numbering | readonly (NumberingStyleName | Numbering)[];

/** One level's numbering with every default applied. */
export interface ResolvedNumbering {
  style: NumberingStyleName;
  start: number;
  suffix: NumberingSuffix;
}

/** Largest value a native auto-number can start at (`a:buAutoNum@startAt`, ST_TextStartAt). */
export const MAX_NUMBERING_VALUE = 32767;
/** Largest value drawn as a Roman numeral; larger values are drawn in arabic. */
export const MAX_ROMAN_VALUE = 3999;
/** Deepest list level a native paragraph can carry (`a:pPr@lvl` is 0 to 8). */
export const MAX_NUMBERING_LEVELS = 9;

const styleSet: ReadonlySet<string> = new Set(NUMBERING_STYLES);
const suffixSet: ReadonlySet<string> = new Set(NUMBERING_SUFFIXES);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function resolveEntry(entry: unknown, label: string): ResolvedNumbering {
  if (typeof entry === 'string') {
    if (!styleSet.has(entry)) throw new RangeError(`${label} must be one of ${NUMBERING_STYLES.join(', ')}.`);
    return { style: entry as NumberingStyleName, start: 1, suffix: 'period' };
  }
  if (!isObject(entry)) throw new TypeError(`${label} must be a style name or a numbering object.`);
  const { style = 'arabic', start = 1, suffix = 'period' } = entry;
  if (typeof style !== 'string' || !styleSet.has(style)) throw new RangeError(`${label}.style must be one of ${NUMBERING_STYLES.join(', ')}.`);
  if (typeof suffix !== 'string' || !suffixSet.has(suffix)) throw new RangeError(`${label}.suffix must be one of ${NUMBERING_SUFFIXES.join(', ')}.`);
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 1 || start > MAX_NUMBERING_VALUE) throw new RangeError(`${label}.start must be an integer from 1 to ${MAX_NUMBERING_VALUE}.`);
  return { style: style as NumberingStyleName, start, suffix: suffix as NumberingSuffix };
}

/**
 * Resolve a `numbering` value to one entry per authored level (a single entry when it applies to every level).
 * Use {@link numberingAtLevel} to read the entry for a level. Throws on a value the schema rejects.
 */
export function resolveNumbering(input: NumberingInput): ResolvedNumbering[] {
  if (Array.isArray(input)) {
    if (!input.length || input.length > MAX_NUMBERING_LEVELS) throw new RangeError(`numbering must list from 1 to ${MAX_NUMBERING_LEVELS} levels.`);
    return input.map((entry, index) => resolveEntry(entry, `numbering[${index}]`));
  }
  return [resolveEntry(input, 'numbering')];
}

/** The numbering of one list level: the entry at that index, else the last entry. */
export function numberingAtLevel(levels: readonly ResolvedNumbering[], level: number): ResolvedNumbering {
  return levels[Math.min(Math.max(0, level), levels.length - 1)]!;
}

const ROMAN: readonly (readonly [number, string])[] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];

/** The number without a suffix, in lower case when `style` is a lower-case style. `null` when the style cannot draw `value`. */
function bareNumber(value: number, style: NumberingStyleName): string | null {
  if (style === 'arabic') return String(value);
  if (style === 'roman-upper' || style === 'roman-lower') {
    if (value > MAX_ROMAN_VALUE) return null;
    let rest = value, out = '';
    for (const [amount, glyphs] of ROMAN) while (rest >= amount) { out += glyphs; rest -= amount; }
    return style === 'roman-upper' ? out.toUpperCase() : out;
  }
  // PowerPoint repeats the letter once the alphabet is used up: 26 is z, 27 is aa, 28 is bb, 53 is aaa.
  const letter = String.fromCharCode(97 + (value - 1) % 26).repeat(Math.floor((value - 1) / 26) + 1);
  return style === 'alpha-upper' ? letter.toUpperCase() : letter;
}

/** Whether `style` can draw `value` as that style (Roman numerals stop at 3999). */
export function numberingStyleDraws(style: NumberingStyleName, value: number): boolean {
  return bareNumber(value, style) !== null;
}

/**
 * Format a list number as the preview draws it and PowerPoint's matching `a:buAutoNum` scheme draws it:
 * `formatListNumber(4, 'roman-lower')` is `iv.`, `(3, 'alpha-upper', 'paren')` is `C)` and `(27, 'alpha-lower')` is `aa.`.
 * Roman values above 3999 fall back to arabic (see {@link listNumbers} for the reported adaptation).
 */
export function formatListNumber(value: number, style: NumberingStyleName = 'arabic', suffix: NumberingSuffix = 'period'): string {
  if (!Number.isInteger(value) || value < 1) throw new RangeError('A list number must be an integer of at least 1.');
  if (!styleSet.has(style)) throw new RangeError(`Unknown numbering style '${String(style)}'.`);
  if (!suffixSet.has(suffix)) throw new RangeError(`Unknown numbering suffix '${String(suffix)}'.`);
  const bare = bareNumber(value, style) ?? String(value);
  return suffix === 'period' ? `${bare}.` : suffix === 'paren' ? `${bare})` : `(${bare})`;
}

/** The number of one list entry. */
export interface ListNumber {
  /** Position of the entry in the list. */
  index: number;
  level: number;
  /** The counted number (1 or more). */
  value: number;
  /** The style actually drawn: `arabic` when the authored style cannot draw `value`. */
  style: NumberingStyleName;
  suffix: NumberingSuffix;
  /** The drawn marker, for example `iv.`. */
  text: string;
  /** Why the drawn style differs from the authored one: Roman numerals stop at 3999. */
  adapted?: 'roman-range';
}

/**
 * The numbers of a list, counted as PowerPoint counts them: consecutive entries of one level count up from that
 * level's `start`; an entry of a shallower level restarts every deeper level; deeper entries between two entries of
 * one level do not interrupt it. An object item's own `start` (an integer from 1 to 32767) restarts the count at that
 * entry. Items are read for their `level` and `start` only.
 */
export function listNumbers(items: readonly unknown[], numbering: NumberingInput): ListNumber[] {
  const levels = resolveNumbering(numbering);
  const counters: (number | undefined)[] = [];
  return items.map((item, index) => {
    const object = isObject(item) ? item : undefined;
    const level = object?.level === undefined ? 0 : object.level;
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 0) throw new RangeError('List levels must be nonnegative integers.');
    const own = object?.start;
    if (own !== undefined && (typeof own !== 'number' || !Number.isInteger(own) || own < 1 || own > MAX_NUMBERING_VALUE)) throw new RangeError(`A list item start must be an integer from 1 to ${MAX_NUMBERING_VALUE}.`);
    const { style: authored, start, suffix } = numberingAtLevel(levels, level);
    const previous = counters[level];
    const value = (own as number | undefined) ?? (previous === undefined ? start : previous + 1);
    counters[level] = value;
    counters.length = level + 1;
    const adapted = !numberingStyleDraws(authored, value);
    const style = adapted ? 'arabic' : authored;
    return { index, level, value, style, suffix, text: formatListNumber(value, style, suffix), ...(adapted ? { adapted: 'roman-range' as const } : {}) };
  });
}

/**
 * The slice `items[from, to)` of a numbered list as the items of a continuation, with `start` set on every entry whose
 * number would otherwise change, so a paginated list keeps the numbers of the whole list.
 */
export function sliceNumberedItems<T>(items: readonly T[], numbering: NumberingInput, from: number, to: number = items.length): T[] {
  const whole = listNumbers(items, numbering);
  const result: T[] = items.slice(from, to);
  for (let index = 0; index < result.length; index++) {
    const wanted = whole[from + index]!.value;
    // Entries after an override count on from it, so the running count is read again for each entry.
    if (listNumbers(result.slice(0, index + 1), numbering)[index]!.value === wanted) continue;
    // A text-only entry (string or runs) becomes the object form to carry the number.
    const item = result[index];
    const object = isObject(item) ? item : { text: item };
    result[index] = { ...object, start: wanted } as T;
  }
  return result;
}

/** One finding of {@link numberingFindings}: a JSON-pointer-relative key, a message and structured parameters. */
export interface NumberingFinding {
  /** `numbering` or `items`/`bullets`, relative to the payload. */
  key: 'numbering' | 'items' | 'bullets';
  message: string;
  params: Record<string, unknown>;
}

/**
 * Semantic checks of one content payload (a slide root, a region or a block) for the validator. Shape problems of the
 * field itself are the schema's; these are the rules it cannot state: `numbering` needs a list, and a count past the
 * native limit cannot be written as an auto-number. `warnings` lists entry `start` values that have nothing to restart.
 */
export function numberingFindings(payload: Record<string, unknown>): { errors: NumberingFinding[]; warnings: NumberingFinding[] } {
  const errors: NumberingFinding[] = [], warnings: NumberingFinding[] = [];
  const lists = (['items', 'bullets'] as const).filter(key => Array.isArray(payload[key]));
  if (Object.hasOwn(payload, 'numbering')) {
    if (!Object.hasOwn(payload, 'items') && !Object.hasOwn(payload, 'bullets')) {
      errors.push({ key: 'numbering', message: "numbering applies to 'items' or 'bullets'; this payload has neither", params: {} });
    } else {
      for (const key of lists) {
        let numbers: ListNumber[];
        try { numbers = listNumbers(payload[key] as unknown[], payload.numbering as NumberingInput); } catch { continue; }
        const largest = numbers.reduce((max, number) => Math.max(max, number.value), 0);
        if (largest > MAX_NUMBERING_VALUE) errors.push({ key, message: `numbering counts up to ${largest}, past the native limit of ${MAX_NUMBERING_VALUE}`, params: { largest, limit: MAX_NUMBERING_VALUE } });
      }
    }
  } else {
    for (const key of lists) {
      if ((payload[key] as unknown[]).some(item => isObject(item) && item.start !== undefined)) {
        warnings.push({ key, message: `'start' on ${key} entries has no effect without a 'numbering' field on the payload`, params: {} });
      }
    }
  }
  return { errors, warnings };
}
