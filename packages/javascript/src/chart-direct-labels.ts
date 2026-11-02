// LH-105: direct labels instead of legends (Few: a legend makes the eye travel between key and data; a label at the data does not).
//
// Composition decides them with the rest of the chart layer, so the preview (opf-render) and the PPTX export (opf-pptx) draw the same:
//
//   end labels (line)    a line chart of two to four series without data labels names each series at the end of its line, in the
//                        series colour, instead of a legend. The plot leaves a gutter at its end for the names (ChartLayer.plot, which the
//                        PPTX export writes as the plot area's inner manual layout); a name that would touch another moves up or down,
//                        never more than one line from its point. When the names cannot be placed so, the chart keeps its header legend.
//                        The header row keeps only its caption. The PPTX export writes each name as the last point's c:dLbl with
//                        c:showSerName, at the right of the point (the left right to left), moved by a manual layout like the preview.
//   slice labels (pie)   a pie or a one-series doughnut without data labels names each slice at the slice, instead of a side legend:
//                        inside the slice when the name fits there (in the colour that contrasts with the slice), else (a pie only)
//                        outside its end. When an outside name would touch another, leave the chart box or shrink the pie under 30% of
//                        its room, or a doughnut name does not fit its ring, the chart keeps its legend.
//
// An explicit option wins: `legend` (any value) keeps the legend and draws no direct labels, and `dataLabels` (any value) draws the labels
// it asks for. Area charts keep their header legend: PowerPoint has no label position for an area point, so a name at the end of an area
// could not be placed natively where the preview draws it.
import {chartTextSize, stackCategoryValues, type ChartValueAxis} from './chart-axis.js';
import {chartNumber, resolveChartData, type ResolvedChartData} from './chart-data.js';
import {chartHeader, CHART_HEADER_MAX_LEGEND, valueLabel, type ChartEndLabel, type ChartLayer, type ChartLayerGeometry, type ChartLayerSlices, type ChartSliceLabel} from './chart-layer.js';
import {chartPlotInset, type ChartPlotGeometry} from './chart-plot.js';

interface Box { x: number; y: number; width: number; height: number }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const label = (value: unknown): string => value === null || value === undefined ? '' : String(value).replace(/[\r\n]+/g, ' ').trim();
const LINES: Readonly<Record<string, string>> = {line: 'standard', 'line-with-markers': 'standard', 'stacked-line': 'stacked', 'stacked-line-with-markers': 'stacked'};

/** The lengths the preview draws chart text with, for a chart box. */
function metrics(box: Box, scale: number, minFontSize: number | undefined) {
  const fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize}) * scale;
  return {fontPx, pad: 10 * scale, lineHeight: fontPx * 1.5, textHeight: fontPx * 1.22, pt: scale * 4 / 3};
}

/**
 * True when a chart could name its series at the line ends: a line chart of two to four series, no `legend` and no `dataLabels` (a small
 * line chart's default value labels give way to the end labels, which carry the last values: Few's direct labels without the clutter).
 */
function endLabelCandidate(chart: unknown, data: ResolvedChartData, layer: ChartLayer | undefined): chart is Record<string, unknown> {
  if (!record(chart) || !data.ok || data.combo || typeof chart.type !== 'string' || !Object.hasOwn(LINES, chart.type.trim().toLowerCase())) return false;
  const series = data.columns.length - 1, last = data.rows.length - 1;
  if (series < 2 || series > CHART_HEADER_MAX_LEGEND || last < 1) return false;
  if (chart.legend !== undefined || (chart.dataLabels !== undefined && chart.dataLabels !== false) || (layer?.small && !layer.small.labels)) return false;
  // Every series must reach the last category, where the names stand; a series that stops earlier would be named in the middle of the plot.
  return data.columns.slice(1).every((_, j) => chartNumber(data.rows[last]![j + 1]) !== null);
}

/**
 * The names at the line ends for a plot, or undefined when they cannot be placed: each name centred on its series' last point, then the
 * names moved apart (in point order, top to bottom) so no two are closer than one text line, and kept between the plot's top and bottom.
 * `relaxed` places them however far they move (used once the plot is fixed by a shared set); otherwise a name moved more than one line
 * from its point fails, and the chart keeps its legend.
 */
