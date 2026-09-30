// Chart previews for the OPF chart type catalog (FF-22).
//
// The core catalog keeps one chart type per Office chart construct and
// deprecates the rest with a replacement id (`deprecation.replacedBy`,
// `mappings.openxml`). The tables below are carried here so the preview stays
// synchronous and self-contained; test/chart-catalog.mjs checks them against
// the installed core catalog. Kept ids render the construct PowerPoint shows
// for the exported chart; deprecated ids render exactly like their replacement;
// any other id returns null so the caller keeps its legacy single-series preview.
import { chartColorForFill, resolveTextStyle, textColorForFill, textWidthMeasurer } from "@openpresentation/opf/composition";

// Ordered series palette written by opf-pptx (`CHART_COLORS`), before the same
// per-surface contrast adjustment (`chartColorForFill`).
export const CHART_SERIES_COLORS = Object.freeze([
  "#2874A6", "#1B4F72", "#5499C7", "#7BDBB2", "#3AC67A", "#24A89E",
  "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6", "#0F172A", "#64748B"
]);

const bar = (dir, grouping) => ({ kind: "bar", dir, grouping });
const line = (grouping, markers) => ({ kind: "line", grouping, markers });
const area = (grouping) => ({ kind: "area", grouping });
const radar = (style) => ({ kind: "radar", style, markers: style === "marker" });

export const CHART_TYPES = Object.freeze({
  column: bar("col", "clustered"),
  "stacked-column-3x": bar("col", "stacked"),
  "100pct-stacked-column-3x": bar("col", "percentStacked"),
  bar: bar("bar", "clustered"),
  "stacked-bar-3x": bar("bar", "stacked"),
  "100pct-stacked-bar-3x": bar("bar", "percentStacked"),
  line: line("standard", false),
  "line-with-markers": line("standard", true),
  "stacked-line-3x": line("stacked", false),
  "stacked-line-with-markers-3x": line("stacked", true),
  area: area("standard"),
  "stacked-area-3x": area("stacked"),
  "100pct-stacked-area-3x": area("percentStacked"),
  pie: { kind: "pie" },
  doughnut: { kind: "doughnut" },
  scatter: { kind: "scatter" },
  radar: radar("standard"),
  "radar-with-markers": radar("marker"),
  "filled-radar": radar("filled"),
  treemap: { kind: "treemap" },
  histogram: { kind: "histogram" },
  pareto: { kind: "pareto" },
  "box-and-whisker": { kind: "box" },
  waterfall: { kind: "waterfall" },
  funnel: { kind: "funnel" },
  world: { kind: "map" }
});

const variants = (base, target) => Object.fromEntries([base, `${base}-2x`, `${base}-3x`].map((id) => [id, target]));
const suffixes = (base, target) => Object.fromEntries(["", "-2x", "-3x", "-4x", "-5x", "-6x"].map((suffix) => [`${base}${suffix}`, target]));

// Deprecated core ids -> kept replacement (core spec/catalogs/chart-types `deprecation.replacedBy`).
export const DEPRECATED_CHART_TYPES = Object.freeze({
  ...variants("100pct-bullet-bar", "100pct-stacked-bar-3x"),
  "100pct-progress-bar": "100pct-stacked-bar-3x",
  "100pct-stacked-bar-2x": "100pct-stacked-bar-3x",
  ...variants("100pct-bullet-column", "100pct-stacked-column-3x"),
  "100pct-stacked-column-2x": "100pct-stacked-column-3x",
  "100pct-stacked-area-2x": "100pct-stacked-area-3x",
  australia: "world",
  canada: "world",
  "united-kingdom": "world",
  "united-states": "world",
  "box-and-whisker-2x": "box-and-whisker",
  "box-and-whisker-3x": "box-and-whisker",
  ...variants("bullet-bar", "bar"),
  "clustered-bar-2x": "bar",
  ...variants("bullet-column", "column"),
  "clustered-column": "column",
  ...suffixes("dot-plot", "scatter"),
  dumbbell: "scatter",
  "line-2x": "line",
  "line-3x": "line",
  "line-with-high-low": "line",
  ...suffixes("sparkline", "line"),
  "line-with-high-low-and-markers": "line-with-markers",
  "line-with-markers-2x": "line-with-markers",
  "line-with-markers-3x": "line-with-markers",
  "stacked-area-2x": "stacked-area-3x",
  "stacked-bar-2x": "stacked-bar-3x",
  "stacked-column-2x": "stacked-column-3x",
  "stacked-line-2x": "stacked-line-3x",
  "stacked-line-with-markers-2x": "stacked-line-with-markers-3x",
  "treemap-2x": "treemap",
  "treemap-3x": "treemap"
});

const ALIASES = Object.freeze({ donut: "doughnut" });

/** Resolve a chart type id to its kept catalog id, or null for ids outside the catalog. */
export function resolveChartType(type) {
  const raw = String(type ?? "").trim().toLowerCase();
  const id = ALIASES[raw] ?? DEPRECATED_CHART_TYPES[raw] ?? raw;
  return Object.hasOwn(CHART_TYPES, id) ? id : null;
}

const RENDERERS = {
  bar: renderCategoryChart,
  line: renderCategoryChart,
  area: renderCategoryChart,
  pie: renderCircularChart,
  doughnut: renderCircularChart,
  scatter: renderScatterChart,
  radar: renderRadarChart,
  // Chartex constructs (opf-pptx writes them as cx:chartSpace parts, FF-22b).
  treemap: renderTreemapChart,
  histogram: renderHistogramChart,
  pareto: renderHistogramChart,
  box: renderBoxWhiskerChart,
  waterfall: renderWaterfallChart,
  funnel: renderFunnelChart,
  map: renderRegionMapChart
};

// Chartex constructs also accept a lone value column (the exporter plots it
// against row numbers, or bins it for histogram and pareto).
const CHARTEX_KINDS = new Set(["treemap", "histogram", "pareto", "box", "waterfall", "funnel", "map"]);

/**
 * Render a catalog chart. Returns null when the id is outside the catalog, has
 * no preview renderer, or carries no inline category-major data, so the caller
 * can keep its legacy output ("No chart data" for unresolved sources).
 */
export function renderCatalogChart(item, box, bound, options, svg) {
  const id = resolveChartType(item.value?.type);
  const spec = id && CHART_TYPES[id];
  const render = spec && RENDERERS[spec.kind];
  const data = item.value?.data;
  const rows = Array.isArray(data?.rows) ? data.rows.map((row) => Array.isArray(row) ? row : [row]) : [];
  const columns = Array.isArray(data?.columns) ? data.columns : [];
  if (!render || !rows.length || columns.length < (CHARTEX_KINDS.has(spec.kind) ? 1 : 2)) return null;
  const c = chartContext(item, box, bound, options, svg, rows, columns);
  c.mark("rect", { x: box.x, y: box.y, width: box.width, height: box.height, fill: c.surface, stroke: bound.design.colors.border, "stroke-width": 1 }, item.path);
  render(c, spec);
  return svg.tag("g", { ...svg.traceAttrs(options, item.path), "data-opf-chart": options.trace ? id : undefined }, c.children.join("\n"));
}

