// LH-105: whether a chart's categories are ordered in time.
//
// Few: emphasis must carry meaning. The small chart's automatic last-point emphasis (LH-03, LH-95) says "the latest value", which is only
// true when the categories run forward in time; on nominal categories (pipeline stages, regions, products) the last bar is just the last
// one written, and emphasising it would invent a message. `chartCategoriesInTime` decides it from the category labels, and from the
// category title (the category axis title, else the category column's name) when the labels alone do not say:
//
//   years              2024, FY24, FY 2025, CY2026, '24 (a four-digit year from 1800 to 2200, or a two-digit one after FY, CY or ')
//   periods            Q1 to Q4, H1 and H2, M1 to M12, and outside English T1 to T4 (trimestre) and S1 and S2 (semestre), with an
//                      optional year before or after (Q1 2024, 2024 Q1, Q1'24, FY24 Q3, 1Q24, 3Q); P1, P2 (priorities) and an English
//                      T1 (a tier) are not periods
//   weeks and steps    W12, Wk 3, Week 3, Day 4, Sprint 5, Month 2, Iteration 3, Period 7, and the deck language's words for year,
//                      quarter, month, week and day (Intl.DisplayNames, dateTimeField) before or after a number
//   months             January, Jan, Sept, with an optional year (Jan 2024, 2024 Jan, Jan-24, January '24), in English and in the deck
//                      language (Intl.DateTimeFormat month names, long and short), so "يناير" or "März" is a month
//   dates              2024-03, 2024-03-15, 2024/3/15, 15.03.2024, 3/15/2024
//   numbers            a strictly increasing sequence (1, 2, 3; 2019 to 2024; 30, 60, 90)
//
// Every label must belong to one family, and the labels must run forward (labels of one family that do not are not in time order, whatever
// the title says): years and numbers strictly increasing, dates and dated
// periods never decreasing, and periods, months and weeks without a year may wrap once (Nov, Dec, Jan; Q3, Q4, Q1). A reversed run
// (2026, 2025, 2024) is not in time order for this rule: its last point is the oldest. Digits of any script count (٢٠٢٤ is 2024).
// Failing that, a category title that names a time field (Year, Quarter, Month, Week, Day, Date, Period, Time, Fiscal year, or the deck
// language's word for one of them) makes distinct labels time ordered (Period: Baseline, Pilot, Rollout).

type Family = 'year' | 'period' | 'week' | 'month' | 'date' | 'number';
interface Parsed { family: Family; key: number; dated: boolean }

/** ASCII digits for the decimal digits of any script (U+0660 to U+0669, U+06F0, U+0966, fullwidth ...): digit blocks are runs of ten. */
function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, char => {
    const code = char.codePointAt(0)!;
    let zero = code;
    while (code - zero < 9 && /\p{Nd}/u.test(String.fromCodePoint(zero - 1))) zero--;
    return String((code - zero) % 10);
  });
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cache = new Map<string, {months: Map<string, number>; monthPattern: string; fieldPattern: string; fields: Set<string>}>();

const ENGLISH_STEPS = ['week', 'wk', 'w', 'day', 'sprint', 'month', 'iteration', 'period', 'quarter', 'year'];
const ENGLISH_FIELDS = ['year', 'years', 'quarter', 'quarters', 'month', 'months', 'week', 'weeks', 'day', 'days', 'date', 'dates', 'period', 'periods', 'time', 'fiscal year', 'fiscal quarter', 'fy', 'month end', 'week ending', 'week of'];

/** The month names (long and short, lower case, without a trailing period) and time-field words of English and `language`. */
function vocabulary(language: string | undefined) {
  const tag = typeof language === 'string' && language.trim() ? language.trim() : 'en';
  const known = cache.get(tag);
  if (known) return known;
  const months = new Map<string, number>([['sept', 9]]);
  const fields = new Set<string>(ENGLISH_FIELDS);
  const steps = new Set<string>(ENGLISH_STEPS);
  for (const locale of tag === 'en' ? ['en'] : ['en', tag]) {
    try {
      for (const style of ['long', 'short'] as const) {
        const format = new Intl.DateTimeFormat(locale, {month: style, timeZone: 'UTC'});
        for (let month = 0; month < 12; month++) {
          const name = asciiDigits(format.format(new Date(Date.UTC(2001, month, 15)))).toLocaleLowerCase(locale).replace(/\.$/, '').trim();
          if (name && !/^\d+$/.test(name) && !months.has(name)) months.set(name, month + 1);
        }
      }
      const names = new Intl.DisplayNames(locale, {type: 'dateTimeField'});
      for (const field of ['year', 'quarter', 'month', 'weekOfYear', 'day'] as const) {
        const word = names.of(field)?.toLocaleLowerCase(locale).trim();
        if (word) { fields.add(word); steps.add(word); }
      }
    } catch {
      // A runtime without the locale data keeps the English vocabulary.
    }
  }
  const alternation = (words: Iterable<string>) => [...words].sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
  const entry = {months, monthPattern: alternation(months.keys()), fieldPattern: alternation(steps), fields};
  cache.set(tag, entry);
  return entry;
}

