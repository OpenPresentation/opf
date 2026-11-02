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
import {chartNumber, type ResolvedChartData} from './chart-data.js';
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
function words(text: string, language: string): string[] {
  return text.normalize('NFKC').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/['’]s\b/gu, '').toLocaleLowerCase(language)
    .split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);
}

/** One digit-group-aware number in a title, with the decimals it is written to and whether a percent sign follows. */
function titleNumbers(text: string): {value: number; decimals: number; percent: boolean}[] {
  const ascii = text.normalize('NFKC').replace(/\p{Nd}/gu, char => { const code = char.codePointAt(0)!; let zero = code; while (code - zero < 9 && /\p{Nd}/u.test(String.fromCodePoint(zero - 1))) zero--; return String((code - zero) % 10); });
  return [...ascii.matchAll(/(?<![\p{L}\d.])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(%)?/gu)].map(match => {
    const decimals = match[2] ? match[2].length - 1 : 0;
    return {value: Number(`${match[1]!.replace(/,/g, '')}${match[2] ?? ''}`), decimals, percent: match[3] !== undefined};
  });
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
  let collator: Intl.Collator;
  try { collator = new Intl.Collator(language, {sensitivity: 'base', usage: 'search'}); } catch { collator = new Intl.Collator('en', {sensitivity: 'base', usage: 'search'}); }
  const same = (a: string, b: string) => collator.compare(a, b) === 0;
  // A word of a name matches a title word as itself or as its plural (s, es), either way round.
  const matches = (name: string, title: string) => same(name, title) || [name + 's', name + 'es'].some(plural => same(plural, title)) || [title + 's', title + 'es'].some(plural => same(plural, name));
  const title = words(options.text, language);
  // The position of the first run of `tokens` in the title, or -1.
  const find = (tokens: readonly string[]) => {
    if (!tokens.length) return -1;
    for (let at = 0; at + tokens.length <= title.length; at++) if (tokens.every((token, index) => matches(token, title[at + index]!))) return at;
    return -1;
  };
  // Where the title names each of `names` (a position, or -1): the whole name, else its words not shared by every other name.
  const named = (names: readonly string[]) => {
    const tokens = names.map(name => words(name, language));
    const common = tokens.length > 1 ? tokens[0]!.filter(token => tokens.every(list => list.some(other => same(other, token)))) : [];
    return tokens.map(list => {
      const whole = find(list);
      if (whole >= 0) return whole;
      const own = list.filter(token => !common.some(shared => same(shared, token)));
      return own.length && own.length < list.length ? find(own) : -1;
    });
  };
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