export function placeEndLabels(chart: unknown, data: ResolvedChartData, axis: ChartValueAxis, box: Box, plotInset: {left: number; top: number; right: number; bottom: number}, geometry: Omit<ChartPlotGeometry, 'box'> & {bold?: (text: string, size: number) => number}, relaxed = false, focus?: readonly number[]): ChartEndLabel[] | undefined {
  if (!record(chart) || !data.ok) return undefined;
  const grouping = LINES[String(chart.type).trim().toLowerCase()] ?? 'standard';
  const {fontPx, textHeight, lineHeight, pt} = metrics(box, geometry.scale, geometry.minFontSize);
  const rtl = geometry.direction === 'rtl';
  const plot = {x: box.x + plotInset.left, y: box.y + plotInset.top, width: box.width - plotInset.left - plotInset.right, height: box.height - plotInset.top - plotInset.bottom};
  if (!(plot.width > 1 && plot.height > 1) || !(axis.max > axis.min)) return undefined;
  const count = data.rows.length, last = count - 1, band = plot.width / count;
  const series = data.columns.slice(1).map((name, j) => ({name: label(name), values: data.rows.map(row => chartNumber(row[j + 1]))}));
  const stacks = stackCategoryValues(series, count, 'line', grouping);
  // The last category is the rightmost point (the leftmost right to left: the categories run from the right).
  const x = plot.x + ((rtl ? 0 : last) + 0.5) * band;
  const at = (value: number) => plot.y + (axis.max - Math.min(axis.max, Math.max(axis.min, value))) / (axis.max - axis.min) * plot.height;
  // The gap and label box of the preview's point labels (drawPointLabel: a marker radius and a quarter text size; text plus half a size).
  const gap = 3 * pt + fontPx * 0.25;
  const placed = series.map((entry, j) => {
    const text = endLabelText(data, j), bold = focus?.includes(j) === true;
    return {j, name: entry.name, text, bold, y: at(stacks[j]![last]!.to), width: (bold && geometry.bold ? geometry.bold(text, fontPx) : geometry.measure(text, fontPx)) + fontPx * 0.5};
  });
  const order = [...placed].sort((a, b) => a.y - b.y || a.j - b.j);
  const centres = order.map(entry => entry.y);
  // A name's centre stays between the plot's top (the plot keeps half a line above it) and half a line above its bottom (the category labels).
  const top = plot.y, bottom = plot.y + plot.height - textHeight / 2;
  if ((order.length - 1) * textHeight > bottom - top + 1e-6) return undefined;
  // Push down past the one above, then pull up from the bottom edge, then keep under the top edge.
  for (let index = 0; index < centres.length; index++) centres[index] = Math.max(centres[index]!, index ? centres[index - 1]! + textHeight : top);
  for (let index = centres.length - 1; index >= 0; index--) centres[index] = Math.min(centres[index]!, index === centres.length - 1 ? bottom : centres[index + 1]! - textHeight);
  for (let index = 0; index < centres.length; index++) centres[index] = Math.max(centres[index]!, index ? centres[index - 1]! + textHeight : top);
  if (!relaxed && order.some((entry, index) => Math.abs(centres[index]! - entry.y) > textHeight + 1e-6)) return undefined;
  const entries = order.map((entry, index): ChartEndLabel => ({
    series: entry.j, name: entry.name, text: entry.text, ...(entry.bold ? {bold: true} : {}), row: last, point: {x, y: entry.y},
    box: {x: rtl ? x - gap - entry.width : x + gap, y: centres[index]! - lineHeight / 2, width: entry.width, height: lineHeight},
  }));
  return entries.sort((a, b) => a.series - b.series);
}

/** LH-105: a series' end label: its last value as its data labels print it (the column's format, else General), then its name. */
export function endLabelText(data: ResolvedChartData, series: number): string {
  if (!data.ok) return '';
  const last = data.rows[data.rows.length - 1], value = last ? chartNumber(last[series + 1]) : null, name = label(data.columns[series + 1]);
  const format = typeof data.formats[series + 1] === 'string' && data.formats[series + 1] !== '' ? data.formats[series + 1] : undefined;
  return value === null ? name : `${valueLabel(value, format)} ${name}`;
}

/**
 * LH-105: the chart layer and value axis of a line chart that names its series at the line ends, or undefined when the chart keeps its
 * legend. The header row is laid out again with its caption only; `axisFor(headerHeight)` gives the value axis for the plot under it (the
 * composed axis). The plot is laid out as the preview lays it out (chartPlotInset) with a gutter at its end as wide as the gap and the
 * widest name, and the names are placed against it (placeEndLabels).
 */
