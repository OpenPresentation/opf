// FR-07 (CR 5): the bullet chart's plot, computed once in core so the preview draws it and the PowerPoint export writes it as the plot area's
// inner layout (native check 2026-11-25: with that layout PowerPoint's bars, bands and ticks sit on the preview's to the hundredth of a point).
import { chartTextSize, type ChartValueAxis } from './chart-axis.js';
import { chartBandRanges, chartBands } from './chart-bands.js';
import type { ResolvedChartData } from './chart-data.js';
import type { ChartPlotInset } from './chart-layer.js';
import { chartOptionTarget, resolveChartOptions } from './chart-options.js';
import { BREAKABLE, type ChartPlotGeometry } from './chart-plot.js';

interface Box { x: number; y: number; width: number; height: number }
const dataLabel = (value: unknown): string => value === null || value === undefined ? '' : String(value);

/**
 * The legend entries of a chart with bands, in the order both engines list them: the labeled bands first (PowerPoint lists the band group, which
 * it draws first, before the data, whatever the file says), then the plotted series. A bullet chart lists its measure only.
 */
export function bandLegendNames(chart: unknown, data: ResolvedChartData, axis: { min: number; max: number } | undefined): string[] {
  if (!data.ok) return [];
  const bands = axis ? chartBandRanges(chartBands(chart), axis).flatMap((band) => band.label === undefined ? [] : [band.label]) : [];
  const bullet = typeof chart === 'object' && chart !== null && (chart as { type?: unknown }).type === 'bullet';
  return [...bands, ...data.columns.slice(1, bullet ? 2 : undefined).map(dataLabel)];
}

/**
 * The plot of a bullet chart as an inset from its chart box (slide pixels), as the preview lays it out: an explicit legend carved from its edge,
 * axis titles (category at the start, value under the plot), the category names in a gutter at the start (the end, right to left) of up to 30% of
 * the box (40% for a long word), the value axis labels in one line under the plot. Undefined for any other chart.
 */
export function bulletPlot(chart: unknown, data: ResolvedChartData, axis: ChartValueAxis | undefined, box: Box, geometry: Omit<ChartPlotGeometry, 'box'>): ChartPlotInset | undefined {
  if (!data.ok || typeof chart !== 'object' || chart === null || (chart as { type?: unknown }).type !== 'bullet' || !data.rows.length) return undefined;
  const { scale } = geometry;
  if (![box.width, box.height, scale].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0) return undefined;
  const fontPx = chartTextSize({ width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize }) * scale;
  const pad = 10 * scale, lineHeight = fontPx * 1.5, rtl = geometry.direction === 'rtl';
  const measure = (text: string) => geometry.measure(text, fontPx);
  let inner = { ...box };
  const options = resolveChartOptions(chart, chartOptionTarget('bullet'));
  // The legend (charts.js placeLegend): its entries in rows at the top or bottom, or a column at a side.
  const names = options.legend && options.legend !== 'none' ? bandLegendNames(chart, data, axis) : [];
  if (names.length) {
    const swatch = fontPx * 0.6, gap = fontPx * 0.4;
    if (options.legend === 'left' || options.legend === 'right') {
      const width = Math.min(inner.width * 0.45, swatch + gap + Math.max(...names.map(measure)) + fontPx * 0.5), reserve = width + pad;
      inner = { ...inner, x: options.legend === 'left' ? inner.x + reserve : inner.x, width: Math.max(1, inner.width - reserve) };
    } else {
      const available = Math.max(1, inner.width - 2 * pad), spacing = fontPx * 0.8;
      let rows = 0, used = Infinity;
      for (const name of names) {
        const width = Math.min(available, swatch + gap + measure(name) + spacing);
        if (used + width <= available + 0.01) used += width; else { rows++; used = width; }
      }
      const reserve = rows * lineHeight + pad;
      inner = { ...inner, y: options.legend === 'top' ? inner.y + reserve : inner.y, height: Math.max(1, inner.height - reserve) };
    }
  }
  // Axis titles (chart-options.js reserveAxisTitles): the category title in a band at the left, the value title in one under the plot.
  if (options.axisTitles.category) inner = { ...inner, x: inner.x + lineHeight, width: Math.max(1, inner.width - lineHeight) };
  if (options.axisTitles.value) inner = { ...inner, height: Math.max(1, inner.height - lineHeight) };
  const flat = (name: string) => name.replace(/[\r\n]+/g, ' ');
  const categories = data.rows.map((row) => flat(dataLabel(row[0])));
  const longestWord = Math.max(0, ...categories.flatMap((name) => name.split(BREAKABLE).map(measure))) + fontPx * 0.5;
  const categoryWidth = Math.min(Math.max(inner.width * 0.3, Math.min(inner.width * 0.4, longestWord)), Math.max(0, ...categories.map(measure)) + fontPx * 0.5);
  const top = inner.y + pad + lineHeight / 2, bottom = inner.y + inner.height - pad - lineHeight;
  const x = rtl ? inner.x + pad + fontPx : inner.x + pad + categoryWidth + pad / 2;
  const right = rtl ? inner.x + inner.width - pad - categoryWidth - pad / 2 : inner.x + inner.width - pad - fontPx;
  const width = Math.max(1, right - x), height = Math.max(1, bottom - top);
  return { left: x - box.x, top: top - box.y, right: box.x + box.width - (x + width), bottom: box.y + box.height - (top + height) };
}
