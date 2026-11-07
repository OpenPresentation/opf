// LH-160: the bins of a histogram and what it labels, decided once in composition so the preview (opf-render) and PowerPoint (opf-pptx,
// a native chartex histogram) draw the same chart.
//
// PowerPoint's chartex category axis has no label interval (there is no tickLblSkip on a chartex axis) and wraps a long bin label onto two
// lines that overlap their neighbors, so "label every nth bin" is not available to the native chart. What both engines can do alike:
//
//   bin count     Scott's count (Office's automatic bins), but never more bins than the plot can label one beside another: each bin
//                 gets HISTOGRAM_LABEL_SLOT chart text sizes (a rotated label's width is its text height). A chart with room keeps
//                 Scott's count; a dense one (54 bins over a half-width plot) draws fewer, wider bins. The count is written as
//                 `cx:binCount`, so PowerPoint draws the bins the preview does.
//   edge labels   A bin reads "(8333, 11250]", not "(8333.33333, 11250]": the edges are rounded to the decimals the bin width needs
//                 (`histogramEdgeDecimals`, within a tenth of a bin of the true edge), written as the category axis number format
//                 (`cx:numFmt`), which PowerPoint applies to the bin labels. Short labels stay on one line. An edge is rounded the way
//                 PowerPoint rounds it (`histogramEdgeText`: its decimal value, half away from zero), so 3.05 reads 3.1 in both engines.
//   value axis    RR-105: the value axis is decided here too (`valueAxis`, core `niceScale` over the bars) and written as the chartex
//                 `cx:valScaling` min, max and majorUnit, because PowerPoint's automatic chartex axis follows its own rule (0 to 4,500
//                 by 500 where the preview drew 0 to 5,000 by 1,000).
//   value labels  Per-bar value labels are dropped when they do not fit beside each other (a label wider than its bar's slot), the
//                 rule of the small chart's labels (LH-111): about a dozen bars of a half-width chart, more on a wide one.
//
// A histogram or Pareto chart over a category column (one bar per row) keeps its rows; only its value labels follow the fit rule.
import {chartNumber, type ResolvedChartData} from './chart-data.js';
import {chartIntervalsFor, chartTextSize, niceScale, type ChartValueAxis} from './chart-axis.js';
import {chartLabelText, chartOptionTarget, resolveChartOptions} from './chart-options.js';
import {columnGroups, valueLabel, type ChartLayerGeometry} from './chart-layer.js';

/** Each bin of a binned histogram gets this many chart text sizes of plot width, so its rotated label reads beside its neighbors. */
export const HISTOGRAM_LABEL_SLOT = 1.8;
/** A histogram never draws fewer bins than this because of its label slots (a very small chart keeps a readable shape). */
export const HISTOGRAM_MIN_BINS = 5;

/** One bin of a histogram of a lone value column. */
export interface HistogramBin { low: number; high: number; count: number; label: string }

/** LH-160: what composition decides for a histogram or Pareto chart. Absent keys keep the engines' defaults. */
export interface ChartLayerHistogram {
  /** The bin count of a lone value column (`cx:binCount`): Scott's count, or fewer when the labels would not fit. */
  bins?: number;
  /** The decimals of the bin edges in the labels and the category axis format (`0`, `0.0`, ...). */
  decimals?: number;
  /** False when the chart's data labels do not fit beside each other: neither engine draws them. */
  valueLabels?: false;
  /** RR-105: the value axis both engines draw (the preview's scale; the chartex `cx:valScaling` min, max and majorUnit). */
  valueAxis?: ChartValueAxis;
  /** RR-105: a Pareto chart's percentage axis step (0 to 100%), the preview's ticks and the chartex secondary axis `majorUnit`. */
  percentUnit?: number;
}

/**
 * Office's automatic histogram bins: Scott's normal reference rule gives the bin width 3.49 * sd * n^(-1/3) (sample standard deviation)
 * over [min, max]; the exporter writes the same count as cx:binCount.
 */
export function scottBinCount(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) return 1;
  let min = Infinity, max = -Infinity, mean = 0;
  for (const value of values) { if (value < min) min = value; if (value > max) max = value; mean += value / n; }
  if (!(max > min) || n < 2) return 1;
  let variance = 0;
  for (const value of values) variance += (value - mean) * (value - mean) / (n - 1);
  const width = 3.49 * Math.sqrt(variance) * Math.cbrt(n) ** -1;
  if (!(width > 0) || !Number.isFinite(width)) return 1;
  const count = Math.ceil((max - min) / width - 1e-9);
  return Number.isFinite(count) && count >= 1 ? count : 1;
}