export function chartEndLabels(chart: unknown, data: ResolvedChartData, layer: ChartLayer | undefined, geometry: ChartLayerGeometry, axisFor: (headerHeight: number) => ChartValueAxis | undefined): {layer: ChartLayer; valueAxis: ChartValueAxis} | undefined {
  if (!endLabelCandidate(chart, data, layer)) return undefined;
  const {box, scale} = geometry;
  if (![box.width, box.height, scale].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0) return undefined;
  const header = chartHeader(chart, data, geometry, {legend: false});
  const valueAxis = axisFor(header?.height ?? 0);
  if (!valueAxis) return undefined;
  const {fontPx, pt} = metrics(box, scale, geometry.minFontSize);
  const measure = (text: string, size: number) => geometry.measure(text, size, 400), bold = (text: string, size: number) => geometry.measure(text, size, 700);
  const focus = layer?.focus?.series;
  const gutter = 3 * pt + fontPx * 0.25 + Math.max(...data.columns.slice(1).map((_, j) => (focus?.includes(j) ? bold : measure)(endLabelText(data, j), fontPx) + fontPx * 0.5));
  // The small-chart treatment (value labels, no value axis) gives way: the end labels carry the last values and the axis the rest.
  const {header: _header, small: _small, ...rest} = layer ?? {};
  const base: ChartLayer = {...rest, ...(header ? {header} : {})};
  const plotGeometry = {scale, minFontSize: geometry.minFontSize, measure, direction: geometry.direction, language: geometry.language};
  const plot = chartPlotInset(chart, data, {valueAxis, layer: {...base, endLabels: {gutter, entries: []}}}, {...plotGeometry, box});
  if (!plot) return undefined;
  // The gutter narrows the plot; when that turns or thins out the category labels the legend layout keeps level, the legend stays.
  const legendAxis = axisFor(layer?.header?.height ?? 0);
  const legendPlot = legendAxis ? chartPlotInset(chart, data, {valueAxis: legendAxis, layer}, {...plotGeometry, box}) : undefined;
  if (legendPlot && plot.bottom > legendPlot.bottom + 0.5) return undefined;
  const entries = placeEndLabels(chart, data, valueAxis, box, plot, {...plotGeometry, bold}, false, focus);
  return entries ? {layer: {...base, plot, endLabels: {gutter, entries}}, valueAxis} : undefined;
}

/** A composed chart item, as composition hands it to {@link refreshEndLabels}. */
interface ComposedChartItem { value: unknown; box: Box; chart?: {valueAxis?: ChartValueAxis; layer?: ChartLayer} }

/**
 * LH-105 with LH-93: after sibling charts share one plot height (shareSiblingPlots moves a member's plot), the names at a member's line
 * ends are placed again against its new plot; they keep clear of each other however far that moves them.
 */
export function refreshEndLabels(items: readonly ComposedChartItem[], geometryFor: (item: ComposedChartItem) => Omit<ChartPlotGeometry, 'box'>, document?: unknown): void {
  for (const item of items) {
    const layer = item.chart?.layer, axis = item.chart?.valueAxis;
    if (!layer?.endLabels || !layer.plot || !axis) continue;
    const entries = placeEndLabels(item.value, resolveChartData(item.value, document), axis, item.box, layer.plot, geometryFor(item), true, layer.focus?.series);
    if (entries) item.chart!.layer = {...layer, endLabels: {...layer.endLabels, entries}};
  }
}

/** The smallest share of its room a pie keeps when its outside labels take the rest; a smaller pie keeps its legend instead. */
export const CHART_SLICE_LABEL_MIN_RADIUS = 0.3;

/**
 * LH-105: the category labels of a pie or a one-series doughnut (the drawn type), or undefined when the chart keeps its legend. The pie is
 * laid out as the preview lays it out without a legend: in the chart box less its padding, of radius 0.9 x half the shorter side when
 * every name fits inside its slice, else less the room the outside names take (the widest outside name and one line, as
 * `outsideLabelReserve`). A name fits inside when its text box, at the inside end of the slice (a ring's middle on a doughnut), lies
 * within the slice. Slices without a positive value have no label.
 */
