// LH-105: the chart's focus, from what the slide title says.
//
// Few and Claude Design: colour for what matters, the rest as context. A slide title usually states the chart's message ("North America
// still leads on bookings", "Support tickets peaked in November", "Only 31 of 186 qualified deals close", "Cloud spend overtook
// on-premises in 2023"), so the marks it names are the ones to emphasise. `chartTitleFocus` matches the slide title and subtitle against
// the chart's series names, its category names and (one series) its values:
//
//   words       the text and each name are split into words (letters and digits of any script; a hyphen or an apostrophe splits) and
//               compared with Intl.Collator at base sensitivity in the deck language, so case and accents do not matter; a possessive
//               ('s) is dropped and a plural (s, es) matches its singular. A name matches when its words appear in a row in the title, or,
//               for a name of several words, the words it does not share with every other name do ("Enterprise NPS" beside "Mid-market
//               NPS" matches "Enterprise"). A unit in parentheses is not part of the name ("Cloud ($B)" is "Cloud").
//   months      a month name in the title matches a category that names the same month in English or the deck language (November, Nov).
//   values      on a one-series chart a number in the title (1,790; 31; 62.4; 12% for a percent column) matches the categories whose
//               value it is, at the precision the title writes it.
//
// The focus is a proper subset: on a chart of several series, the series the title names (Organic search), else the categories it names
// (Platform); when it names every series, the one it names first (the subject: "Enterprise satisfaction pulled ahead of mid-market").
// On a one-series chart and a pie, the categories it names or whose values it prints. Naming nothing (or everything) is no focus, and
// the chart falls back to the small chart's last-point emphasis over time (chart-layer.ts). An explicit `highlight` or `colors` wins.
// The engines draw the focused marks in their full-strength colour and the other marks in the context neutrals (core `chartContextColors`):
// one gray per context series (or slice), stepped 11 L* apart in the order they come (the first the strongest), so stacked segments and
// neighbouring slices stay apart; at 3:1 against the backdrop, or at 1.6:1 when every context mark carries its text (`labeled`).
import {chartNumber, tableKeyText, type ResolvedChartData} from './chart-data.js';
import {monthOf} from './chart-time-order.js';

/** LH-105: what the slide title names: series (indices among the plotted series) or categories (row indices). */
export interface ChartLayerFocus {
  series?: number[];
  categories?: number[];
  /** True when every context mark carries its text (composition sets it): the context neutrals may be light (`chartContextColors`). */
  labeled?: boolean;
}

const FOCUS_TYPES = new Set(['column', 'stacked-column', '100pct-stacked-column', 'bar', 'stacked-bar', '100pct-stacked-bar', 'line', 'line-with-markers',
  'stacked-line', 'stacked-line-with-markers', 'area', 'stacked-area', '100pct-stacked-area', 'pie', 'doughnut']);

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The words of a text: letters and digits of any script, a possessive dropped, lower case. */
export function words(text: string, language: string): string[] {
  return text.normalize('NFKC').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/['’]s\b/gu, '').toLocaleLowerCase(language)
    .split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);
}

/**
 * One digit-group-aware number in a title, with the decimals it is written to and whether a percent sign follows; `text` is the number
 * as written (ASCII digits) and `before` the title text before it (LH-110 reads the comparison word there).
 */
export function titleNumbers(text: string): {value: number; decimals: number; percent: boolean; text: string; before: string}[] {
  const ascii = text.normalize('NFKC').replace(/\p{Nd}/gu, char => { const code = char.codePointAt(0)!; let zero = code; while (code - zero < 9 && /\p{Nd}/u.test(String.fromCodePoint(zero - 1))) zero--; return String((code - zero) % 10); });
  return [...ascii.matchAll(/(?<![\p{L}\d.])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(%)?/gu)].map(match => {
    const decimals = match[2] ? match[2].length - 1 : 0;
    return {value: Number(`${match[1]!.replace(/,/g, '')}${match[2] ?? ''}`), decimals, percent: match[3] !== undefined, text: match[0].trim(), before: ascii.slice(0, match.index ?? 0)};
  });
}

/** LH-113: words that name nothing on their own: a key made only of them never matches, and they never match a key by themselves. */
const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has', 'have', 'in', 'is', 'it', 'its', 'of', 'on',
  'or', 'our', 'that', 'the', 'their', 'this', 'to', 'was', 'we', 'were', 'will', 'with', 'all', 'other', 'others', 'total', 'rest', 'more', 'most',
  'less', 'than', 'per', 'new', 'not', 'no', 'only', 'one', 'both', 'each', 'every', 'any', 'none', 'vs', 'via']);