function chartContext(item, box, bound, options, svg, rows, columns) {
  const u = Math.min(bound.design.dimensions.width, bound.design.dimensions.height) / 720;
  const composition = bound.composition ?? bound.geometry.composition ?? {};
  const requested = 14, fontPx = Math.max(requested, composition.minFontSize ?? 16) * u;
  const surface = bound.design.colors.surface;
  const labelColor = textColorForFill(surface, bound.design.colors.text);
  const style = resolveTextStyle({ fontFamily: bound.design.fonts.body, fontWeight: 400, italic: false, path: item.path }, options.textMeasurement);
  const measure = textWidthMeasurer(style, options.textMeasurement);
  const children = [];
  const n = svg.stableNumber;
  const numericAttrs = new Set(["x", "y", "width", "height", "cx", "cy", "r", "x1", "x2", "y1", "y2", "stroke-width"]);
  const c = {
    item, box, bound, options, svg, rows, columns, children, u, fontPx, surface, labelColor,
    path: item.path,
    pt: u * 4 / 3,
    pad: 10 * u,
    lineHeight: fontPx * 1.5,
    colors: CHART_SERIES_COLORS.map((color) => chartColorForFill(surface, color)),
    gridColor: bound.design.colors.border,
    axisColor: "#888888",
    number: chartNumber,
    label: (value) => value === null || value === undefined ? "" : String(value),
    width: (value) => measure(String(value), fontPx),
    num: n,
    mark(name, attrs, path) {
      const out = {};
      for (const [key, value] of Object.entries(attrs)) out[key] = numericAttrs.has(key) && typeof value === "number" ? n(value) : value;
      children.push(svg.tag(name, { ...out, ...(path ? svg.traceAttrs(options, path) : {}) }));
    },
    text(value, rect, path, align = "center") {
      if (!(rect.width > 0 && rect.height > 0)) return;
      children.push(svg.renderTextBox(String(value), rect, bound, {
        path, fontSize: requested, fontFamily: bound.design.fonts.body, fontWeight: 400,
        fill: labelColor, options, align, verticalAlign: "middle"
      }));
    },
    series(first = 1) {
      return columns.slice(first).map((name, offset) => ({
        name: c.label(name), column: first + offset, index: offset,
        values: rows.map((row) => chartNumber(row[first + offset]))
      }));
    }
  };
  return c;
}

export function chartNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared axis and legend helpers

/**
 * Office-like automatic value axis: include zero unless every value sits in
 * the top sixth of the range, add 5% headroom, then choose the smallest
 * 1/2/5 x 10^k major unit that fits `maxIntervals`.
 */
export function niceScale(dataMin, dataMax, maxIntervals = 10, { percent = false } = {}) {
  const limit = Number.isFinite(maxIntervals) ? Math.max(1, Math.floor(maxIntervals)) : 10;
  if (percent) {
    const min = dataMin < -1e-9 ? -1 : 0, max = dataMax > 1e-9 || min === 0 ? 1 : 0;
    return scaleFrom(min, max, pickStep(min, max, limit, [0.1, 0.2, 0.25, 0.5, 1]));
  }
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) { dataMin = 0; dataMax = 1; }
  let lo = Math.min(dataMin, 0), hi = Math.max(dataMax, 0);
  if (dataMin > 0 && dataMax - dataMin < dataMax / 6) lo = dataMin;
  if (dataMax < 0 && dataMax - dataMin < -dataMin / 6) hi = dataMax;
  if (hi === lo) {
    if (hi === 0) hi = 1;
    else if (hi > 0) lo = 0;
    else hi = 0;
  }
  const span = hi - lo;
  const top = hi > 0 ? hi + span / 20 : hi;
  const bottom = lo < 0 ? lo - span / 20 : lo > 0 ? Math.max(0, lo - span / 20) : lo;
  const raw = (top - bottom) / limit;
  if (!(raw > 0) || !Number.isFinite(raw)) return normalizedScale(dataMin, dataMax, limit);
  let exponent = Math.floor(Math.log10(raw)) - 1;
  for (; exponent <= 308; exponent++) {
    for (const mantissa of [1, 2, 5]) {
      const step = mantissa * 10 ** exponent;
      if (!(step > 0) || !Number.isFinite(step)) continue;
      const min = Math.floor(bottom / step + 1e-9) * step, max = Math.ceil(top / step - 1e-9) * step;
      if (Number.isFinite(min) && Number.isFinite(max) && Math.round((max - min) / step) <= limit) return scaleFrom(clean(min), clean(max), step);
    }
  }
  return normalizedScale(dataMin, dataMax, limit);
}

// Work in representable units when headroom or a tick step exceeds Number's
// range. Only axis bounds/ticks saturate at the representable endpoints; data
// values keep their actual positions. Subnormal rounding may merge ticks.
function normalizedScale(dataMin, dataMax, limit) {
  const magnitude = Math.max(Math.abs(dataMin), Math.abs(dataMax));
  const unit = 10 ** Math.floor(Math.log10(magnitude)) || Number.MIN_VALUE;
  const normalized = niceScale(dataMin / unit, dataMax / unit, limit);
  const restore = (value) => {
    const scaled = value * unit;
    return Number.isFinite(scaled) ? scaled : Math.sign(value) * Number.MAX_VALUE;
  };
  const min = Math.min(restore(normalized.min), dataMin);
  const max = Math.max(restore(normalized.max), dataMax);
  const ticks = [...new Set([min, ...normalized.ticks.map(restore), max])].sort((a, b) => a - b);
  return { min, max, step: restore(normalized.step) || Number.MIN_VALUE, ticks };
}

// Keep ordinary arithmetic unchanged. A range spanning both finite endpoints
// can overflow even though every value/bound is finite; divide before subtracting.
function axisFraction(value, scale, reverse = false) {
  const range = scale.max - scale.min;
  const distance = reverse ? scale.max - value : value - scale.min;
  if (Number.isFinite(range) && Number.isFinite(distance)) return distance / (range || 1);
  const unit = Math.max(Math.abs(scale.min), Math.abs(scale.max));
  const min = scale.min / unit, max = scale.max / unit, position = value / unit;
  return (reverse ? max - position : position - min) / (max - min);
}

function pickStep(min, max, limit, steps) {
  return steps.find((step) => Math.round((max - min) / step) <= limit) ?? max - min;
}

function scaleFrom(min, max, step) {
  const ticks = [];
  const count = Math.round((max - min) / step);
  for (let index = 0; index <= count; index++) ticks.push(clean(min + index * step));
  return { min, max, step, ticks };
}

