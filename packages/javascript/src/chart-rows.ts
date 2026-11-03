// LH-115: cross-kind row alignment (extends LH-18's shared row tracks across block kinds).
//
// A horizontal bar chart beside a table that lists the same keys in the same order (the bar categories are the table's first-column
// keys) takes the table's row pitch: each bar is drawn centered on its table row, so the eye reads a row straight across from its key
// and figures to its bar (Claude Design's "bars beside a table"; m14, m31 of the mixed corpus). Composition decides it once
// (`alignBarRows`, the chart layer's `rows`) and the preview draws every bar and category label on its row's center. The PPTX export
// writes the plot area over the table's body rows (an inner manual layout from the first row's top to the last row's bottom); a native
// bar chart has one category pitch, so where the rows are of unequal height (a wrapped cell) PowerPoint's bars sit on an even pitch over
// the same span, off their rows' centers by at most half the height difference. It costs no size: only the bars move, within the chart's
// box, and only when the table's body rows fit there (below the chart's header row, above its value-axis labels).
import {chartTextSize} from './chart-axis.js';
import {tableKeyText, type ResolvedChartData} from './chart-data.js';

/** LH-115: a horizontal bar chart's categories on a table's rows: offsets from the top of the chart box, and the plot's side insets (slide pixels). */
export interface ChartLayerRows {
  /** The top of the first row and the bottom of the last, from the top of the chart box: the plot's vertical extent. */
  top: number;
  bottom: number;
  /** Where each category's bar is centered, from the top of the chart box, in data order: the middle of its row's key text. */
  centers: number[];
  /** The plot's insets from the chart box's left and right edges as the preview lays them out, for the PPTX plot area. */
  left: number;
  right: number;
}

const BAR_TYPES = new Set(['bar', 'stacked-bar', '100pct-stacked-bar']);
type Box = {x: number; y: number; width: number; height: number};

/** LH-115: whether `type` is a horizontal bar chart (its categories run down the plot). */
export function horizontalBarType(type: unknown): boolean {
  return typeof type === 'string' && BAR_TYPES.has(type.trim().toLowerCase());
}

/** LH-115: whether two lists of keys name the same things in the same order (trimmed, compared at base sensitivity in `language`). */
export function sameKeys(a: readonly string[], b: readonly string[], language = 'en'): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  let collator: Intl.Collator;
  try { collator = new Intl.Collator(language, {sensitivity: 'base'}); } catch { collator = new Intl.Collator('en', {sensitivity: 'base'}); }
  return a.every((key, index) => key.trim() !== '' && collator.compare(key.trim(), b[index]!.trim()) === 0);
}

/** LH-115: the key texts (first column) of a table's body rows. */
export function tableRowKeys(rows: readonly (readonly unknown[])[]): string[] {
  return rows.map(row => tableKeyText(row[0]));
}

/** LH-115: whether two boxes stand side by side: they overlap vertically by half the shorter height and not horizontally. */
export function besideEachOther(a: Box, b: Box): boolean {
  const vertical = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  const horizontal = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  return vertical >= Math.min(a.height, b.height) / 2 && horizontal <= 0.5;
}

/**
 * LH-115: the rows a horizontal bar chart's categories take (`ChartLayerRows`), or undefined when the table rows do not fit the chart's
 * plot band. `box` is the chart box, `rows` the table's body row boxes in data order (one per category), `centers` the middle of each
 * row's key text (the table sets text at the top of its row, so a wrapped cell elsewhere in the row leaves the key above the row's middle;
 * the bar is read beside its key), `header` the chart layer's
 * header height, `hiddenAxis` whether the chart drops its value axis (LH-03), `measure` the body font measure at weight 400.
 */
export function alignBarRows(data: Extract<ResolvedChartData, {ok: true}>, box: Box, rows: readonly Box[], centers: readonly number[], options: {scale: number; minFontSize?: number; header?: number; hiddenAxis?: boolean; labels?: boolean; measure: (text: string, size: number) => number}): ChartLayerRows | undefined {
  if (rows.length !== data.rows.length || !rows.length || centers.length !== rows.length) return undefined;
  const {scale} = options, fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize: options.minFontSize}) * scale;
  const pad = 10 * scale, lineHeight = fontPx * 1.5, header = options.header ?? 0;
  const top = rows[0]!.y, bottom = rows[rows.length - 1]!.y + rows[rows.length - 1]!.height;
  // The plot band the preview leaves (charts.js renderCategoryChart): under the header row, above the value tick labels.
  if (top < box.y + header - 0.5 || bottom > box.y + box.height - (options.hiddenAxis ? 0 : lineHeight) + 0.5 || bottom - top < rows.length * scale) return undefined;
  // The plot's sides as the preview lays them out: the category gutter (its widest label, at most 30% of the chart) and the value labels.
  const labels = data.rows.map(row => row[0] === null || row[0] === undefined ? '' : String(row[0]).replace(/[\r\n]+/g, ' '));
  const gutter = Math.min(box.width * 0.3, Math.max(0, ...labels.map(label => options.measure(label, fontPx))) + fontPx * 0.5);
  const values = data.rows.flatMap(row => row.slice(1).filter((value): value is number => typeof value === 'number').map(String));
  const labelRoom = options.hiddenAxis && options.labels ? Math.max(0, ...values.map(value => options.measure(value, fontPx) + fontPx * 0.5)) : 0;
  const left = pad + gutter + pad / 2, right = pad + fontPx + labelRoom;
  if (box.width - left - right < 4 * scale) return undefined;
  return {top: top - box.y, bottom: bottom - box.y, centers: centers.map(center => center - box.y), left, right};
}
