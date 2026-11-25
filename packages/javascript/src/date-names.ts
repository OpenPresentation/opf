// FR-10: the month and weekday names, and the long date pattern, of the language a date is drawn in. The data is one table
// (date-name-data.ts, read from `Intl` once by scripts/build-date-names.mjs), never the runtime's `Intl`, so every runtime draws the
// same text. A language without data (or none at all) draws English names, as every date did before.

import {DATE_NAMES, DATE_PATTERNS} from './date-name-data.js';
import {plainLanguageTag} from './numerals.js';

/** The names a date's `MMMM`, `MMM`, `EEEE` and `EEE` tokens print in one language, index 0 being January and Sunday. */
export interface DateNames {
  /** Long month names, in the form that follows a day number ("5 марта"). */
  months: readonly string[];
  /** Short month names, in the form that follows a day number. */
  monthsShort: readonly string[];
  /** Long month names on their own ("март 2026"); the same as `months` in a language that does not inflect them. */
  monthsStandalone: readonly string[];
  /** Short month names on their own. */
  monthsShortStandalone: readonly string[];
  weekdays: readonly string[];
  weekdaysShort: readonly string[];
}

const ENGLISH_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const ENGLISH_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const ENGLISH_SHORT_MONTHS = ENGLISH_MONTHS.map((name) => name.slice(0, 3));

/** English: the names every date drew before the language mattered, and those of a deck that declares none. */
export const ENGLISH_DATE_NAMES: DateNames = {
  months: ENGLISH_MONTHS,
  monthsShort: ENGLISH_SHORT_MONTHS,
  monthsStandalone: ENGLISH_MONTHS,
  monthsShortStandalone: ENGLISH_SHORT_MONTHS,
  weekdays: ENGLISH_WEEKDAYS,
  weekdaysShort: ENGLISH_WEEKDAYS.map((name) => name.slice(0, 3)),
};

/** The table key for each lower-cased tag, built once. */
let keys: ReadonlyMap<string, string> | undefined;
const keyOf = (table: Readonly<Record<string, string>>, candidate: string): string | undefined => {
  keys ??= new Map([...Object.keys(DATE_NAMES), ...Object.keys(DATE_PATTERNS)].map((key) => [key.toLowerCase(), key]));
  const key = keys.get(candidate);
  return key !== undefined && Object.hasOwn(table, key) ? key : undefined;
};

/** The tags a language selects, most specific first (`zh-Hant-TW`, `zh-Hant`, `zh`); an extension (`-u-nu-latn`) is not part of the language. */
const candidates = (language: string): string[] => {
  const subtags = plainLanguageTag(language.trim()).replaceAll('_', '-').toLowerCase().split('-');
  const out: string[] = [];
  for (let length = subtags.length; length > 0; length--) out.push(subtags.slice(0, length).join('-'));
  return out;
};

const lookup = (table: Readonly<Record<string, string>>, language: string | undefined): string | undefined => {
  if (!language) return undefined;
  for (const candidate of candidates(language)) {
    const key = keyOf(table, candidate);
    if (key !== undefined) return table[key];
  }
  return undefined;
};

const cache = new Map<string, DateNames>();

/** The names of the language (the tag, then the tag without its last subtag, and so on); English with none given or no data for it. */
export function dateNamesOf(language?: string): DateNames {
  const row = lookup(DATE_NAMES, language);
  if (row === undefined) return ENGLISH_DATE_NAMES;
  let names = cache.get(row);
  if (!names) {
    const [months = [], monthsShort = [], standalone = [], shortStandalone = [], weekdays = [], weekdaysShort = []] = row.split('~').map((list) => (list === '' ? [] : list.split('|')));
    names = {months, monthsShort, monthsStandalone: standalone.length ? standalone : months, monthsShortStandalone: shortStandalone.length ? shortStandalone : monthsShort, weekdays, weekdaysShort};
    if (cache.size >= 256) cache.clear();
    cache.set(row, names);
  }
  return names;
}

/**
 * The language's long date pattern in OPF's date tokens (`d. MMMM yyyy` in German, `d MMMM yyyy` in French and British English,
 * `yyyy年M月d日` in Japanese), the pattern a date variable with no `format` is drawn with. Undefined with no language or no data for it.
 */
export function longDatePattern(language?: string): string | undefined {
  return lookup(DATE_PATTERNS, language);
}