/**
 * The decimals a bin edge is written with: the fewest that put every rounded edge within a tenth of the bin width of the true one (a
 * 6-wide bin reads whole numbers, a 3.7-wide one tenths, a 0.37-wide one hundredths). Without the `edges` the width alone gives the
 * decimals that hold for any edges; with them, edges that already are whole numbers (bins of 1 to 9 over whole-number data) need none.
 */
export function histogramEdgeDecimals(width: number, edges?: readonly number[]): number {
  if (!(width > 0) || !Number.isFinite(width)) return 0;
  const bound = Math.min(10, Math.max(0, Math.ceil(0.7 - Math.log10(width) - 1e-9)));
  if (!edges) return bound;
  const tolerance = width / 10 + 1e-12;
  for (let decimals = 0; decimals < bound; decimals++) if (edges.every(edge => Math.abs(edge - Number(histogramEdgeText(edge, decimals))) <= tolerance)) return decimals;
  return bound;
}

/**
 * RR-105: an edge written with `decimals` decimals as PowerPoint writes it under the format `0.0...`: the number's decimal value (15
 * significant digits, so 1.2 + 1.85 is 3.05 and not 3.0499999999999998) rounded half away from zero. `toFixed` rounds the binary value
 * and wrote 3.0 where PowerPoint shows 3.1 (v0.33 PowerPoint qualification).
 */
export function histogramEdgeText(value: number, decimals: number): string {
  const places = Math.min(20, Math.max(0, Math.floor(decimals)));
  if (!Number.isFinite(value)) return value.toFixed(places);
  const scaled = Number((Number(Math.abs(value).toPrecision(15)) * 10 ** places).toPrecision(15));
  const whole = Math.round(scaled);
  if (!Number.isSafeInteger(whole)) return value.toFixed(places);
  const rounded = whole / 10 ** places;
  return (value < 0 && whole !== 0 ? -rounded : rounded).toFixed(places);
}

/** The Excel number format of edges written with `decimals` decimals (the category axis format PowerPoint applies to its bin labels). */
export const histogramEdgeFormat = (decimals: number): string => decimals > 0 ? `0.${'0'.repeat(decimals)}` : '0';

/**
 * Equal-width bins from the minimum, closed on the right like PowerPoint's ("[min, e1]", then "(e1, e2]"): each value falls in the last bin
 * whose upper edge it does not exceed. `count` is Scott's count unless given. Labels carry `decimals` decimals when given, else six
 * significant digits, and more when two bins would read alike.
 */