export function chartSliceLabels(chart: unknown, data: ResolvedChartData, geometry: ChartLayerGeometry): ChartLayerSlices | undefined {
  if (!record(chart) || !data.ok || typeof chart.type !== 'string' || data.columns.length !== 2 || !data.rows.length) return undefined;
  const type = chart.type.trim().toLowerCase();
  if ((type !== 'pie' && type !== 'doughnut') || chart.legend !== undefined || chart.dataLabels !== undefined) return undefined;
  const {box, scale} = geometry;
  if (![box.width, box.height, scale].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0) return undefined;
  const {fontPx, pad, lineHeight, textHeight} = metrics(box, scale, geometry.minFontSize);
  const values = data.rows.map(row => Math.abs(chartNumber(row[1]) ?? 0)), total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0) || !Number.isFinite(total)) return undefined;
  const area = {x: box.x + pad, y: box.y + pad, width: Math.max(1, box.width - 2 * pad), height: Math.max(1, box.height - 2 * pad)};
  const cx = area.x + area.width / 2, cy = area.y + area.height / 2;
  const slices = data.rows.map((row, i) => {
    const before = values.slice(0, i).reduce((sum, value) => sum + value, 0);
    const start = -Math.PI / 2 + before / total * 2 * Math.PI, delta = values[i]! / total * 2 * Math.PI;
    const text = label(row[0]);
    return {row: i, start, delta, mid: start + delta / 2, text, width: geometry.measure(text, fontPx, 400) + fontPx * 0.5};
  }).filter(slice => slice.delta > 0 && slice.text !== '');
  // The label box the preview centres on its point (labelSize), and the text inside it that must stay within the slice.
  const fits = (slice: (typeof slices)[number], r: number, hole: number): boolean => {
    const cos = Math.cos(slice.mid), sin = Math.sin(slice.mid);
    const half = (slice.width * Math.abs(cos) + lineHeight * Math.abs(sin)) / 2;
    const radius = hole ? (r + hole) / 2 : Math.max(0, r - half - fontPx * 0.25);
    const px = cx + radius * cos, py = cy + radius * sin, w = slice.width - fontPx * 0.25, h = textHeight;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([sx, sy]) => {
      const x = px + sx! * w / 2 - cx, y = py + sy! * h / 2 - cy, distance = Math.hypot(x, y);
      if (distance > r - 1 || distance < hole + 1) return false;
      if (slice.delta >= 2 * Math.PI - 1e-9) return true;
      const angle = ((Math.atan2(y, x) - slice.start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      return angle <= slice.delta;
    });
  };
  const full = Math.min(area.width, area.height) / 2 * 0.9;
  if (type === 'doughnut') return slices.every(slice => fits(slice, full, full * 0.5)) ? {labels: slices.map(slice => ({row: slice.row, position: 'inside'}))} : undefined;
  // A pie: the outside names shrink the pie, which can push more names outside; settle on the set that no longer grows.
  let outside = new Set(slices.filter(slice => !fits(slice, full, 0)).map(slice => slice.row)), r = full;
  for (let pass = 0; pass < 6 && outside.size; pass++) {
    const widest = Math.max(0, ...slices.filter(slice => outside.has(slice.row)).map(slice => slice.width));
    r = Math.max(1, Math.min(area.width / 2 - widest - fontPx * 0.25, area.height / 2 - lineHeight - fontPx * 0.25));
    const next = new Set(slices.filter(slice => outside.has(slice.row) || !fits(slice, r, 0)).map(slice => slice.row));
    if (next.size === outside.size) break;
    outside = next;
  }
  if (outside.size && r < CHART_SLICE_LABEL_MIN_RADIUS * Math.min(area.width, area.height) / 2) return undefined;
  // Outside names sit past the slice's end (drawSliceLabel's outside-end); they must stay in the chart box and clear of each other.
  const rects = slices.filter(slice => outside.has(slice.row)).map(slice => {
    const cos = Math.cos(slice.mid), sin = Math.sin(slice.mid), half = (slice.width * Math.abs(cos) + lineHeight * Math.abs(sin)) / 2;
    const radius = r + half + fontPx * 0.25, x = cx + radius * cos, y = cy + radius * sin;
    return {x: x - slice.width / 2, y: y - textHeight / 2, width: slice.width, height: textHeight};
  });
  if (rects.some(rect => rect.x < box.x - 0.5 || rect.y < box.y - 0.5 || rect.x + rect.width > box.x + box.width + 0.5 || rect.y + rect.height > box.y + box.height + 0.5)) return undefined;
  for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
    const one = rects[a]!, two = rects[b]!;
    if (one.x < two.x + two.width && two.x < one.x + one.width && one.y < two.y + two.height && two.y < one.y + one.height) return undefined;
  }
  return {labels: slices.map((slice): ChartSliceLabel => ({row: slice.row, position: outside.has(slice.row) ? 'outside' : 'inside'}))};
}