function clean(value) {
  const rounded = Number(value.toPrecision(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Office General / 0% tick labels. */
export function formatTick(value, percent = false) {
  if (percent) return `${clean(value * 100)}%`;
  return String(clean(value));
}

function legendEntries(c, entries) {
  // PowerPoint places the exported legend on the right (PptxGenJS legendPos r).
  if (!entries.length) return 0;
  const swatch = c.fontPx * 0.6, gap = c.fontPx * 0.4, keyWidth = entries.some((entry) => entry.key === "line") ? c.fontPx * 1.4 : swatch;
  const textWidth = Math.max(...entries.map((entry) => c.width(entry.name)));
  const width = Math.min(c.box.width * 0.45, keyWidth + gap + textWidth + c.fontPx * 0.5);
  const rowHeight = Math.min(c.lineHeight, (c.box.height - 2 * c.pad) / entries.length);
  const x = c.box.x + c.box.width - c.pad - width;
  let y = c.box.y + Math.max(c.pad, (c.box.height - rowHeight * entries.length) / 2);
  for (const entry of entries) {
    const middle = y + rowHeight / 2;
    // Legend keys follow the series format: a line (with marker) for line/radar
    // series, a marker for scatter series, a filled square otherwise.
    if (entry.key === "line") c.mark("polyline", { points: `${c.num(x)},${c.num(middle)} ${c.num(x + keyWidth)},${c.num(middle)}`, fill: "none", stroke: entry.color, "stroke-width": 2 * c.pt }, entry.path);
    if (entry.key === "marker" || (entry.key === "line" && entry.marker)) c.mark("circle", { cx: x + keyWidth / 2, cy: middle, r: 3 * c.pt, fill: entry.color, stroke: entry.color, "stroke-width": 0.75 * c.pt }, entry.path);
    if (!entry.key) c.mark("rect", { x, y: middle - swatch / 2, width: swatch, height: swatch, fill: entry.color }, entry.path);
    c.text(entry.name, { x: x + keyWidth + gap, y, width: Math.max(1, width - keyWidth - gap), height: rowHeight }, entry.path, "left");
    y += rowHeight;
  }
  return width + c.pad;
}

function seriesLegend(c, series, key, marker = false) {
  return series.length > 1
    ? legendEntries(c, series.map((s) => ({ name: s.name, color: c.colors[s.index % c.colors.length], path: `${c.path}.data.columns.${s.column}`, key, marker })))
    : 0;
}

function gridline(c, x1, y1, x2, y2) {
  c.mark("line", { x1, y1, x2, y2, stroke: c.gridColor, "stroke-opacity": 0.7, "stroke-width": c.pt });
}

function axisLine(c, x1, y1, x2, y2) {
  c.mark("line", { x1, y1, x2, y2, stroke: c.axisColor, "stroke-width": c.pt });
}

function maxIntervalsFor(length, labelExtent) {
  return Math.max(1, Math.min(10, Math.floor(length / Math.max(1, labelExtent))));
}

// ---------------------------------------------------------------------------
// Category charts: column, bar, line and area (standard, stacked, 100%).

/**
 * Plotted extents per series point. Bars stack positive and negative values
 * separately; lines and areas accumulate the signed sum. 100% groupings divide
 * by the category's sum of absolute values first.
 */
export function stackCategoryValues(series, count, kind, grouping, path = "chart") {
  const percent = grouping === "percentStacked";
  const stacked = grouping === "stacked" || percent;
  const totals = Array.from({ length: count }, (_, i) => series.reduce((sum, s) => sum + Math.abs(s.values[i] ?? 0), 0));
  if (percent && totals.some((total) => !Number.isFinite(total))) throw chartAggregateError(path, "percentage total");
  const positive = new Array(count).fill(0), negative = new Array(count).fill(0), running = new Array(count).fill(0);
  return series.map((s) => s.values.map((raw, i) => {
    if (raw === null && kind !== "area") return null;
    let value = raw ?? 0;
    if (percent) value = totals[i] ? value / totals[i] : 0;
    if (!stacked) return { value, from: 0, to: value };
    if (kind === "bar") {
      const base = value >= 0 ? positive : negative;
      const from = base[i];
      base[i] += value;
      if (!Number.isFinite(base[i])) throw chartAggregateError(path, "stacked total");
      return { value, from, to: base[i] };
    }
    const from = running[i];
    running[i] += value;
    if (!Number.isFinite(running[i])) throw chartAggregateError(path, "stacked total");
    return { value, from, to: running[i] };
  }));
}

function chartAggregateError(path, aggregate) {
  return new RangeError(`Cannot render ${path}: ${aggregate} exceeds the finite numeric range. Rescale the chart values before rendering.`);
}

function renderCategoryChart(c, spec) {
  const { box, pad, fontPx } = c;
  const horizontal = spec.kind === "bar" && spec.dir === "bar";
  const percent = spec.grouping === "percentStacked";
  const series = c.series();
  const categories = c.rows.map((row) => c.label(row[0]));
  const count = categories.length;
  const stacks = stackCategoryValues(series, count, spec.kind, spec.grouping, c.path);
  // The scale follows the plotted values. Only stacked bars and areas plot from a
  // base (the running total below them); an unstacked series has a synthetic zero
  // `from`, which must not force zero onto the axis, and a line plots `to` alone.
  const stackedGrouping = spec.grouping === "stacked" || percent;
  const extents = stacks.flat().filter(Boolean).flatMap((point) => spec.kind === "line" || !stackedGrouping ? [point.to] : [point.from, point.to]);
  const dataMin = extents.length ? Math.min(...extents) : 0, dataMax = extents.length ? Math.max(...extents) : 1;
  const legendWidth = seriesLegend(c, series, spec.kind === "line" ? "line" : undefined, spec.markers);
  const right = box.x + box.width - pad - legendWidth;
  const top = box.y + pad + c.lineHeight / 2;
  let plot, scale;
  if (horizontal) {
    const categoryWidth = Math.min(box.width * 0.3, Math.max(0, ...categories.map(c.width)) + fontPx * 0.5);
    const x = box.x + pad + categoryWidth + c.pad / 2;
    const bottom = box.y + box.height - pad - c.lineHeight;
    const width = Math.max(1, right - x - fontPx);
    const tickWidth = Math.max(c.width(formatTick(dataMax, percent)), c.width(formatTick(dataMin, percent)), c.width("100%")) + fontPx;
    scale = niceScale(dataMin, dataMax, maxIntervalsFor(width, tickWidth), { percent });
    plot = { x, y: top, width, height: Math.max(1, bottom - top) };
    categories.forEach((name, i) => {
      const band = plot.height / count;
      c.text(name, { x: box.x + pad, y: plot.y + plot.height - (i + 1) * band, width: categoryWidth, height: band }, `${c.path}.data.rows.${i}.0`, "right");
    });
  } else {
    const bottom = box.y + box.height - pad - c.lineHeight;
    const height = Math.max(1, bottom - top);
    scale = niceScale(dataMin, dataMax, maxIntervalsFor(height, c.lineHeight * 1.2), { percent });
    const tickWidth = Math.max(...scale.ticks.map((tick) => c.width(formatTick(tick, percent)))) + fontPx * 0.5;
    const x = box.x + pad + tickWidth;
    plot = { x, y: top, width: Math.max(1, right - x - fontPx / 2), height };
    const band = plot.width / count;
    categories.forEach((name, i) => c.text(name, { x: plot.x + i * band, y: plot.y + plot.height, width: band, height: c.lineHeight }, `${c.path}.data.rows.${i}.0`));
  }
  const at = (value) => horizontal ? plot.x + axisFraction(value, scale) * plot.width : plot.y + axisFraction(value, scale, true) * plot.height;
  // Category axis crosses at zero when zero is on the axis (autoZero).
  const crossing = at(Math.min(scale.max, Math.max(scale.min, 0)));
  for (const tick of scale.ticks) {
    const position = at(tick), label = formatTick(tick, percent);
    if (horizontal) {
      gridline(c, position, plot.y, position, plot.y + plot.height);
      const width = c.width(label) + fontPx;
      c.text(label, { x: position - width / 2, y: plot.y + plot.height, width, height: c.lineHeight }, c.path);
    } else {
      gridline(c, plot.x, position, plot.x + plot.width, position);
      c.text(label, { x: box.x + pad, y: position - c.lineHeight / 2, width: plot.x - box.x - pad - fontPx * 0.35, height: c.lineHeight }, c.path, "right");
    }
  }
  const band = (horizontal ? plot.height : plot.width) / count;
  if (spec.kind === "bar") drawBars(c, spec, series, stacks, { plot, band, at, horizontal, scale });
  else if (spec.kind === "line") drawLines(c, spec, series, stacks, { plot, band, at });
  else drawAreas(c, series, stacks, { plot, band, at, crossing });
  if (horizontal) {
    axisLine(c, crossing, plot.y, crossing, plot.y + plot.height);
    axisLine(c, plot.x, plot.y + plot.height, plot.x + plot.width, plot.y + plot.height);
  } else {
    axisLine(c, plot.x, plot.y, plot.x, plot.y + plot.height);
    axisLine(c, plot.x, crossing, plot.x + plot.width, crossing);
  }
}

// PptxGenJS gap widths: clustered 150%, stacked 50% (overlap 100).
export function barGeometry(band, seriesCount, grouping) {
  if (grouping === "clustered") {
    const group = band / 2.5;
    return { group, width: group / seriesCount, offset: (band - group) / 2, clustered: true };
  }
  const width = band / 1.5;
  return { group: width, width, offset: (band - width) / 2, clustered: false };
}

function drawBars(c, spec, series, stacks, { plot, band, at, horizontal, scale }) {
  // Bars grow from zero, or from the axis minimum (maximum, for all-negative data) when zero is off the axis.
  const base = (value) => Math.min(scale.max, Math.max(scale.min, value));
  const geometry = barGeometry(band, series.length, spec.grouping);
  series.forEach((s, j) => {
    const color = c.colors[j % c.colors.length];
    stacks[j].forEach((point, i) => {
      if (!point) return;
      const slot = geometry.clustered ? j * geometry.width : 0;
      const a = at(base(point.from)), b = at(point.to);
      const path = `${c.path}.data.rows.${i}.${s.column}`;
      if (horizontal) {
        // Office bar charts draw the first category and first series nearest the origin (bottom).
        const y = plot.y + plot.height - i * band - geometry.offset - slot - geometry.width;
        c.mark("rect", { x: Math.min(a, b), y, width: Math.abs(b - a), height: geometry.width, fill: color }, path);
      } else {
        const x = plot.x + i * band + geometry.offset + slot;
        c.mark("rect", { x, y: Math.min(a, b), width: geometry.width, height: Math.abs(b - a), fill: color }, path);
      }
    });
  });
}

function drawLines(c, spec, series, stacks, { plot, band, at }) {
  const radius = 3 * c.pt;
  series.forEach((s, j) => {
    const color = c.colors[j % c.colors.length];
    let run = [];
    const flush = () => {
      if (run.length > 1) c.mark("polyline", { points: run.map(([x, y]) => `${c.num(x)},${c.num(y)}`).join(" "), fill: "none", stroke: color, "stroke-width": 2 * c.pt, "stroke-linejoin": "round", "stroke-linecap": "round" }, `${c.path}.data.columns.${s.column}`);
      run = [];
    };
    stacks[j].forEach((point, i) => {
      if (!point) { flush(); return; }
      run.push([plot.x + (i + 0.5) * band, at(point.to)]);
    });
    flush();
    if (spec.markers) stacks[j].forEach((point, i) => {
      if (point) c.mark("circle", { cx: plot.x + (i + 0.5) * band, cy: at(point.to), r: radius, fill: color, stroke: color, "stroke-width": 0.75 * c.pt }, `${c.path}.data.rows.${i}.${s.column}`);
    });
  });
}

function drawAreas(c, series, stacks, { plot, band, at, crossing }) {
  series.forEach((s, j) => {
    const points = stacks[j].map((point, i) => ({ x: plot.x + (i + 0.5) * band, from: point.from, to: point.to }));
    const upper = points.map((p) => `${c.num(p.x)} ${c.num(at(p.to))}`);
    const lower = points.slice().reverse().map((p) => `${c.num(p.x)} ${c.num(p.from === 0 ? crossing : at(p.from))}`);
    c.mark("path", { d: `M ${upper.join(" L ")} L ${lower.join(" L ")} Z`, fill: c.colors[j % c.colors.length] }, `${c.path}.data.columns.${s.column}`);
  });
}

// ---------------------------------------------------------------------------
// Pie and doughnut: first series only, clockwise from 12 o'clock, one colour per category.

function renderCircularChart(c, spec) {
  const { box, pad } = c;
  const categories = c.rows.map((row) => c.label(row[0]));
  const values = c.rows.map((row) => Math.abs(chartNumber(row[1]) ?? 0));
  const legendWidth = legendEntries(c, categories.map((name, i) => ({
    name, color: c.colors[i % c.colors.length], path: `${c.path}.data.rows.${i}.0`
  })));
  const area = { x: box.x + pad, y: box.y + pad, width: Math.max(1, box.width - 2 * pad - legendWidth), height: Math.max(1, box.height - 2 * pad) };
  const cx = area.x + area.width / 2, cy = area.y + area.height / 2;
  const r = Math.max(1, Math.min(area.width, area.height) / 2 * 0.9);
  const inner = spec.kind === "doughnut" ? r * 0.5 : 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total)) throw chartAggregateError(c.path, "slice total");
  if (!total) {
    c.text("No positive chart values", area, c.path);
    return;
  }
  const border = { stroke: "#F9F9F9", "stroke-width": 0.75 * c.pt };
  let angle = -Math.PI / 2;
  values.forEach((value, i) => {
    const delta = value / total * Math.PI * 2, end = angle + delta;
    const fill = c.colors[i % c.colors.length], path = `${c.path}.data.rows.${i}.1`;
    if (delta >= Math.PI * 2 - 1e-9) {
      if (inner) c.mark("path", { d: `${circlePath(c, cx, cy, r)} ${circlePath(c, cx, cy, inner)}`, fill, "fill-rule": "evenodd", ...border }, path);
      else c.mark("circle", { cx, cy, r, fill, ...border }, path);
    } else if (delta > 0) {
      c.mark("path", { d: slicePath(c, cx, cy, r, inner, angle, end), fill, ...border }, path);
    }
    angle = end;
  });
}

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function circlePath(c, cx, cy, r) {
  const n = c.num;
  return `M ${n(cx - r)} ${n(cy)} A ${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)} A ${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)} Z`;
}

function slicePath(c, cx, cy, r, inner, start, end) {
  const n = c.num, large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r, start), [x2, y2] = polar(cx, cy, r, end);
  if (!inner) return `M ${n(cx)} ${n(cy)} L ${n(x1)} ${n(y1)} A ${n(r)} ${n(r)} 0 ${large} 1 ${n(x2)} ${n(y2)} Z`;
  const [x3, y3] = polar(cx, cy, inner, end), [x4, y4] = polar(cx, cy, inner, start);
  return `M ${n(x1)} ${n(y1)} A ${n(r)} ${n(r)} 0 ${large} 1 ${n(x2)} ${n(y2)} L ${n(x3)} ${n(y3)} A ${n(inner)} ${n(inner)} 0 ${large} 0 ${n(x4)} ${n(y4)} Z`;
}