export function histogramBins(values: readonly (number | null)[], options: {count?: number; decimals?: number} = {}): HistogramBin[] {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!finite.length) return [];
  const min = finite.reduce((a, b) => Math.min(a, b)), max = finite.reduce((a, b) => Math.max(a, b));
  const count = Math.max(1, Math.floor(options.count ?? scottBinCount(finite)));
  const edge = (index: number) => index === 0 ? min : index === count ? max : min / count * (count - index) + max / count * index;
  const bins = Array.from({length: count}, (_, index) => ({low: edge(index), high: edge(index + 1), count: 0}));
  for (const value of finite) {
    let index = 0;
    while (index + 1 < count && value > bins[index]!.high) index++;
    bins[index]!.count++;
  }
  const labelsWith = (format: (value: number) => string) => bins.map((bin, index) => count === 1 && min === max ? format(min) : `${index === 0 ? '[' : '('}${format(bin.low)}, ${format(bin.high)}]`);
  if (options.decimals !== undefined) {
    const decimals = options.decimals;
    const labels = labelsWith(value => histogramEdgeText(value, decimals));
    return bins.map((bin, index) => ({...bin, label: labels[index]!}));
  }
  for (let precision = 6; ; precision++) {
    const labels = labelsWith(value => String(Number(value.toPrecision(precision))));
    if (new Set(labels).size === labels.length || precision === 17) return bins.map((bin, index) => ({...bin, label: labels[index]!}));
  }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * LH-160: the layer of a histogram or Pareto chart, or undefined for any other chart or one that needs nothing decided. `chart` is the
 * drawn chart (core `chartDrawPlan`'s type). The plot is estimated from the chart box the way the preview lays it out: the padding, the
 * widest value tick, the half text size at the end, and a Pareto chart's percentage axis.
 */
export function chartHistogram(chart: unknown, data: ResolvedChartData, geometry: ChartLayerGeometry): ChartLayerHistogram | undefined {
  if (!record(chart) || !data.ok || data.combo) return undefined;
  const target = chartOptionTarget(chart.type);
  if (target?.kind !== 'histogram' && target?.kind !== 'pareto') return undefined;
  const {box, scale} = geometry;
  if (![box.width, box.height, scale].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0) return undefined;
  const fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize}) * scale, pad = 10 * scale;
  const hasCategories = data.columns.length > 1, column = hasCategories ? 1 : 0;
  const values = data.rows.map(row => chartNumber(row[column]));
  const format = hasCategories && typeof data.formats[column] === 'string' && data.formats[column] !== '' ? data.formats[column] : undefined;
  // A lone value column plots bin counts, which always group their thousands; a category column's values group by the column's rule.
  const group = hasCategories ? columnGroups(data, column) : true;
  const language = geometry.language;
  const titles = record(chart.axisTitles) ? chart.axisTitles : {};
  const titled = typeof titles.value === 'string' && titles.value.trim() !== '';
  const percentRoom = target.kind === 'pareto' ? geometry.measure('100%', fontPx, 400) + fontPx : 0;
  // The plot width for the tallest bar's tick label (the axis ends a quarter above the data at most).
  const plotWidth = (top: number) => Math.max(1, box.width - 2 * pad - (geometry.measure(valueLabel(Math.ceil(top * 1.25), format, group ? {language} : undefined), fontPx, 400) + fontPx * 0.5) - fontPx / 2 - percentRoom - (titled ? fontPx * 1.5 : 0));
  const out: ChartLayerHistogram = {};
  let counts: number[];
  let names: string[];
  if (hasCategories) {
    const rows = data.rows.map((row, index) => ({value: values[index], name: row[0] === null || row[0] === undefined ? '' : String(row[0])})).filter(row => row.value !== null);
    counts = rows.map(row => row.value as number);
    names = rows.map(row => row.name);
  } else {
    const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
    if (!finite.length) return undefined;
    const scott = scottBinCount(finite);
    // Only ever fewer bins: a coarser binning has larger counts and so a wider tick column, which can only lower the limit again.
    let count = scott, bins = histogramBins(finite, {count});
    for (let pass = 0; pass < 4 && count > HISTOGRAM_MIN_BINS; pass++) {
      const limit = Math.max(HISTOGRAM_MIN_BINS, Math.floor(plotWidth(Math.max(...bins.map(bin => bin.count))) / (fontPx * HISTOGRAM_LABEL_SLOT)));
      const next = Math.min(count, limit);
      if (next === count) break;
      count = next;
      bins = histogramBins(finite, {count});
    }
    const width = bins.length ? bins[0]!.high - bins[0]!.low : 0;
    out.bins = count;
    out.decimals = histogramEdgeDecimals(width, [...bins.map(bin => bin.low), bins.at(-1)!.high]);
    counts = bins.map(bin => bin.count);
    names = histogramBins(finite, {count, decimals: out.decimals}).map(bin => bin.label);
  }
  // RR-105: the value axis, niceScale over the bars (zero-based) with as many intervals as the plot's height holds, estimated from the box
  // as core's column axis is (chartValueAxis): the padding, the top margin and one line of category labels, less a category axis title.
  if (counts.length) {
    const lineHeight = fontPx * 1.5;
    const titleBand = typeof titles.category === 'string' && titles.category.trim() !== '' ? lineHeight : 0;
    const length = Math.max(1, box.height - 2 * pad - lineHeight * 1.5 - titleBand);
    const fitted = niceScale(Math.min(0, ...counts), Math.max(...counts), chartIntervalsFor(length, lineHeight * 1.2, scale));
    if ([fitted.min, fitted.max, fitted.step].every(Number.isFinite) && fitted.step > 0 && (fitted.max - fitted.min) / fitted.step <= 1000) out.valueAxis = {min: fitted.min, max: fitted.max, majorUnit: fitted.step};
    if (target.kind === 'pareto') {
      const percent = niceScale(0, 1, chartIntervalsFor(length, lineHeight * 1.2, scale), {percent: true});
      if (Number.isFinite(percent.step) && percent.step > 0) out.percentUnit = percent.step;
    }
  }
  // The data labels the author chose are drawn only where they fit beside each other (a label and half a text size of air per bar).
  const labels = resolveChartOptions(chart, target).dataLabels;
  if (labels && counts.length) {
    const band = plotWidth(Math.max(0, ...counts)) / counts.length;
    const widest = Math.max(0, ...counts.map((count, index) => geometry.measure(chartLabelText({
      category: names[index], value: valueLabel(count, format, group ? {language} : undefined),
    }, labels.content, labels.separator), fontPx, 400)));
    if (widest + fontPx * 0.5 > band) out.valueLabels = false;
  }
  return Object.keys(out).length ? out : undefined;
}
