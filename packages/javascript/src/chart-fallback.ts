// LH-60: chart fallbacks. Some data cannot be drawn by the chart type it is written for: a world map over categories that are not places
// (Q1 to Q4), a box-and-whisker chart with one value per category (every box is a single line), a pie or doughnut of several series (a pie
// plots one), a scatter whose X column holds text. Core decides once how such a chart is drawn, so the preview (opf-render) and the PPTX
// export (opf-pptx) draw the same chart, and it names every series the drawn construct still cannot plot (the `chart-series-dropped`
// warning), so no series is lost without a word.
//
// Browser-safe and synchronous. The place names come from the runtime's CLDR region names (Intl.DisplayNames), in English and in the deck
// language, so a right-to-left or CJK deck's country names count as places too.
import { chartOptionTarget, type ChartOptionKind } from './chart-options.js';
import { colorContrast, textColorForFill } from './color.js';
import type { DataCellValue, DataDiagnostic, ResolvedChartData } from './chart-data.js';

/** Why a chart is drawn as another construct (or with its data regrouped). */
export type ChartFallback = 'map-as-columns' | 'pareto-as-columns' | 'box-per-series' | 'nested-rings' | 'scatter-by-position';

/** How the engines draw a chart: the construct and the data they plot. */
export interface ChartDrawPlan {
  /** The catalog chart type the engines draw: the authored one, or its fallback (`column` for a map, `doughnut` for a pie of several series). */
  type: string;
  kind: ChartOptionKind;
  /** Set when the chart is drawn other than as authored. */
  fallback?: ChartFallback;
  /** The resolved data as drawn: the category column, the X column of a scatter (when `hasX`), then the plotted series. */
  columns: string[];
  hasX: boolean;
  formats: (string | undefined)[];
  rows: DataCellValue[][];
  /** The index in the resolved columns of each drawn column (a dropped scatter X column shifts the series by one). */
  sources: number[];
  /** The resolved columns the drawn construct does not plot: the series after the first of a one-series construct, a scatter X column with no number. */
  dropped: string[];
}

/** The constructs that plot one value series (the first); a lone value column is binned or plotted against row numbers instead. */
const ONE_SERIES: ReadonlySet<ChartOptionKind> = new Set(['pie', 'treemap', 'histogram', 'pareto', 'waterfall', 'funnel', 'map']);

/** The catalog type id of a chart, lower-cased (`donut` is the doughnut). */
function typeId(chart: unknown): string {
  const raw = chart !== null && typeof chart === 'object' ? (chart as { type?: unknown }).type : undefined;
  const id = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return id === 'donut' ? 'doughnut' : id;
}

// ---------------------------------------------------------------------------------------------------------------
// Places

/** Places PowerPoint's map charts plot that CLDR has no region code for: US states, Canadian provinces and Australian states, and common country aliases. */
const SUBDIVISIONS = 'alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|alberta|british columbia|manitoba|new brunswick|newfoundland and labrador|nova scotia|ontario|prince edward island|quebec|saskatchewan|northwest territories|nunavut|yukon|new south wales|queensland|south australia|tasmania|victoria|western australia|northern territory|australian capital territory|usa|u.s.|u.s.a.|united states of america|america|uk|u.k.|great britain|britain|england|scotland|wales|northern ireland|czech republic|holland|korea|south korea|north korea|russia|ivory coast|burma|swaziland|macedonia|turkey|emea|apac|latam|americas|europe|asia|africa|oceania|middle east';
/** The UN M.49 areas CLDR names (continents and subregions), besides the two-letter region codes. */
const AREAS = ['001', '002', '005', '009', '011', '013', '014', '015', '017', '018', '019', '021', '029', '030', '034', '035', '039', '053', '054', '057', '061', '142', '143', '145', '150', '151', '154', '155', '202', '419', 'EU', 'EZ', 'UN'];

