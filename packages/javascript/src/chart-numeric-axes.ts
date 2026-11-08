// RR-105: scatter X/Y and box-and-whisker axes, shared by composition, preview and native PPTX.
import {chartIntervalsFor, chartTextSize, niceScale, type ChartValueAxis} from './chart-axis.js';
import {chartNumber, type ResolvedChartData} from './chart-data.js';
import {chartOptionTarget, resolveChartOptions} from './chart-options.js';
import {groupsDataRange} from './number-grouping.js';
import {valueLabel, type ChartLayerGeometry} from './chart-layer.js';

export interface ChartNumericAxes {
  value: ChartValueAxis;
  /** A scatter chart's horizontal numeric axis (PowerPoint calls it the category axis). */
  category?: ChartValueAxis;
}
const axis = (values: number[], length: number, label: number, scale: number): ChartValueAxis => {
  const fitted = niceScale(values.length ? Math.min(...values) : 0, values.length ? Math.max(...values) : 1, chartIntervalsFor(Math.max(1, length), label, scale));
  return {min: fitted.min, max: fitted.max, majorUnit: fitted.step};
};
const finiteAxis = (value: ChartValueAxis): boolean => [value.min, value.max, value.majorUnit, value.max - value.min].every(Number.isFinite) && value.majorUnit > 0 && value.max > value.min;
const ticks = (value: ChartValueAxis): number[] => Array.from({length: Math.floor((value.max - value.min) / value.majorUnit + 1e-9) + 1}, (_, n) => Number((value.min + n * value.majorUnit).toPrecision(12)));

/** The same chart-text size, padding, legend and axis-title bands the preview reserves. */
export function chartNumericAxes(chart: unknown, data: ResolvedChartData, geometry: ChartLayerGeometry): ChartNumericAxes | undefined {
  if (!chart || typeof chart !== 'object' || !data.ok || data.combo) return undefined;
  const target = chartOptionTarget((chart as {type?: unknown}).type);
  if (target?.kind !== 'scatter' && target?.kind !== 'box') return undefined;
  const {box, scale, language} = geometry;
  const fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize}) * scale;
  const pad = 10 * scale, lineHeight = fontPx * 1.5;
  const measure = (text: string) => geometry.measure(text, fontPx, 400);
  const options = resolveChartOptions(chart, target);
  const first = target.kind === 'scatter' ? data.hasX ? 2 : 1 : data.columns.length > 1 ? 1 : 0;
  const names = data.columns.slice(first).map(String);
  const widthOfLegend = () => Math.min(box.width * .45, fontPx * 1.5 + Math.max(0, ...names.map(measure))) + pad;
  let width = box.width, height = box.height, sideLegend = 0;
  if (options.legend === 'left' || options.legend === 'right') width -= widthOfLegend();
  else if (options.legend === 'top' || options.legend === 'bottom') height -= lineHeight + pad;
  else if (options.legend === undefined && names.length > 1) sideLegend = widthOfLegend();
  if (options.axisTitles.category) height -= lineHeight;
  if (options.axisTitles.value) width -= lineHeight;
  const yValues: number[] = [], xValues: number[] = [];
  data.rows.forEach((row, index) => {
    const x = data.hasX ? chartNumber(row[1]) : index + 1;
    for (let column = first; column < data.columns.length; column++) {
      const y = chartNumber(row[column]);
      if (y === null || (target.kind === 'scatter' && x === null)) continue;
      yValues.push(y);
      if (target.kind === 'scatter') xValues.push(x as number);
    }
  });
  const length = Math.max(1, height - 2 * pad - 1.5 * lineHeight);
  const value = axis(yValues, length, lineHeight * 1.2, scale);
  if (!finiteAxis(value)) return undefined;
  if (target.kind === 'box') return {value};
  const yFormat = data.formats[first], xFormat = data.hasX ? data.formats[1] : undefined;
  const yGroup = yFormat === undefined && groupsDataRange(yValues, {zeroBased: false});
  const xGroup = xFormat === undefined && data.hasX && groupsDataRange(xValues, {zeroBased: false, minRange: 1000});
  const label = (number: number, format: string | undefined, group: boolean) => valueLabel(number, format, group ? {language} : undefined);
  const tickWidth = Math.max(...ticks(value).map(tick => measure(label(tick, yFormat, yGroup)))) + fontPx * .5;
  const minX = xValues.length ? Math.min(...xValues) : 0, maxX = xValues.length ? Math.max(...xValues) : 1;
  const xLabel = Math.max(measure(label(minX, xFormat, xGroup)), measure(label(maxX, xFormat, xGroup))) + fontPx;
  let x = pad + tickWidth, plotWidth = Math.max(1, width - pad - sideLegend - fontPx - x);
  let category = axis(xValues, plotWidth, xLabel, scale);
  if (!finiteAxis(category)) return undefined;
  // Formatted end tick labels stay inside the chart, including long currency codes.
  if (xFormat !== undefined) for (let pass = 0; pass < 3; pass++) {
    const end = ticks(category), left = measure(label(end[0]!, xFormat, false)) / 2, right = measure(label(end.at(-1)!, xFormat, false)) / 2;
    const nextX = Math.max(x, pad + left), nextWidth = Math.max(1, Math.min(x + plotWidth, width - pad - right) - nextX);
    if (nextX === x && nextWidth === plotWidth) break;
    x = nextX; plotWidth = nextWidth; category = axis(xValues, plotWidth, xLabel, scale);
    if (!finiteAxis(category)) return undefined;
  }
  return {value, category};
}