/** The words of a text as `words` splits them, in their written case (for the proper-name rule). */
function casedWords(text: string): string[] {
  return text.normalize('NFKC').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/['’]s\b/gu, '').split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);
}

/**
 * LH-105, LH-113: where a text names each of a list of names. A word of a name matches a text word as itself or as its plural (s, es),
 * either way round, compared with Intl.Collator at base sensitivity in the deck language. A name matches where its words appear in a
 * row, or, for a name of several words, where the words it does not share with every other name do. With `stop` (LH-113), stop words
 * never match a name by themselves; with `cased`, the text's words in their written case, a name of several capitalized words (a proper
 * name: "Corvid Plastics") also matches by its first word written capitalized, when no other name has that word.
 */
function focusMatcher(language: string) {
  let collator: Intl.Collator;
  try { collator = new Intl.Collator(language, {sensitivity: 'base', usage: 'search'}); } catch { collator = new Intl.Collator('en', {sensitivity: 'base', usage: 'search'}); }
  const same = (a: string, b: string) => collator.compare(a, b) === 0;
  const matches = (name: string, title: string) => same(name, title) || [name + 's', name + 'es'].some(plural => same(plural, title)) || [title + 's', title + 'es'].some(plural => same(plural, name));
  // The position of the first run of `tokens` in the text, or -1.
  const find = (text: readonly string[], tokens: readonly string[]) => {
    if (!tokens.length) return -1;
    for (let at = 0; at + tokens.length <= text.length; at++) if (tokens.every((token, index) => matches(token, text[at + index]!))) return at;
    return -1;
  };
  const capital = (word: string) => /^\p{Lu}/u.test(word);
  const named = (text: readonly string[], names: readonly string[], options: {stop?: boolean; cased?: readonly string[]} = {}) => {
    const tokens = names.map(name => words(name, language));
    const common = tokens.length > 1 ? tokens[0]!.filter(token => tokens.every(list => list.some(other => same(other, token)))) : [];
    const content = (word: string) => !options.stop || !STOP_WORDS.has(word);
    return tokens.map((list, index) => {
      if (!list.some(content)) return -1;
      const whole = find(text, list);
      if (whole >= 0) return whole;
      const own = list.filter(token => !common.some(shared => same(shared, token)) && content(token));
      // LH-113: own words that are only numbers ("Plan 2" beside "Plan 1") name nothing on their own: "Point 2" is not "Plan 2".
      const lettered = !options.stop || own.some(token => /\p{L}/u.test(token));
      const partial = own.length && own.length < list.length && lettered ? find(text, own) : -1;
      if (partial >= 0 || !options.cased) return partial;
      const written = casedWords(names[index]!), first = list[0]!;
      if (written.length < 2 || !written.every(capital) || !content(first) || tokens.some((other, at) => at !== index && other.some(word => same(word, first)))) return -1;
      return text.findIndex((word, at) => matches(first, word) && capital(options.cased![at] ?? ''));
    });
  };
  return {same, named};
}

/**
 * LH-105: the focus the slide title (and subtitle) `text` gives a chart, or undefined (see the module comment). `chart` is the drawn chart
 * and `data` its resolved data; `language` the deck language.
 */
export function chartTitleFocus(chart: unknown, data: ResolvedChartData, options: {text?: string; language?: string} = {}): ChartLayerFocus | undefined {
  if (!record(chart) || !data.ok || data.combo || chart.highlight !== undefined || chart.colors !== undefined || !options.text?.trim()) return undefined;
  const type = typeof chart.type === 'string' ? chart.type.trim().toLowerCase() : '';
  if (!FOCUS_TYPES.has(type) || data.columns.length < 2 || !data.rows.length) return undefined;
  const circular = type === 'pie' || type === 'doughnut';
  if (circular && data.columns.length !== 2) return undefined;
  const language = options.language || 'en';
  const matcher = focusMatcher(language), title = words(options.text, language);
  const named = (names: readonly string[]) => matcher.named(title, names);
  const proper = (positions: number[]) => { const hits = positions.flatMap((at, index) => at >= 0 ? [index] : []); return hits.length > 0 && hits.length < positions.length ? hits : undefined; };
  const categories = data.rows.map(row => row[0] === null || row[0] === undefined ? '' : String(row[0]));
  const byName = named(categories);
  // A month in the title names the category of that month (November and Nov).
  const titleMonths = new Set(title.map(word => monthOf(word, language)).filter((month): month is number => month !== undefined));
  const categoryHits = categories.map((category, index) => byName[index]! >= 0 || (titleMonths.size > 0 && titleMonths.has(monthOf(category, language) ?? 0)) ? 0 : -1);
  const seriesCount = data.columns.length - 1;
  if (seriesCount >= 2 && !circular) {
    const seriesHits = named(data.columns.slice(1).map(String));
    const series = proper(seriesHits);
    if (series) return {series};
    const rows = proper(categoryHits);
    if (rows) return {categories: rows};
    // Every series named: the one the title names first is its subject.
    if (seriesHits.every(at => at >= 0)) return {series: [seriesHits.indexOf(Math.min(...seriesHits))]};
    return undefined;
  }
  // One series (or a pie): the categories the title names, or whose values it prints.
  const format = typeof data.formats[1] === 'string' ? data.formats[1] : '';
  const numbers = titleNumbers(options.text);
  const values = data.rows.map(row => chartNumber(row[1]));
  const byValue = values.map(value => value !== null && numbers.some(number => {
    if (number.percent && !format.includes('%')) return false;
    const target = number.percent ? number.value / 100 : number.value, decimals = number.percent ? number.decimals + 2 : number.decimals;
    return Math.abs(Number(value.toFixed(decimals)) - target) < 10 ** -(decimals + 6);
  }) ? 0 : -1);
  const rows = proper(categoryHits.map((at, index) => at >= 0 || byValue[index]! >= 0 ? 0 : -1));
  return rows ? {categories: rows} : undefined;
}

// LH-113: shared emphasis across kinds. A slide's message is stated not only by its title: a sentence beside the data ("Engineering and
// support carry 70% of the new roles"), a quote ("We re-sourced the three top Corvid parts"), a list entry or the chart's own text
// alternative ("Controllers cost the most in warranty claims") names the rows it is about. The focus terms of a slide come from all of
// them (`slideFocusSources`) and apply to every chart (its categories or series, through LH-105's focus) and every table (its rows,
// `tableSlideFocus`) on the slide whose author set no `highlight` or `colors`.
//
// What counts as a match is LH-105's (words in the deck language, plurals, a name's own words beside its siblings', months), plus, for
// these sources, conservative rules: stop words never name a key; a proper name of several capitalized words also matches by its first
// word written capitalized ("Corvid" for "Corvid Plastics"); a long paragraph (over LONG_FOCUS_SOURCE characters) counts only when it
// names one key; a list whose entries name keys in two or more entries enumerates them (it is not a focus); and the sources must agree:
// the focus is the keys every naming source names (the alt "the lab uses more than twice the office level" and the text "the lab holds
// 9% of our floor area" agree on the lab). The title still comes first: what it names is the focus on its own (LH-105). The focus is a
// proper subset of the keys; naming nothing, or everything, is no focus. A table also matches a percent a source prints against its
// percent cells ("Prices rise 3%" names the rows whose change is +3%).

/** LH-113: a text on the slide that may name what its charts and tables are about. */
export interface FocusSource {
  text: string;
  /** `title` is the title and subtitle together; `entry` one list entry (of list `list`); `alt` a chart's text alternative. */
  kind: 'title' | 'text' | 'quote' | 'entry' | 'alt';
  /** For an entry: which list of the slide it belongs to. */
  list?: number;
}

/** LH-113: a paragraph longer than this names a focus only when it names one key. */
export const LONG_FOCUS_SOURCE = 140;
/** LH-113: words that join coordinated keys ("Engineering and support"); in the Latin-script languages of the bundled vocabularies. */
const CONJUNCTIONS = new Set(['and', 'or', 'plus', 'und', 'oder', 'et', 'ou', 'y', 'o', 'e', 'og', 'en']);
/** LH-113: the words around two keys that bound a range ("from March to August", "between A and B"). */
const RANGE_START = new Set(['from', 'between']), RANGE_END = new Set(['to', 'through', 'until', 'and']);

const plainText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(plainText).join('');
  return record(value) ? plainText(value.text ?? value.value) : '';
};