// ---------------------------------------------------------------------------
// Scatter: X from columns[1], Y series from columns[2..], markers only.

export function scatterSeries(rows, columns) {
  const numericX = columns.length > 2;
  const xs = rows.map((row, i) => numericX ? chartNumber(row[1]) : i + 1);
  const first = numericX ? 2 : 1;
  const series = columns.slice(first).map((name, offset) => ({
    name: name === null || name === undefined ? "" : String(name), column: first + offset, index: offset,
    points: rows.map((row, i) => ({ row: i, x: xs[i], y: chartNumber(row[first + offset]) })).filter((p) => p.x !== null && p.y !== null)
  }));
  return { series, xs };
}

function renderScatterChart(c) {
  const { box, pad, fontPx } = c;
  const { series } = scatterSeries(c.rows, c.columns);
  const points = series.flatMap((s) => s.points);
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const legendWidth = seriesLegend(c, series, "marker");
  const top = box.y + pad + c.lineHeight / 2, bottom = box.y + box.height - pad - c.lineHeight;
  const height = Math.max(1, bottom - top);
  const yScale = niceScale(ys.length ? Math.min(...ys) : 0, ys.length ? Math.max(...ys) : 1, maxIntervalsFor(height, c.lineHeight * 1.2));
  const tickWidth = Math.max(...yScale.ticks.map((tick) => c.width(formatTick(tick)))) + fontPx * 0.5;
  const plot = { x: box.x + pad + tickWidth, y: top, height };
  plot.width = Math.max(1, box.x + box.width - pad - legendWidth - fontPx - plot.x);
  const xLabelWidth = Math.max(c.width(formatTick(xs.length ? Math.max(...xs) : 1)), c.width(formatTick(xs.length ? Math.min(...xs) : 0))) + fontPx;
  const xScale = niceScale(xs.length ? Math.min(...xs) : 0, xs.length ? Math.max(...xs) : 1, maxIntervalsFor(plot.width, xLabelWidth));
  const xAt = (v) => plot.x + axisFraction(v, xScale) * plot.width;
  const yAt = (v) => plot.y + axisFraction(v, yScale, true) * plot.height;
  for (const tick of yScale.ticks) {
    const y = yAt(tick);
    gridline(c, plot.x, y, plot.x + plot.width, y);
    c.text(formatTick(tick), { x: box.x + pad, y: y - c.lineHeight / 2, width: plot.x - box.x - pad - fontPx * 0.35, height: c.lineHeight }, c.path, "right");
  }
  for (const tick of xScale.ticks) {
    const label = formatTick(tick), width = c.width(label) + fontPx;
    c.text(label, { x: xAt(tick) - width / 2, y: plot.y + plot.height, width, height: c.lineHeight }, c.path);
  }
  const yCross = yAt(Math.min(yScale.max, Math.max(yScale.min, 0))), xCross = xAt(Math.min(xScale.max, Math.max(xScale.min, 0)));
  axisLine(c, xCross, plot.y, xCross, plot.y + plot.height);
  axisLine(c, plot.x, yCross, plot.x + plot.width, yCross);
  series.forEach((s, j) => {
    const color = c.colors[j % c.colors.length];
    for (const point of s.points) c.mark("circle", { cx: xAt(point.x), cy: yAt(point.y), r: 3 * c.pt, fill: color, stroke: color, "stroke-width": 0.75 * c.pt }, `${c.path}.data.rows.${point.row}.${s.column}`);
  });
}