/** A label folded for comparison: trimmed, lower case, without diacritics, one kind of apostrophe and single spaces. */
const fold = (label: string): string => label.normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[’ʼ`]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The languages whose region names always count, besides the deck language: a deck that declares no language (or another one) may still
 * name its places in its own script (日本, ألمانيا, Deutschland).
 */
const PLACE_LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'tr', 'ru', 'uk', 'ar', 'he', 'fa', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];

/** The folded region and area names of one locale (none when the runtime has no Intl.DisplayNames or does not know the locale). */
function regionNames(locale: string, codes: ReadonlySet<string>): string[] {
  let display: Intl.DisplayNames;
  try { display = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }); } catch { return []; }
  const names: string[] = [];
  for (const code of [...codes, ...AREAS]) {
    try { const name = display.of(code); if (name) names.push(fold(name)); } catch { /* an area this runtime does not name */ }
  }
  return names;
}

const placeNames = new Map<string, ReadonlySet<string>>();
/** The region and area names of {@link PLACE_LOCALES} and `language`, folded, plus the subdivisions and aliases; cached per language. */
function placesFor(language: string | undefined): { names: ReadonlySet<string>; codes: ReadonlySet<string> } {
  const codes = regionCodes();
  let base = placeNames.get('');
  if (!base) {
    base = new Set([...SUBDIVISIONS.split('|'), ...PLACE_LOCALES.flatMap(locale => regionNames(locale, codes))]);
    placeNames.set('', base);
  }
  if (!language || PLACE_LOCALES.includes(language)) return { names: base, codes };
  let names = placeNames.get(language);
  if (!names) {
    names = new Set([...base, ...regionNames(language, codes)]);
    placeNames.set(language, names);
  }
  return { names, codes };
}

let assignedCodes: ReadonlySet<string> | undefined;
/** The two-letter region codes CLDR names (ISO 3166-1 alpha-2), read once from the runtime. */
function regionCodes(): ReadonlySet<string> {
  if (assignedCodes) return assignedCodes;
  const set = new Set<string>();
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      try { if (display.of(code)) set.add(code); } catch { /* not a region subtag */ }
    }
  } catch { /* no Intl.DisplayNames: only the listed names count as places */ }
  assignedCodes = set;
  return set;
}

/**
 * True when a category label names a place a map chart can plot: a country or area by its CLDR name (in English or in `language`, the
 * deck's BCP 47 tag), an upper-case two-letter region code (`DE`), a US state, a Canadian province or territory, an Australian state, or a
 * common alias such as `USA` or `UK`. Cities and postal codes are not recognized.
 */
export function isPlaceLabel(label: unknown, language?: string): boolean {
  if (typeof label !== 'string' && typeof label !== 'number') return false;
  const text = String(label).trim();
  if (!text) return false;
  const { names, codes } = placesFor(language);
  return (/^[A-Z]{2}$/.test(text) && codes.has(text)) || names.has(fold(text));
}

// ---------------------------------------------------------------------------------------------------------------
// The plan

const label = (cell: unknown): string => cell === null || cell === undefined ? '' : String(cell);

/**
 * How the engines draw a resolved chart (`resolved` is its `resolveChartData` result; `options.language` the deck language, for place
 * names). The rules, each over the data alone:
 *
 * - **Map over categories that are not places** (`map-as-columns`): a `world` chart whose category labels are fewer than half places
 *   ({@link isPlaceLabel}) is drawn as clustered columns, every series kept. A map needs places to plot; Q1 to Q4 would be empty tiles.
 * - **Several series on a Pareto chart** (`pareto-as-columns`, LH-175): a Pareto chart sorts one series and draws its cumulative share,
 *   so two or more series that hold numbers (Current and Baseline by quarter) are drawn as clustered columns in data order, every series
 *   kept, in the preview and in PowerPoint.
 * - **One value per box-and-whisker category** (`box-per-series`): when no category label repeats (two rows or more), each box would be a
 *   single value. The rows are one group named after the category column, so each series is one box of its values across the categories.
 * - **Several series on a pie or doughnut** (`nested-rings`): two or more series that hold numbers are drawn as a doughnut of one ring per
 *   series, the first series innermost (as PowerPoint orders the rings of a doughnut), every ring coloured by category.
 * - **Scatter whose X column holds no number** (`scatter-by-position`): the text column cannot be an X axis, so it is left out and every
 *   series is plotted against the category position (1, 2, 3, ...), like a scatter of one value column.
 *
 * A construct that plots one series (treemap, histogram with categories, a Pareto chart of one numeric series, waterfall, funnel, map,
 * and pie) still draws only the first; the others are listed in `dropped`.
 */
export function chartDrawPlan(chart: unknown, resolved: Extract<ResolvedChartData, { ok: true }>, options: { language?: string } = {}): ChartDrawPlan {
  const authored = typeId(chart);
  const target = chartOptionTarget(authored);
  let type = authored, kind: ChartOptionKind | undefined = target?.kind;
  let { columns, hasX, formats, rows } = resolved;
  let sources = columns.map((_, index) => index);
  let fallback: ChartFallback | undefined;
  const dropped: string[] = [];
  const categorized = columns.length > 1;
  // The series that hold a number: a column of notes or labels beside a pie's values is not a ring.
  const first = hasX ? 2 : 1;
  const seriesCount = categorized ? columns.slice(first).filter((_, offset) => rows.some(row => typeof row[first + offset] === 'number')).length : 0;
  if (kind === 'map' && categorized) {
    const labels = rows.map(row => label(row[0]).trim()).filter(Boolean);
    const places = labels.filter(entry => isPlaceLabel(entry, options.language)).length;
    if (places * 2 < labels.length) ({ type, kind, fallback } = { type: 'column', kind: 'bar', fallback: 'map-as-columns' });
  } else if (kind === 'pareto' && seriesCount >= 2) {
    ({ type, kind, fallback } = { type: 'column', kind: 'bar', fallback: 'pareto-as-columns' });
  } else if (kind === 'box' && categorized && rows.length >= 2) {
    const labels = rows.map(row => label(row[0]));
    if (new Set(labels).size === labels.length) {
      fallback = 'box-per-series';
      rows = rows.map(row => [columns[0]!, ...row.slice(1)]);
    }
  } else if ((kind === 'pie' || kind === 'doughnut') && seriesCount >= 2) {
    ({ type, kind, fallback } = { type: 'doughnut', kind: 'doughnut', fallback: 'nested-rings' });
  } else if (kind === 'scatter' && hasX && rows.every(row => row[1] === null || row[1] === undefined)) {
    fallback = 'scatter-by-position';
    dropped.push(columns[1]!);
    const keep = columns.map((_, index) => index).filter(index => index !== 1);
    ({ columns, formats, rows, sources } = { columns: keep.map(index => columns[index]!), formats: keep.map(index => formats[index]), rows: rows.map(row => keep.map(index => row[index] ?? null)), sources: keep });
    hasX = false;
  }
  if (kind && ONE_SERIES.has(kind) && categorized && columns.length > 2) dropped.push(...columns.slice(2));
  return { type, kind: kind ?? 'bar', ...(fallback ? { fallback } : {}), columns, hasX, formats, rows, sources, dropped };
}

const quoted = (names: readonly string[]): string => names.map(name => JSON.stringify(name)).join(', ');

/**
 * The `chart-series-dropped` warning of a chart whose drawn construct leaves a resolved column out ({@link chartDrawPlan}'s `dropped`), at
 * the chart's `type` (`path` is the chart's JSON Pointer). Empty when every column is drawn.
 */
export function chartDrawDiagnostics(chart: unknown, resolved: ResolvedChartData, path = '', options: { language?: string } = {}): DataDiagnostic[] {
  if (!resolved.ok) return [];
  const plan = chartDrawPlan(chart, resolved, options);
  if (!plan.dropped.length) return [];
  const type = typeId(chart);
  const message = plan.fallback === 'scatter-by-position'
    ? `the X column ${quoted(plan.dropped)} of this scatter chart holds no numbers, so its series are plotted against the category position (1, 2, 3, ...) and that column is not drawn; give the X column numbers, or use a line or column chart`
    : `a '${type}' chart plots one series, so ${quoted(plan.dropped)} ${plan.dropped.length === 1 ? 'is' : 'are'} not drawn; use a chart type that plots several series (column, bar, line) or one chart per series`;
  return [{ code: 'chart-series-dropped', severity: 'warning', path: `${path}/type`, message }];
}

/**
 * LH-56: the colour of a label drawn inside a mark (a treemap tile, a funnel bar, a map tile) of colour `fill`: the deck's full text colour
 * `text` when it reaches 4.5:1 on the fill, else the slide background `background` (the other role colour, so the PPTX export still writes a
 * theme colour) when that does, else black or white ({@link textColorForFill}). The preview and the PPTX export both call it.
 */
export function markLabelColor(fill: string, text: string, background?: string): string {
  if ((colorContrast(text, fill) ?? 0) >= 4.5) return text;
  if (background !== undefined && (colorContrast(background, fill) ?? 0) >= 4.5) return background;
  return textColorForFill(fill, text);
}