/** LH-113: the texts of a slide that may name its focus: the title and subtitle, then every text, list entry, quote and chart alt in its blocks. */
export function slideFocusSources(slide: unknown): FocusSource[] {
  const sources: FocusSource[] = [];
  if (!record(slide)) return sources;
  const heading = [slide.title, slide.subtitle].map(plainText).map(text => text.trim()).filter(Boolean).join('. ');
  if (heading) sources.push({text: heading, kind: 'title'});
  let lists = 0;
  const push = (text: string, kind: FocusSource['kind'], list?: number) => { if (text.trim()) sources.push({text, kind, ...(list !== undefined ? {list} : {})}); };
  const entries = (value: unknown, list: number, depth: number): void => {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (record(entry)) {
        push([plainText(entry.text), plainText(entry.description)].filter(Boolean).join('. '), 'entry', list);
        if (depth < 4 && entry.items !== undefined) entries(entry.items, list, depth + 1);
      } else push(plainText(entry), 'entry', list);
    }
  };
  const visit = (payload: unknown, depth: number): void => {
    if (!record(payload) || depth > 8) return;
    if (payload.text !== undefined) push(plainText(payload.text), 'text');
    for (const key of ['items', 'bullets']) if (payload[key] !== undefined) entries(payload[key], lists++, 0);
    if (payload.quote !== undefined) push(plainText(record(payload.quote) ? payload.quote.text : payload.quote), 'quote');
    if (record(payload.chart) && typeof payload.chart.alt === 'string') push(payload.chart.alt, 'alt');
    if (Array.isArray(payload.blocks)) for (const block of payload.blocks) visit(block, depth + 1);
  };
  visit(slide, 0);
  return sources;
}