// ---------------------------------------------------------------------------
// Radar: categories clockwise from 12 o'clock, value axis on the vertical spoke.

function renderRadarChart(c, spec) {
  const { box, pad, fontPx } = c;
  const series = c.series();
  const categories = c.rows.map((row) => c.label(row[0]));
  const count = categories.length;
  const values = series.flatMap((s) => s.values).filter((v) => v !== null);
  const legendWidth = seriesLegend(c, series, spec.style === "filled" ? undefined : "line", spec.markers);
  const labelWidth = Math.min(box.width * 0.2, Math.max(0, ...categories.map(c.width)) + fontPx * 0.5);
  const area = { x: box.x + pad, y: box.y + pad, width: Math.max(1, box.width - 2 * pad - legendWidth), height: Math.max(1, box.height - 2 * pad) };
  const cx = area.x + area.width / 2, cy = area.y + area.height / 2;
  const radius = Math.max(1, Math.min(area.width / 2 - labelWidth, area.height / 2 - c.lineHeight));
  const scale = niceScale(values.length ? Math.min(...values) : 0, values.length ? Math.max(...values) : 1, maxIntervalsFor(radius, c.lineHeight));
  const angle = (i) => -Math.PI / 2 + i / count * Math.PI * 2;
  const rAt = (v) => axisFraction(Math.min(scale.max, Math.max(scale.min, v)), scale) * radius;
  const point = (i, v) => polar(cx, cy, rAt(v), angle(i));
  const n = c.num;
  for (const tick of scale.ticks) {
    if (tick === scale.min) continue;
    const ring = categories.map((_, i) => point(i, tick).map(n).join(" "));
    c.mark("path", { d: `M ${ring.join(" L ")} Z`, fill: "none", stroke: c.gridColor, "stroke-opacity": 0.7, "stroke-width": c.pt });
  }
  categories.forEach((name, i) => {
    const [x, y] = polar(cx, cy, radius, angle(i));
    axisLine(c, cx, cy, x, y);
    const [lx, ly] = polar(cx, cy, radius + fontPx * 0.4, angle(i));
    const cos = Math.cos(angle(i)), sin = Math.sin(angle(i));
    const align = Math.abs(cos) < 0.2 ? "center" : cos > 0 ? "left" : "right";
    const rect = {
      x: align === "center" ? lx - labelWidth / 2 : align === "left" ? lx : lx - labelWidth,
      y: Math.abs(sin) < 0.2 ? ly - c.lineHeight / 2 : sin < 0 ? ly - c.lineHeight : ly,
      width: labelWidth, height: c.lineHeight
    };
    c.text(name, rect, `${c.path}.data.rows.${i}.0`, align);
  });
  series.forEach((s, j) => {
    const color = c.colors[j % c.colors.length], path = `${c.path}.data.columns.${s.column}`;
    if (spec.style === "filled") {
      const outline = s.values.map((v, i) => point(i, v ?? scale.min).map(n).join(" "));
      c.mark("path", { d: `M ${outline.join(" L ")} Z`, fill: color }, path);
      return;
    }
    const at = (i) => point(i, s.values[i]).map(n).join(" ");
    let d = "";
    if (s.values.every((v) => v !== null)) d = `M ${s.values.map((_, i) => at(i)).join(" L ")}${count > 2 ? " Z" : ""}`;
    else for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      if (s.values[i] !== null && s.values[next] !== null && next !== i) d += `${d ? " " : ""}M ${at(i)} L ${at(next)}`;
    }
    if (d) c.mark("path", { d, fill: "none", stroke: color, "stroke-width": 2 * c.pt, "stroke-linejoin": "round", "stroke-linecap": "round" }, path);
    if (spec.markers) s.values.forEach((v, i) => {
      if (v === null) return;
      const [x, y] = point(i, v);
      c.mark("circle", { cx: x, cy: y, r: 3 * c.pt, fill: color, stroke: color, "stroke-width": 0.75 * c.pt }, `${c.path}.data.rows.${i}.${s.column}`);
    });
  });
  // Value axis labels sit on top of filled series, as in PowerPoint.
  for (const tick of scale.ticks) {
    const label = formatTick(tick), width = c.width(label) + fontPx * 0.5;
    c.text(label, { x: cx - width - fontPx * 0.2, y: cy - rAt(tick) - c.lineHeight / 2, width, height: c.lineHeight }, c.path, "right");
  }
}