const fullYear = (text: string, prefixed: boolean): number | undefined => {
  const value = Number(text);
  if (text.length === 4) return value >= 1800 && value <= 2200 ? value : undefined;
  return text.length === 2 && prefixed ? 2000 + value : undefined;
};

const PERIODS: Readonly<Record<string, number>> = {q: 4, h: 2, t: 4, s: 2, m: 12};

/** One category label as a point in time, or undefined. */
function parse(raw: unknown, vocab: ReturnType<typeof vocabulary>, language: string | undefined): Parsed | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? (Number.isInteger(raw) && fullYear(String(raw), false) !== undefined ? {family: 'year', key: raw, dated: true} : {family: 'number', key: raw, dated: false}) : undefined;
  const text = asciiDigits(String(raw).normalize('NFKC')).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  const lower = text.toLocaleLowerCase(language || 'en');
  let match: RegExpExecArray | null;
  // Years: 2024, FY24, FY 2025, CY2026, '24, FY24/25.
  match = /^(fy|cy|ay)?\s?(')?(\d{2}|\d{4})(?:\s?[-/–]\s?(\d{2}|\d{4}))?$/.exec(lower);
  if (match) {
    const year = fullYear(match[3]!, Boolean(match[1] || match[2]));
    // A span names the next year (FY24/25, 2024-2025); anything else after a dash is a month (2024-01).
    const next = match[4] === undefined || Number(match[4]) % 100 === ((year ?? 0) + 1) % 100;
    if (year !== undefined && next) return {family: 'year', key: year, dated: true};
  }
  // Periods: Q1, Q1 2024, Q1'24, Q1-24, FY24 Q3, 2024 Q1, 2024-Q1, 1Q24, 3Q, H2, T3, P11.
  const period = (letter: string, index: string, year?: number): Parsed | undefined => {
    // T and S (trimestre, semestre) are periods outside English only: an English T1 is a tier and S1 a size.
    if ((letter === 't' || letter === 's') && /^en(?:-|$)/i.test(language || 'en')) return undefined;
    const count = PERIODS[letter], value = Number(index);
    return count !== undefined && value >= 1 && value <= count ? {family: 'period', key: (year ?? 0) * 100 + value, dated: year !== undefined} : undefined;
  };
  match = /^(?:(?:fy|cy)\s?'?(\d{2}|\d{4})\s?[-\s]?\s?)?([qhtsm])\s?(\d{1,2})(?:\s?[-\s/']\s?(?:(?:fy|cy)\s?)?'?(\d{2}|\d{4}))?$/.exec(lower);
  if (match) {
    const year = match[1] ? fullYear(match[1], true) : match[4] ? fullYear(match[4], true) : undefined;
    const parsed = period(match[2]!, match[3]!, year);
    if (parsed && (!(match[1] || match[4]) || year !== undefined)) return parsed;
  }
  match = /^(\d{4})\s?[-\s]?\s?([qhts])\s?(\d)$/.exec(lower);
  if (match) { const parsed = period(match[2]!, match[3]!, fullYear(match[1]!, false)); if (parsed?.dated) return parsed; }
  match = /^(\d)\s?([qh])\s?(?:'?(\d{2}|\d{4}))?$/.exec(lower);
  if (match) { const year = match[3] ? fullYear(match[3], true) : undefined; const parsed = period(match[2]!, match[1]!, year); if (parsed) return parsed; }
  // Weeks and steps: W12, Wk 3, Week 3, Day 4, Sprint 5, 3. Woche, the deck language's field word before or after a number.
  match = new RegExp(`^(?:(?:${vocab.fieldPattern})\\.?\\s?(\\d{1,3})(?:,?\\s(\\d{4}))?|(\\d{1,3})\\.?\\s?(?:${vocab.fieldPattern}))$`, 'u').exec(lower);
  if (match) {
    const value = Number(match[1] ?? match[3]), year = match[2] ? fullYear(match[2], false) : undefined;
    return {family: 'week', key: (year ?? 0) * 1000 + value, dated: year !== undefined};
  }
  // Months: January, Jan, Jan 2024, 2024 Jan, Jan-24, January '24.
  const months = vocab.monthPattern;
  if (months) {
    const bare = lower.replace(/\.(?=\s|$|-)/g, '');
    match = new RegExp(`^(${months})(?:\\s?[-\\s/']\\s?'?(\\d{2}|\\d{4}))?$`, 'u').exec(bare);
    if (match) {
      const year = match[2] ? fullYear(match[2], true) : undefined;
      if (!match[2] || year !== undefined) return {family: 'month', key: (year ?? 0) * 100 + vocab.months.get(match[1]!)!, dated: year !== undefined};
    }
    match = new RegExp(`^(\\d{4})\\s?[-\\s/]?\\s?(${months})$`, 'u').exec(bare);
    if (match) {
      const year = fullYear(match[1]!, false);
      if (year !== undefined) return {family: 'month', key: year * 100 + vocab.months.get(match[2]!)!, dated: true};
    }
  }
  // Dates: 2024-03, 2024-03-15, 2024/3/15, 15.03.2024, 3/15/2024.
  match = /^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/.exec(lower);
  if (match) {
    const year = fullYear(match[1]!, false), month = Number(match[2]), day = match[3] ? Number(match[3]) : 0;
    if (year !== undefined && month >= 1 && month <= 12 && day <= 31) return {family: 'date', key: year * 10000 + month * 100 + day, dated: true};
  }
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(lower);
  if (match) {
    const year = fullYear(match[3]!, false), first = Number(match[1]), second = Number(match[2]);
    // Day and month order differ by locale; the year and the larger part order the dates well enough to tell forward from backward.
    if (year !== undefined && first >= 1 && second >= 1 && Math.min(first, second) <= 12 && Math.max(first, second) <= 31) return {family: 'date', key: year * 10000 + (first > 12 ? second * 100 + first : second > 12 ? first * 100 + second : first * 100 + second), dated: true};
  }
  // Numbers: a plain decimal.
  if (/^[-+]?\d+(?:\.\d+)?$/.test(lower)) return {family: 'number', key: Number(lower), dated: false};
  return undefined;
}

/** True when `title` (a category axis title or category column name) names a time field in English or the deck language. */
export function isTimeFieldTitle(title: unknown, language?: string): boolean {
  if (typeof title !== 'string') return false;
  const text = title.normalize('NFKC').toLocaleLowerCase(language || 'en').replace(/[()[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
  return text !== '' && vocabulary(language).fields.has(text);
}

/**
 * LH-105: true when chart categories `labels` are ordered in time (see the module comment): every label is one family of time point
 * running forward, or `options.title` names a time field and the labels are distinct. `options.language` is the deck language, whose
 * month names and time-field words count besides English.
 */
export function chartCategoriesInTime(labels: readonly unknown[], options: {title?: unknown; language?: string} = {}): boolean {
  if (labels.length < 2) return false;
  const vocab = vocabulary(options.language);
  const parsed = labels.map(label => parse(label, vocab, options.language));
  if (parsed.every((entry): entry is Parsed => entry !== undefined)) {
    // Years mix with dated periods and months of one calendar ("2024", "Q1 2025") only through their key's year; one family keeps it simple.
    const family = parsed[0]!.family;
    if (parsed.every(entry => entry.family === family)) {
      const strict = family === 'year' || family === 'number';
      const cyclic = !strict && family !== 'date' && parsed.every(entry => !entry.dated);
      let wraps = 0, forward = true;
      for (let index = 1; index < parsed.length; index++) {
        const step = parsed[index]!.key - parsed[index - 1]!.key;
        if (step > 0 || (step === 0 && !strict && family === 'date')) continue;
        if (cyclic && step < 0 && ++wraps <= 1) continue;
        forward = false;
        break;
      }
      // A cyclic run that wrapped must not come back past where it started (Q3, Q4, Q1, Q2 is a year; Q3, Q1, Q4 is not).
      if (forward && wraps === 1 && parsed[parsed.length - 1]!.key >= parsed[0]!.key) forward = false;
      return forward;
    }
  }
  if (!isTimeFieldTitle(options.title, options.language)) return false;
  const texts = labels.map(label => label === null || label === undefined ? '' : String(label).trim());
  return texts.every(Boolean) && new Set(texts).size === texts.length;
}

/** LH-105: the month (1 to 12) a word or label names in English or the deck language (January, Jan, Sept, يناير), or undefined. */
export function monthOf(text: unknown, language?: string): number | undefined {
  if (typeof text !== 'string' || !text.trim()) return undefined;
  return vocabulary(language).months.get(asciiDigits(text.normalize('NFKC')).toLocaleLowerCase(language || 'en').replace(/\.$/, '').trim());
}