/**
 * LH-113: the keys (indices) the `sources` name together, or undefined (see the comment above `FocusSource`). `months` lets a month name
 * a key of that month; `values` gives the keys a source names by a number it prints.
 */
export function focusHits(keys: readonly string[], sources: readonly FocusSource[], options: {language?: string; months?: boolean; values?: (source: FocusSource) => readonly number[]} = {}): number[] | undefined {
  if (keys.length < 2 || !sources.length) return undefined;
  const language = options.language || 'en', matcher = focusMatcher(language);
  const keyMonths = options.months ? keys.map(key => monthOf(key, language)) : [];
  const keyWords = keys.map(key => words(key, language));
  const hits = sources.map(source => {
    // A printed quantity (3.1%, $71M, 62.4) is a value, not a name: its digits never name a key ("Week 3" in "3.1%").
    const clean = source.text.replace(/[$€£¥]\s?\d[\d,.]*|\d[\d,]*\.\d+|\d[\d,.]*\s?%/gu, ' ');
    const text = words(clean, language), named = matcher.named(text, keys, {stop: true, cased: casedWords(clean)});
    // Where the text names each key: by name, else by a month of the key's month.
    const at = keys.map((_, index) => named[index]! >= 0 ? named[index]! : keyMonths[index] === undefined ? -1 : text.findIndex(word => monthOf(word, language) === keyMonths[index]));
    let order = keys.map((_, index) => index).filter(index => at[index]! >= 0).sort((a, b) => at[a]! - at[b]!);
    // A long paragraph names a focus only when it names one key.
    if (order.length > 1 && source.text.length > LONG_FOCUS_SOURCE) order = [];
    if (order.length > 1) {
      const first = at[order[0]!]!, last = at[order[order.length - 1]!]!, span = text.slice(first, last);
      const own = new Set(order.flatMap(index => keyWords[index]!));
      // "from March to August", "range from 71 in APAC to 78 in the Americas": the keys bound a range; none is the focus.
      if (text.slice(Math.max(0, first - 5), first).some(word => RANGE_START.has(word)) && span.some(word => RANGE_END.has(word))) order = [];
      // "Engineering and support carry 70%": coordinated keys are the focus together; otherwise the key named first is the subject
      // ("The lab building uses ... more than twice the office level").
      else if (!span.every(word => own.has(word) || CONJUNCTIONS.has(word))) order = [order[0]!];
    }
    const values = options.values?.(source) ?? [];
    return [...new Set([...order, ...values])].sort((a, b) => a - b);
  });
  // A list whose entries name keys in two or more entries enumerates the keys: none of its entries is a focus.
  const naming = new Map<number, number>();
  sources.forEach((source, index) => { if (source.list !== undefined && hits[index]!.length) naming.set(source.list, (naming.get(source.list) ?? 0) + 1); });
  const sets = hits.filter((set, index) => {
    const source = sources[index]!;
    return set.length > 0 && !(source.list !== undefined && naming.get(source.list)! >= 2);
  });
  if (!sets.length) return undefined;
  const shared = sets[0]!.filter(index => sets.every(set => set.includes(index)));
  return shared.length && shared.length < keys.length ? shared : undefined;
}