// ---------------------------------------------------------------------------
// Chartex constructs (FF-22b). opf-pptx writes these as native Office 2016
// chartex parts (cx:series layoutId treemap, clusteredColumn with binning or
// aggregation, paretoLine, boxWhisker, waterfall, funnel, regionMap); the
// previews below draw the same data with the same colours and defaults.

/**
 * The plotted column of a chartex chart: [Category, Value, ...] plots the first
 * value column against its categories; a lone value column is plotted against
 * the row numbers (histogram and pareto bin the values instead).
 */
export function chartexValues(rows, columns) {
  const hasCategories = columns.length > 1;
  const column = hasCategories ? 1 : 0;
  const values = rows.map((row) => chartNumber(row[column]));
  const categories = rows.map((row, i) => hasCategories ? (row[0] === null || row[0] === undefined ? "" : String(row[0])) : String(i + 1));
  return { hasCategories, column, values, categories };
}

// Office's automatic histogram bins: Scott's normal reference rule gives the bin
// width 3.49 * sd * n^(-1/3) (sample standard deviation) over [min, max]; the
// exporter writes the same count as cx:binCount.
export function scottBinCount(values) {
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
 * Equal-width bins from the minimum, closed on the right like PowerPoint's
 * ("[min, e1]", then "(e1, e2]"): each value falls in the last bin whose upper
 * edge it does not exceed. Labels carry six significant digits, and more when
 * two bins would read alike.
 */
export function histogramBins(values) {
  const finite = values.filter((value) => value !== null && Number.isFinite(value));
  if (!finite.length) return [];
  const min = finite.reduce((a, b) => Math.min(a, b)), max = finite.reduce((a, b) => Math.max(a, b));
  const count = scottBinCount(finite);
  const edge = (index) => index === 0 ? min : index === count ? max : min / count * (count - index) + max / count * index;
  const bins = Array.from({ length: count }, (_, index) => ({ low: edge(index), high: edge(index + 1), count: 0 }));
  for (const value of finite) {
    let index = 0;
    while (index + 1 < count && value > bins[index].high) index++;
    bins[index].count++;
  }
  for (let precision = 6; ; precision++) {
    const format = (value) => String(Number(value.toPrecision(precision)));
    const labels = bins.map((bin, index) => count === 1 && min === max ? format(min) : `${index === 0 ? "[" : "("}${format(bin.low)}, ${format(bin.high)}]`);
    if (new Set(labels).size === labels.length || precision === 17) return bins.map((bin, index) => ({ ...bin, label: labels[index] }));
  }
}

// Vertical layout shared by the axis-bearing constructs: category labels below,
// value ticks on the left (and a percentage axis on the right for pareto).
function chartexPlot(c, { categories, legendWidth = 0, tickLabels = [], percentAxis = false }) {
  const { box, pad, fontPx } = c;
  const top = box.y + pad + c.lineHeight / 2;
  const bottom = box.y + box.height - pad - c.lineHeight;
  const height = Math.max(1, bottom - top);
  const tickWidth = Math.max(0, ...tickLabels.map((label) => c.width(label))) + fontPx * 0.5;
  const x = box.x + pad + tickWidth;
  const right = box.x + box.width - pad - legendWidth - (percentAxis ? c.width("100%") + fontPx : fontPx / 2);
  const plot = { x, y: top, width: Math.max(1, right - x), height };
  const band = plot.width / Math.max(1, categories.length);
  categories.forEach((entry, i) => c.text(entry.name, { x: plot.x + i * band, y: plot.y + plot.height, width: band, height: c.lineHeight }, entry.path));
  return { plot, band };
}

function valueAxis(c, plot, scale) {
  const at = (value) => plot.y + axisFraction(value, scale, true) * plot.height;
  for (const tick of scale.ticks) {
    const y = at(tick);
    gridline(c, plot.x, y, plot.x + plot.width, y);
    c.text(formatTick(tick), { x: c.box.x + c.pad, y: y - c.lineHeight / 2, width: plot.x - c.box.x - c.pad - c.fontPx * 0.35, height: c.lineHeight }, c.path, "right");
  }
  const crossing = at(Math.min(scale.max, Math.max(scale.min, 0)));
  axisLine(c, plot.x, plot.y, plot.x, plot.y + plot.height);
  axisLine(c, plot.x, crossing, plot.x + plot.width, crossing);
  return { at, crossing };
}

// Histogram (cx:binning or cx:aggregation) and Pareto (sorted columns with the cumulative-percentage line on a percentage axis).
function renderHistogramChart(c, spec) {
  const pareto = spec.kind === "pareto";
  const { hasCategories, column, values, categories } = chartexValues(c.rows, c.columns);
  let bars;
  if (hasCategories) {
    bars = values.map((value, i) => ({ value, name: categories[i], path: `${c.path}.data.rows.${i}.${column}`, labelPath: `${c.path}.data.rows.${i}.0` })).filter((bar) => bar.value !== null);
  } else {
    bars = histogramBins(values).map((bin) => ({ value: bin.count, name: bin.label, path: `${c.path}.data.columns.${column}`, labelPath: c.path }));
  }
  if (pareto) bars = bars.slice().sort((a, b) => b.value - a.value);
  const total = bars.reduce((sum, bar) => sum + Math.max(0, bar.value), 0);
  if (!Number.isFinite(total)) throw chartAggregateError(c.path, "cumulative total");
  const dataMax = bars.length ? Math.max(...bars.map((bar) => bar.value)) : 1, dataMin = bars.length ? Math.min(0, ...bars.map((bar) => bar.value)) : 0;
  const probe = niceScale(dataMin, dataMax, 10);
  const { plot, band } = chartexPlot(c, { categories: bars.map((bar) => ({ name: bar.name, path: bar.labelPath })), tickLabels: probe.ticks.map((tick) => formatTick(tick)), percentAxis: pareto });
  const scale = niceScale(dataMin, dataMax, maxIntervalsFor(plot.height, c.lineHeight * 1.2));
  const { at, crossing } = valueAxis(c, plot, scale);
  const width = band / 1.06, offset = (band - width) / 2;
  bars.forEach((bar, i) => {
    const y = at(bar.value);
    c.mark("rect", { x: plot.x + i * band + offset, y: Math.min(y, crossing), width, height: Math.abs(crossing - y), fill: c.colors[0] }, bar.path);
  });
  if (pareto && bars.length) {
    // Percentage axis on the right, 0-100%, and the cumulative line through the bar centres.
    const percent = niceScale(0, 1, maxIntervalsFor(plot.height, c.lineHeight * 1.2), { percent: true });
    const right = plot.x + plot.width;
    axisLine(c, right, plot.y, right, plot.y + plot.height);
    for (const tick of percent.ticks) {
      const y = plot.y + axisFraction(tick, percent, true) * plot.height;
      c.text(formatTick(tick, true), { x: right + c.fontPx * 0.35, y: y - c.lineHeight / 2, width: c.box.x + c.box.width - c.pad - right - c.fontPx * 0.35, height: c.lineHeight }, c.path, "left");
    }
    let running = 0;
    const points = bars.map((bar, i) => {
      running += Math.max(0, bar.value);
      const fraction = total ? running / total : 0;
      return `${c.num(plot.x + (i + 0.5) * band)},${c.num(plot.y + axisFraction(fraction, percent, true) * plot.height)}`;
    });
    c.mark("polyline", { points: points.join(" "), fill: "none", stroke: c.colors[1 % c.colors.length], "stroke-width": 2 * c.pt, "stroke-linejoin": "round", "stroke-linecap": "round" }, `${c.path}.data.columns.${column}`);
  }
}

// Waterfall: floating bars from the running total, increases and decreases in the first two palette colours, connector lines between bars.
function renderWaterfallChart(c) {
  const { column, values, categories } = chartexValues(c.rows, c.columns);
  let running = 0;
  const bars = values.map((value, i) => {
    if (value === null) return null;
    const from = running;
    running += value;
    if (!Number.isFinite(running)) throw chartAggregateError(c.path, "running total");
    return { i, value, from, to: running };
  }).filter(Boolean);
  const extents = bars.flatMap((bar) => [bar.from, bar.to]);
  const dataMin = extents.length ? Math.min(0, ...extents) : 0, dataMax = extents.length ? Math.max(0, ...extents) : 1;
  const probe = niceScale(dataMin, dataMax, 10);
  const { plot, band } = chartexPlot(c, { categories: categories.map((name, i) => ({ name, path: `${c.path}.data.rows.${i}.0` })), tickLabels: probe.ticks.map((tick) => formatTick(tick)) });
  const scale = niceScale(dataMin, dataMax, maxIntervalsFor(plot.height, c.lineHeight * 1.2));
  const { at } = valueAxis(c, plot, scale);
  const width = band / 1.5, offset = (band - width) / 2;
  bars.forEach((bar, k) => {
    const a = at(bar.from), b = at(bar.to);
    const x = plot.x + bar.i * band + offset;
    c.mark("rect", { x, y: Math.min(a, b), width, height: Math.abs(b - a), fill: c.colors[bar.value < 0 ? 1 : 0] }, `${c.path}.data.rows.${bar.i}.${column}`);
    const next = bars[k + 1];
    if (next) c.mark("line", { x1: x + width, y1: b, x2: plot.x + next.i * band + offset, y2: b, stroke: c.axisColor, "stroke-width": c.pt });
  });
}

// Funnel: centred bars from the top, widths proportional to the value, value labels inside and category labels on the left.
function renderFunnelChart(c) {
  const { box, pad, fontPx } = c;
  const { column, values, categories } = chartexValues(c.rows, c.columns);
  const count = categories.length;
  const max = Math.max(0, ...values.filter((value) => value !== null));
  const labelWidth = Math.min(box.width * 0.3, Math.max(0, ...categories.map(c.width)) + fontPx * 0.5);
  const plot = { x: box.x + pad + labelWidth + pad / 2, y: box.y + pad, width: Math.max(1, box.width - 2 * pad - labelWidth - pad / 2), height: Math.max(1, box.height - 2 * pad) };
  const band = plot.height / count, height = band / 1.06, offset = (band - height) / 2;
  categories.forEach((name, i) => {
    const y = plot.y + i * band;
    c.text(name, { x: box.x + pad, y, width: labelWidth, height: band }, `${c.path}.data.rows.${i}.0`, "right");
    const value = values[i];
    if (value === null || !(max > 0) || value <= 0) return;
    const width = plot.width * Math.min(1, value / max);
    const x = plot.x + (plot.width - width) / 2;
    c.mark("rect", { x, y: y + offset, width, height, fill: c.colors[0] }, `${c.path}.data.rows.${i}.${column}`);
    c.text(formatTick(value), { x: plot.x, y: y + offset, width: plot.width, height }, `${c.path}.data.rows.${i}.${column}`);
  });
}

/**
 * Squarified treemap layout (Bruls, Huizing and van Wijk): items are laid out
 * in rows along the shorter side, each row closed when adding the next item
 * would worsen its worst aspect ratio. Returns one rectangle per item, in the
 * item order given (null for items without area).
 */
export function squarify(items, x, y, width, height) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const rects = new Array(items.length).fill(null);
  if (!(total > 0) || !(width > 0) || !(height > 0)) return rects;
  const scale = width * height / total;
  const ordered = items.map((item, index) => ({ area: item.value * scale, index })).filter((item) => item.area > 0).sort((a, b) => b.area - a.area || a.index - b.index);
  let free = { x, y, width, height };
  let row = [];
  const worst = (candidates, side) => {
    const sum = candidates.reduce((s, item) => s + item.area, 0);
    const min = Math.min(...candidates.map((item) => item.area)), max = Math.max(...candidates.map((item) => item.area));
    return Math.max(side * side * max / (sum * sum), sum * sum / (side * side * min));
  };
  const layoutRow = () => {
    const sum = row.reduce((s, item) => s + item.area, 0);
    const horizontal = free.width >= free.height;
    const side = horizontal ? free.height : free.width;
    const thickness = side > 0 ? sum / side : 0;
    let offset = 0;
    for (const item of row) {
      const length = thickness > 0 ? item.area / thickness : 0;
      rects[item.index] = horizontal
        ? { x: free.x, y: free.y + offset, width: thickness, height: length }
        : { x: free.x + offset, y: free.y, width: length, height: thickness };
      offset += length;
    }
    free = horizontal
      ? { x: free.x + thickness, y: free.y, width: Math.max(0, free.width - thickness), height: free.height }
      : { x: free.x, y: free.y + thickness, width: free.width, height: Math.max(0, free.height - thickness) };
    row = [];
  };
  for (const item of ordered) {
    const side = Math.min(free.width, free.height);
    if (row.length && side > 0 && worst([...row, item], side) > worst(row, side)) layoutRow();
    row.push(item);
  }
  if (row.length) layoutRow();
  return rects;
}

// Treemap: one tile per category from the first value column (positive values only), one palette colour per tile, category labels inside.
function renderTreemapChart(c) {
  const { box, pad, fontPx } = c;
  const { column, values, categories } = chartexValues(c.rows, c.columns);
  const items = values.map((value) => ({ value: value !== null && value > 0 ? value : 0 }));
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!Number.isFinite(total)) throw chartAggregateError(c.path, "tile total");
  const area = { x: box.x + pad, y: box.y + pad, width: Math.max(1, box.width - 2 * pad), height: Math.max(1, box.height - 2 * pad) };
  if (!total) {
    c.text("No positive chart values", area, c.path);
    return;
  }
  const rects = squarify(items, area.x, area.y, area.width, area.height);
  rects.forEach((rect, i) => {
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return;
    c.mark("rect", { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fill: c.colors[i % c.colors.length], stroke: "#FFFFFF", "stroke-width": c.pt }, `${c.path}.data.rows.${i}.${column}`);
    if (rect.width >= fontPx * 2 && rect.height >= c.lineHeight) {
      c.text(categories[i], { x: rect.x + fontPx * 0.25, y: rect.y, width: rect.width - fontPx * 0.5, height: rect.height }, `${c.path}.data.rows.${i}.0`);
    }
  });
}

/**
 * Box statistics as PowerPoint computes them with the exclusive quartile
 * method (Excel QUARTILE.EXC): the rank p(n + 1) interpolates between sorted
 * values and clamps to the extremes, whiskers reach the furthest values within
 * 1.5 IQR of the box, and values beyond are outliers.
 */