/** The chart types a focus applies to, with the data it needs (LH-105's guards). */
function focusable(chart: unknown, data: ResolvedChartData): chart is Record<string, unknown> {
  if (!record(chart) || !data.ok || data.combo || chart.highlight !== undefined || chart.colors !== undefined) return false;
  const type = typeof chart.type === 'string' ? chart.type.trim().toLowerCase() : '';
  if (!FOCUS_TYPES.has(type) || data.columns.length < 2 || !data.rows.length) return false;
  return !((type === 'pie' || type === 'doughnut') && data.columns.length !== 2);
}

/**
 * LH-113: a chart's focus from every focus source of its slide: the title's (LH-105, `chartTitleFocus`) when it names one, else what the
 * other sources name together: the series on a chart of several series, else the categories.
 */
export function chartSlideFocus(chart: unknown, data: ResolvedChartData, options: {sources: readonly FocusSource[]; language?: string}): ChartLayerFocus | undefined {
  const language = options.language, lang = language !== undefined ? {language} : {};
  const title = options.sources.filter(source => source.kind === 'title').map(source => source.text).join('. ');
  const byTitle = chartTitleFocus(chart, data, {text: title, ...lang});
  if (byTitle || !focusable(chart, data) || !data.ok) return byTitle;
  const rest = options.sources.filter(source => source.kind !== 'title');
  if (!rest.length) return undefined;
  const type = String(chart.type).trim().toLowerCase(), circular = type === 'pie' || type === 'doughnut';
  if (data.columns.length - 1 >= 2 && !circular) {
    const series = focusHits(data.columns.slice(1).map(String), rest, lang);
    if (series) return {series};
  }
  const categories = focusHits(data.rows.map(row => row[0] === null || row[0] === undefined ? '' : String(row[0])), rest, {...lang, months: true});
  return categories ? {categories} : undefined;
}

/** LH-113: the body rows `table.highlight.rows` names, by their key (first-column) text, exactly as `chart.highlight` names categories. */
export function tableHighlightRows(highlight: unknown, rows: readonly (readonly unknown[])[]): number[] {
  if (!record(highlight) || !Array.isArray(highlight.rows)) return [];
  const names = new Set(highlight.rows.filter((name): name is string => typeof name === 'string'));
  return rows.flatMap((row, index) => names.has(tableKeyText(row[0])) ? [index] : []);
}

/**
 * LH-113: the body rows of a table its slide's focus sources name (`sources` from `slideFocusSources`), or undefined: by their key (the
 * first column), or by a percent a source prints that one of a row's other cells shows (`shown`: each body row's displayed cell texts).
 * A table whose author set `highlight` or filled a body cell has no derived focus.
 */
export function tableSlideFocus(table: unknown, rows: readonly (readonly unknown[])[], shown: readonly (readonly string[])[], options: {sources: readonly FocusSource[]; language?: string}): number[] | undefined {
  if (!record(table) || table.highlight !== undefined || rows.length < 2) return undefined;
  if (rows.some(row => row.some(cell => record(cell) && record(cell.style) && cell.style.fill !== undefined))) return undefined;
  const keys = rows.map(row => tableKeyText(row[0]));
  const percent = /^[+\-−]?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?%$/u;
  const cells = shown.map(row => row.slice(1).flatMap(text => { const match = percent.exec(text.trim()); return match ? [Number(`${match[1]!.replace(/,/g, '')}${match[2] ?? ''}`)] : []; }));
  const values = (source: FocusSource) => {
    const printed = titleNumbers(source.text).filter(number => number.percent);
    return printed.length ? cells.flatMap((row, index) => row.some(value => printed.some(number => Math.abs(Number(value.toFixed(number.decimals)) - number.value) < 10 ** -(number.decimals + 6))) ? [index] : []) : [];
  };
  const language = options.language, common = {...(language !== undefined ? {language} : {}), months: true, values};
  return focusHits(keys, options.sources.filter(source => source.kind === 'title'), common) ?? focusHits(keys, options.sources.filter(source => source.kind !== 'title'), common);
}