export function boxStatistics(values) {
  const sorted = values.filter((value) => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return null;
  const quantile = (p) => {
    const rank = p * (n + 1);
    if (rank <= 1) return sorted[0];
    if (rank >= n) return sorted[n - 1];
    const lower = Math.floor(rank), fraction = rank - lower;
    return sorted[lower - 1] + fraction * (sorted[lower] - sorted[lower - 1]);
  };
  const q1 = quantile(0.25), median = quantile(0.5), q3 = quantile(0.75);
  const iqr = q3 - q1;
  const inside = sorted.filter((value) => value >= q1 - 1.5 * iqr && value <= q3 + 1.5 * iqr);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  return { q1, median, q3, mean, low: inside[0] ?? q1, high: inside[inside.length - 1] ?? q3, outliers: sorted.filter((value) => value < q1 - 1.5 * iqr || value > q3 + 1.5 * iqr) };
}

// Box and whisker: rows with the same category form one box per series; median line, mean marker and outliers, gap width 100%.
function renderBoxWhiskerChart(c) {
  // A lone value column has no category column: like the exporter, its values plot against their row numbers (one box per row).
  const lone = c.columns.length === 1;
  const series = lone ? [{ name: c.label(c.columns[0]), column: 0, index: 0, values: c.rows.map((row) => chartNumber(row[0])) }] : c.series();
  const groups = [];
  c.rows.forEach((row, i) => {
    const name = lone ? String(i + 1) : c.label(row[0]);
    let group = groups.find((entry) => entry.name === name);
    if (!group) groups.push(group = { name, first: i, rows: [] });
    group.rows.push(i);
  });
  const boxes = series.map((s) => groups.map((group) => ({ stats: boxStatistics(group.rows.map((i) => s.values[i])), rows: group.rows })));
  const all = boxes.flat().flatMap((entry) => entry.stats ? [entry.stats.low, entry.stats.high, ...entry.stats.outliers] : []);
  const dataMin = all.length ? Math.min(...all) : 0, dataMax = all.length ? Math.max(...all) : 1;
  const legendWidth = seriesLegend(c, series);
  const probe = niceScale(dataMin, dataMax, 10);
  const { plot, band } = chartexPlot(c, { categories: groups.map((group) => ({ name: group.name, path: lone ? c.path : `${c.path}.data.rows.${group.first}.0` })), legendWidth, tickLabels: probe.ticks.map((tick) => formatTick(tick)) });
  const scale = niceScale(dataMin, dataMax, maxIntervalsFor(plot.height, c.lineHeight * 1.2));
  const { at } = valueAxis(c, plot, scale);
  const group = band / 2, width = group / series.length, offset = (band - group) / 2;
  series.forEach((s, j) => {
    const color = c.colors[j % c.colors.length], path = `${c.path}.data.columns.${s.column}`;
    boxes[j].forEach((entry, i) => {
      const stats = entry.stats;
      if (!stats) return;
      const x = plot.x + i * band + offset + j * width, mid = x + width / 2;
      const top = at(stats.q3), bottom = at(stats.q1);
      c.mark("line", { x1: mid, y1: at(stats.high), x2: mid, y2: top, stroke: color, "stroke-width": c.pt }, path);
      c.mark("line", { x1: mid, y1: bottom, x2: mid, y2: at(stats.low), stroke: color, "stroke-width": c.pt }, path);
      c.mark("line", { x1: x + width * 0.25, y1: at(stats.high), x2: x + width * 0.75, y2: at(stats.high), stroke: color, "stroke-width": c.pt }, path);
      c.mark("line", { x1: x + width * 0.25, y1: at(stats.low), x2: x + width * 0.75, y2: at(stats.low), stroke: color, "stroke-width": c.pt }, path);
      c.mark("rect", { x, y: top, width, height: Math.max(c.pt, bottom - top), fill: color }, path);
      c.mark("line", { x1: x, y1: at(stats.median), x2: x + width, y2: at(stats.median), stroke: c.labelColor, "stroke-width": c.pt }, path);
      const r = 2.5 * c.pt, my = at(stats.mean);
      c.mark("path", { d: `M ${c.num(mid - r)} ${c.num(my - r)} L ${c.num(mid + r)} ${c.num(my + r)} M ${c.num(mid - r)} ${c.num(my + r)} L ${c.num(mid + r)} ${c.num(my - r)}`, fill: "none", stroke: c.labelColor, "stroke-width": c.pt }, path);
      for (const value of stats.outliers) {
        const row = entry.rows.find((k) => s.values[k] === value);
        c.mark("circle", { cx: mid, cy: at(value), r: 3 * c.pt, fill: color, stroke: color, "stroke-width": 0.75 * c.pt }, `${c.path}.data.rows.${row}.${s.column}`);
      }
    });
  });
}

/** Mix two hex colours (#RRGGBB) by `t` in [0, 1], rounded per channel. */
export function mixHex(from, to, t) {
  const channel = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const clamp = Math.min(1, Math.max(0, t));
  return `#${[0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * clamp).toString(16).toUpperCase().padStart(2, "0")).join("")}`;
}

// Region map: an honest non-geographic preview. PowerPoint draws the map from
// Bing geodata it fetches itself; the preview shows one tile per region, shaded
// from a light tint to the series colour by value, with the region name and
// its value, so labels and colours are traceable without shipping geography.
function renderRegionMapChart(c) {
  const { box, pad, fontPx } = c;
  const { column, values, categories } = chartexValues(c.rows, c.columns);
  const count = categories.length;
  const area = { x: box.x + pad, y: box.y + pad, width: Math.max(1, box.width - 2 * pad), height: Math.max(1, box.height - 2 * pad) };
  const columns = Math.max(1, Math.min(count, Math.round(Math.sqrt(count * area.width / Math.max(1, area.height)))));
  const rowsCount = Math.ceil(count / columns);
  const tileWidth = area.width / columns, tileHeight = area.height / rowsCount;
  const finite = values.filter((value) => value !== null);
  const min = finite.length ? Math.min(...finite) : 0, max = finite.length ? Math.max(...finite) : 0;
  const light = mixHex(/^#[0-9A-Fa-f]{6}$/.test(c.surface) ? c.surface : "#FFFFFF", c.colors[0], 0.15);
  categories.forEach((name, i) => {
    const value = values[i];
    const t = value === null ? 0 : max > min ? (value - min) / (max - min) : 1;
    const x = area.x + (i % columns) * tileWidth, y = area.y + Math.floor(i / columns) * tileHeight;
    c.mark("rect", { x, y, width: tileWidth, height: tileHeight, fill: value === null ? c.surface : mixHex(light, c.colors[0], t), stroke: "#FFFFFF", "stroke-width": c.pt }, `${c.path}.data.rows.${i}.${column}`);
    const inset = { x: x + fontPx * 0.25, width: Math.max(1, tileWidth - fontPx * 0.5) };
    if (tileHeight >= c.lineHeight * 2) {
      c.text(name, { ...inset, y: y + tileHeight / 2 - c.lineHeight, height: c.lineHeight }, `${c.path}.data.rows.${i}.0`);
      if (value !== null) c.text(formatTick(value), { ...inset, y: y + tileHeight / 2, height: c.lineHeight }, `${c.path}.data.rows.${i}.${column}`);
    } else if (tileHeight >= c.lineHeight) {
      c.text(name, { ...inset, y: y + (tileHeight - c.lineHeight) / 2, height: c.lineHeight }, `${c.path}.data.rows.${i}.0`);
    }
  });
}
