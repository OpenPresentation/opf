// Chart previews for the OPF chart types (FF-22).
//
// OPF 0.15 makes chart.type an engine vocabulary: core's schema enum and CHART_TYPES, one type per Office chart construct.
// The table below is carried here so the preview stays synchronous and self-contained; test/chart-catalog.mjs checks it
// against core's CHART_TYPES. Each type renders the construct PowerPoint shows for the exported chart; any other value
// returns null so the caller keeps its legacy single-series preview.
import { chartHighlightColors, chartHighlightMarks, chartNumber, chartPaletteForFill, formatDataNumber, numberFormatError, resolveChartData, resolveTextStyle, textColorForFill, textWidthMeasurer } from "@openpresentation/opf/composition";
import { drawAxisTitles, drawBarLabel, drawCenteredLabel, drawPointLabel, drawSliceLabel, labelString, outsideLabelReserve, reportOptionDiagnostics, reserveAxisTitles, resolveOptions } from "./chart-options.js";

// Ordered series palette written by opf-pptx (`CHART_COLORS`), before the same
// per-surface adjustment (`chartPaletteForFill`: contrast against the card, without letting two series merge).
export const CHART_SERIES_COLORS = Object.freeze([
  "#2874A6", "#1B4F72", "#5499C7", "#7BDBB2", "#3AC67A", "#24A89E",
  "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6", "#0F172A", "#64748B"
]);

// The series colours for a chart panel: core's `chartPaletteForFill` (contrast against the panel without letting two series merge).
export function chartSeriesPalette(surface) {
  return chartPaletteForFill(surface, CHART_SERIES_COLORS);
}

// FA-14: chart.highlight. Core resolves which series and categories are named (chartHighlightMarks) and the two colours
// (chartHighlightColors); a highlighted mark takes the accent, every other mark the muted neutral. A chart without a
// highlight has no `c.highlight`, and every colour below is the palette colour it always was.
function highlightFor(c, resolved, spec, data) {
  if (!resolved.highlight) return undefined;
  const marks = chartHighlightMarks(resolved.highlight, { columns: data.columns, hasX: spec.kind === "scatter" && data.columns.length > 2, rows: data.rows });
  if (!marks) return undefined;
  return { ...marks, ...chartHighlightColors(c.surface, c.bound.design.colors.primary, c.labelColor) };
}

/** The colour of series `j` as a whole (a line, an area, a legend key): the accent when highlighted, else muted. */
function seriesColor(c, j) {
  return c.highlight ? (c.highlight.series[j] ? c.highlight.accent : c.highlight.muted) : c.colors[j % c.colors.length];
}

/** The colour of the mark of series `j` at row `i`: highlighted when its series or its category is named. */
function markColor(c, j, i) {
  return c.highlight ? (c.highlight.series[j] || c.highlight.categories[i] ? c.highlight.accent : c.highlight.muted) : c.colors[j % c.colors.length];
}

/** The colour of the pie or doughnut slice of row `i`. */
function sliceColor(c, i) {
  return c.highlight ? (c.highlight.categories[i] ? c.highlight.accent : c.highlight.muted) : c.colors[i % c.colors.length];
}

const bar = (dir, grouping) => ({ kind: "bar", dir, grouping });
const line = (grouping, markers) => ({ kind: "line", grouping, markers });
const area = (grouping) => ({ kind: "area", grouping });
const radar = (style) => ({ kind: "radar", style, markers: style === "marker" });

export const CHART_TYPES = Object.freeze({
  column: bar("col", "clustered"),
  "stacked-column": bar("col", "stacked"),
  "100pct-stacked-column": bar("col", "percentStacked"),
  bar: bar("bar", "clustered"),
  "stacked-bar": bar("bar", "stacked"),
  "100pct-stacked-bar": bar("bar", "percentStacked"),
  line: line("standard", false),
  "line-with-markers": line("standard", true),
  "stacked-line": line("stacked", false),
  "stacked-line-with-markers": line("stacked", true),
  area: area("standard"),
  "stacked-area": area("stacked"),
  "100pct-stacked-area": area("percentStacked"),
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
  world: { kind: "map" },
  // FA-15: clustered columns with line series (markers), the lines optionally on a secondary value axis (core resolves the plan).
  combo: { kind: "combo", dir: "col", grouping: "clustered", markers: true }
});

/** Resolve a chart type (core's CHART_TYPES vocabulary, OPF 0.15) to its preview spec id, or null for any other value. */
export function resolveChartType(type) {
  const id = String(type ?? "").trim().toLowerCase();
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
  map: renderRegionMapChart,
  combo: renderComboChart
};

// Chartex constructs also accept a lone value column (the exporter plots it
// against row numbers, or bins it for histogram and pareto).
const CHARTEX_KINDS = new Set(["treemap", "histogram", "pareto", "box", "waterfall", "funnel", "map"]);

/**
 * Render a chart of a known type. Returns null when the type is outside CHART_TYPES, has
 * no preview renderer, or carries no inline category-major data, so the caller
 * can keep its legacy output ("No chart data" for unresolved sources).
 */
export function renderCatalogChart(item, box, bound, options, svg) {
  const id = resolveChartType(item.value?.type);
  const spec = id && CHART_TYPES[id];
  const render = spec && RENDERERS[spec.kind];
  const data = render ? chartData(item, bound) : null;
  if (!data || !data.rows.length || data.columns.length < (CHARTEX_KINDS.has(spec.kind) ? 1 : 2)) return null;
  const c = chartContext(item, box, bound, options, svg, data);
  c.mark("rect", { x: box.x, y: box.y, width: box.width, height: box.height, fill: c.surface, stroke: bound.design.colors.border, "stroke-width": 1 }, item.path);
  // RR-35: a chart with axis titles, a legend position or data labels reserves their space before the plot is laid out. A chart
  // with none of them skips this block entirely, so its output is unchanged.
  const resolved = resolveOptions(item.value, spec);
  // FA-14: a highlight changes colours only (no space is reserved), so it is resolved whether or not an option is active.
  c.highlight = highlightFor(c, resolved, spec, data);
  if (!resolved.active) reportOptionDiagnostics(c, resolved);
  if (resolved.active) {
    reportOptionDiagnostics(c, resolved);
    c.dataLabels = resolved.dataLabels;
    c.dataLabelsOff = resolved.dataLabelsOff === true;
    if (resolved.legend !== undefined) placeLegend(c, spec, resolved.legend);
    reserveAxisTitles(c, spec, resolved.axisTitles);
  }
  render(c, spec);
  if (resolved.active) drawAxisTitles(c);
  return svg.tag("g", { ...svg.traceAttrs(options, item.path), "data-opf-chart": options.trace ? id : undefined }, c.children.join("\n"));
}

// RR-54: the chart's data as the renderers plot it, from core's resolveChartData: inline columns (names or DataColumn objects),
// a dataset reference and chart.mapping all resolve to one positional table, [category, (x,) ...series], with each column's number
// format. Series cells have already gone through core's strict chartNumber. Returns null when the data does not resolve (an
// external data source, an unknown dataset, no rows or columns), so the caller keeps its placeholder.
export function chartData(item, bound) {
  const chart = item.value;
  const resolved = resolveChartData(chart, bound?.presentation, { path: item.path });
  if (!resolved.ok) return null;
  const formats = resolved.formats.map((format) => typeof format === "string" && format !== "" && !numberFormatError(format) ? format : undefined);
  return { columns: resolved.columns, rows: resolved.rows, formats, trace: tracePaths(item, bound, resolved), ...(resolved.combo ? { combo: resolved.combo } : {}) };
}

// The authored object at a composed path ("slides.0.blocks.1.chart"), or undefined.
function authoredAt(presentation, path) {
  let value = presentation;
  for (const key of String(path).split(".")) {
    if (value === null || typeof value !== "object") return undefined;
    value = value[key];
  }
  return value;
}

/** True when the chart's authored data is a dataset reference: its parts then report the chart's own path. */
export function isDatasetChart(item, bound) {
  const authored = authoredAt(bound?.presentation, item.path);
  const data = authored && typeof authored === "object" ? authored.data : undefined;
  return Boolean(data) && typeof data === "object" && typeof data.dataset === "string";
}

/** True when the table's authored form is a dataset reference (`{ dataset, fields }`): its cells then report the table's own path. */
export function isDatasetTable(item, bound) {
  const authored = authoredAt(bound?.presentation, item.path);
  return Boolean(authored) && typeof authored === "object" && typeof authored.dataset === "string";
}

// Where a mark's trace path points. A dataset-backed chart has no `data.rows` or `data.columns` of its own, so every part reports
// the chart's authored path; a chart with `mapping` (or a combo chart, whose column series come before its lines) reports the
// authored column index of each plotted column (the resolved order is category, X, then the mapped series).
function tracePaths(item, bound, resolved) {
  if (isDatasetChart(item, bound)) return { collapse: true };
  const authored = authoredAt(bound?.presentation, item.path);
  const authoredData = authored && typeof authored === "object" ? authored.data : undefined;
  if (!authored || typeof authored !== "object" || (!authored.mapping && !resolved.combo) || !Array.isArray(authoredData?.columns)) return null;
  const names = authoredData.columns.map((column) => column !== null && typeof column === "object" ? column.name : column);
  const columnMap = resolved.columns.map((name, index) => { const found = names.indexOf(name); return found < 0 ? index : found; });
  return columnMap.every((column, index) => column === index) ? null : { columnMap };
}

function chartContext(item, box, bound, options, svg, { rows, columns, formats, trace, combo }) {
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
  const prefix = `${item.path}.data.`;
  const tracePath = !trace ? (path) => path : (path) => {
    if (typeof path !== "string" || !path.startsWith(prefix)) return path;
    if (trace.collapse) return item.path;
    return path.replace(/^(.*\.data\.(?:columns\.|rows\.\d+\.))(\d+)$/, (whole, head, column) => `${head}${trace.columnMap[Number(column)] ?? column}`);
  };
  const c = {
    item, box, bound, options, svg, rows, columns, formats, combo, children, u, fontPx, surface, labelColor,
    path: item.path,
    pt: u * 4 / 3,
    pad: 10 * u,
    lineHeight: fontPx * 1.5,
    // One text line as renderTextBox lays it out (fitText line height), and the
    // clear space kept between neighbouring category labels.
    textHeight: fontPx * 1.22,
    labelGap: fontPx * 0.1,
    colors: chartSeriesPalette(surface),
    gridColor: bound.design.colors.border,
    axisColor: "#888888",
    number: chartNumber,
    label: (value) => value === null || value === undefined ? "" : String(value),
    width: (value) => measure(String(value), fontPx),
    num: n,
    mark(name, attrs, path) {
      const out = {};
      for (const [key, value] of Object.entries(attrs)) out[key] = numericAttrs.has(key) && typeof value === "number" ? n(value) : value;
      children.push(svg.tag(name, { ...out, ...(path ? svg.traceAttrs(options, tracePath(path)) : {}) }));
    },
    textElement(value, rect, path, align = "center", fill = labelColor) {
      if (!(rect.width > 0 && rect.height > 0)) return "";
      return svg.renderTextBox(String(value), rect, bound, {
        path: tracePath(path), fontSize: requested, fontFamily: bound.design.fonts.body, fontWeight: 400,
        fill, options, align, verticalAlign: "middle"
      });
    },
    text(value, rect, path, align = "center") {
      const element = c.textElement(value, rect, path, align);
      if (element) children.push(element);
    },
    series(first = 1) {
      return columns.slice(first).map((name, offset) => ({
        name: c.label(name), column: first + offset, index: offset,
        ...(formats[first + offset] !== undefined ? { format: formats[first + offset] } : {}),
        values: rows.map((row) => chartNumber(row[first + offset]))
      }));
    }
  };
  return c;
}

// RR-54: core's strict chart number (finite numbers and strict decimal strings; everything else is a gap), so the preview, the PPTX
// export and the validator agree on which cells are numbers.
export { chartNumber };

/** A number as its column's format shows it (core's formatDataNumber); without a format, the General form the preview always drew. */
export function formatChartValue(value, format) {
  if (format === undefined) return String(clean(value));
  return formatDataNumber(clean(value), format);
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

/** Office General / 0% tick labels; a value axis takes its first plotted series' number format (RR-54). */
export function formatTick(value, percent = false, format = undefined) {
  if (percent) return `${clean(value * 100)}%`;
  return format === undefined ? String(clean(value)) : formatChartValue(value, format);
}

// RR-54: a formatted horizontal axis (horizontal bars, the scatter X axis) can have end tick labels far wider than the margin the layout
// leaves beside the plot (a General label is a few characters, a long format code is not). Pull the plot in until the first and
// last labels, centred on their ticks, stay inside the chart, and lay the ticks out again for the new width. Only formatted axes call it,
// so a General axis keeps its placement.
function insetForEndLabels(c, x, width, format, scaleFor) {
  const left = c.box.x + c.pad, right = c.box.x + c.box.width - c.pad;
  let scale = scaleFor(width);
  for (let pass = 0; pass < 3; pass++) {
    const ticks = scale.ticks;
    if (!ticks.length) break;
    const first = c.width(formatTick(ticks[0], false, format)) / 2, last = c.width(formatTick(ticks[ticks.length - 1], false, format)) / 2;
    const nextX = Math.max(x, left + first), nextWidth = Math.max(1, Math.min(x + width, right - last) - nextX);
    if (nextX === x && nextWidth === width) break;
    x = nextX; width = nextWidth; scale = scaleFor(width);
  }
  return { x, width, scale };
}

function legendMetrics(c, entries) {
  const swatch = c.fontPx * 0.6, gap = c.fontPx * 0.4, keyWidth = entries.some((entry) => entry.key === "line") ? c.fontPx * 1.4 : swatch;
  return { swatch, gap, keyWidth, textWidth: Math.max(...entries.map((entry) => c.width(entry.name))) };
}

// One legend entry: its key at x, its name after it, in a row starting at y.
function drawLegendEntry(c, entry, x, y, rowHeight, { swatch, gap, keyWidth }, width) {
  const middle = y + rowHeight / 2;
  // Legend keys follow the series format: a line (with marker) for line/radar
  // series, a marker for scatter series, a filled square otherwise.
  if (entry.key === "line") c.mark("polyline", { points: `${c.num(x)},${c.num(middle)} ${c.num(x + keyWidth)},${c.num(middle)}`, fill: "none", stroke: entry.color, "stroke-width": 2 * c.pt }, entry.path);
  if (entry.key === "marker" || (entry.key === "line" && entry.marker)) c.mark("circle", { cx: x + keyWidth / 2, cy: middle, r: 3 * c.pt, fill: entry.color, stroke: entry.color, "stroke-width": 0.75 * c.pt }, entry.path);
  if (!entry.key) c.mark("rect", { x, y: middle - swatch / 2, width: swatch, height: swatch, fill: entry.color }, entry.path);
  c.text(entry.name, { x: x + keyWidth + gap, y, width: Math.max(1, width - keyWidth - gap), height: rowHeight }, entry.path, "left");
}

function legendEntries(c, entries) {
  // PowerPoint places the exported legend on the right (PptxGenJS legendPos r). A chart with an explicit legend option
  // draws it in placeLegend instead, before the plot, so the renderers draw nothing here.
  if (!entries.length || c.legendManaged) return 0;
  const metrics = legendMetrics(c, entries);
  const width = Math.min(c.box.width * 0.45, metrics.keyWidth + metrics.gap + metrics.textWidth + c.fontPx * 0.5);
  const rowHeight = Math.min(c.lineHeight, (c.box.height - 2 * c.pad) / entries.length);
  const x = c.box.x + c.box.width - c.pad - width;
  let y = c.box.y + Math.max(c.pad, (c.box.height - rowHeight * entries.length) / 2);
  for (const entry of entries) {
    drawLegendEntry(c, entry, x, y, rowHeight, metrics, width);
    y += rowHeight;
  }
  return width + c.pad;
}

// RR-35: the legend entries of a chart whatever the series count (an explicit legend position shows a single series too).
function legendSource(c, spec) {
  const fromSeries = (series, key, marker = false) => series.map((s) => ({ name: s.name, color: seriesColor(c, s.index), path: `${c.path}.data.columns.${s.column}`, key, marker }));
  switch (spec.kind) {
    case "pie":
    case "doughnut": return c.rows.map((row, i) => ({ name: c.label(row[0]), color: sliceColor(c, i), path: `${c.path}.data.rows.${i}.0` }));
    case "scatter": return fromSeries(scatterSeries(c.rows, c.columns, c.formats).series, "marker");
    case "line": return fromSeries(c.series(), "line", spec.markers);
    case "radar": return fromSeries(c.series(), spec.style === "filled" ? undefined : "line", spec.markers);
    case "box": return fromSeries(c.columns.length === 1 ? [{ name: c.label(c.columns[0]), column: 0, index: 0 }] : c.series());
    case "bar":
    case "area": return fromSeries(c.series());
    case "combo": return comboLegendEntries(c, c.series());
    default: return [];
  }
}

// RR-35: an explicit legend position. The legend is drawn at its edge of the chart and the room it takes is carved out of
// c.box, so the renderer lays the plot out in what is left. "none" only switches the default right legend off.
function placeLegend(c, spec, position) {
  c.legendManaged = true;
  if (position === "none") return;
  const entries = legendSource(c, spec);
  if (!entries.length) return;
  const metrics = legendMetrics(c, entries), outer = c.box;
  if (position === "left" || position === "right") {
    const width = Math.min(outer.width * 0.45, metrics.keyWidth + metrics.gap + metrics.textWidth + c.fontPx * 0.5);
    const rowHeight = Math.min(c.lineHeight, (outer.height - 2 * c.pad) / entries.length);
    const x = position === "right" ? outer.x + outer.width - c.pad - width : outer.x + c.pad;
    let y = outer.y + Math.max(c.pad, (outer.height - rowHeight * entries.length) / 2);
    for (const entry of entries) {
      drawLegendEntry(c, entry, x, y, rowHeight, metrics, width);
      y += rowHeight;
    }
    const reserve = width + c.pad;
    c.box = { x: position === "left" ? outer.x + reserve : outer.x, y: outer.y, width: Math.max(1, outer.width - reserve), height: outer.height };
    return;
  }
  // Top and bottom: entries flow left to right in rows, each row centred, wrapping when the row would pass the chart width.
  const available = Math.max(1, outer.width - 2 * c.pad), spacing = c.fontPx * 0.8;
  const sized = entries.map((entry) => ({ entry, width: Math.min(available, metrics.keyWidth + metrics.gap + c.width(entry.name) + spacing) }));
  const rows = [];
  for (const item of sized) {
    const row = rows[rows.length - 1];
    if (row && row.width + item.width <= available + 0.01) { row.items.push(item); row.width += item.width; } else rows.push({ items: [item], width: item.width });
  }
  const band = rows.length * c.lineHeight;
  let y = position === "top" ? outer.y + c.pad : outer.y + outer.height - c.pad - band;
  for (const row of rows) {
    let x = outer.x + (outer.width - row.width + spacing) / 2;
    for (const { entry, width } of row.items) {
      drawLegendEntry(c, entry, x, y, c.lineHeight, metrics, width - spacing + c.fontPx * 0.4);
      x += width;
    }
    y += c.lineHeight;
  }
  const reserve = band + c.pad;
  c.box = { x: outer.x, y: position === "top" ? outer.y + reserve : outer.y, width: outer.width, height: Math.max(1, outer.height - reserve) };
}

function seriesLegend(c, series, key, marker = false) {
  return series.length > 1
    ? legendEntries(c, series.map((s) => ({ name: s.name, color: seriesColor(c, s.index), path: `${c.path}.data.columns.${s.column}`, key, marker })))
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
// Category-axis labels. PowerPoint labels a category axis automatically: a label
// stays on one line unless it has spaces and fits two lines in its category
// band; when the labels do not fit horizontally it rotates them (-45 degrees,
// then vertical) and shrinks the plot area to make room; when even that does not
// fit it draws every n-th label (tickLblSkip auto, first label always kept).
// The helpers below reproduce that policy deterministically:
//
//   1. A label is never broken inside a word. It is one line, or (when it has
//      whitespace) the best two-line split, or an ellipsized single line.
//   2. Horizontal labels (single, or two-line where a band is too narrow) win
//      when no two labels collide. Otherwise -45 degree, then -90 degree labels
//      are tried while their footprint fits `maxReserve` (at most 40% of the
//      chart height), each drawn with the fewest labels that avoid overlap.
//   3. When no arrangement shows every label, the arrangement with the smallest
//      skip interval n wins (ties: horizontal, then -45, then -90); labels
//      0, n, 2n, ... are drawn, so the first label is always drawn.
//   4. Only a label wider than the whole chart area (or wider than a horizontal
//      bar chart's label gutter, which grows to 30% of the chart width) is
//      ellipsized; that is reported once per chart as `chart-label-truncated`.
//      No arrangement raises `text-overflow`.

const ELLIPSIS = "…";
// Whitespace that may split a label; no-break spaces stay inside their word.
const BREAKABLE = /[^\S  ﻿]+/u;

// Labels lay out as one line of text; authored line breaks read as spaces.
const flatLabel = (name) => String(name ?? "").replace(/[\r\n]+/g, " ");

function labelCandidates(c, entries) {
  return entries.map((entry) => {
    const text = flatLabel(entry.name);
    return { ...entry, text, width: text ? c.width(text) : 0 };
  });
}

// The two-line split with the narrowest widest line, or null for one word.
function twoLines(c, label) {
  if (label.two !== undefined) return label.two;
  const words = label.text.split(BREAKABLE).filter(Boolean);
  let best = null;
  for (let split = 1; split < words.length; split++) {
    const first = words.slice(0, split).join(" "), second = words.slice(split).join(" ");
    const width = Math.max(c.width(first), c.width(second));
    if (!best || width < best.width - 1e-9) best = { text: `${first}\n${second}`, width };
  }
  return label.two = best;
}

// Longest prefix that fits `limit` once the ellipsis is appended.
function ellipsize(c, text, limit) {
  const chars = Array.from(text);
  const fits = (length) => c.width(chars.slice(0, length).join("").trimEnd() + ELLIPSIS) <= limit;
  let low = 0, high = chars.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) low = middle; else high = middle - 1;
  }
  const out = chars.slice(0, low).join("").trimEnd() + ELLIPSIS;
  return { text: out, width: c.width(out) };
}

function reportTruncatedLabels(c, paths) {
  if (!paths.length) return;
  const many = paths.length !== 1;
  c.svg.reportDiagnostic?.({
    code: "chart-label-truncated", reason: "category-axis", path: c.path, labels: paths,
    message: `${paths.length} category label${many ? "s are" : " is"} wider than the space the axis can give ${many ? "them" : "it"} and ${many ? "were" : "was"} shortened with an ellipsis; shorten the label or enlarge the chart.`
  }, c.options);
}

// A horizontal category axis (labels below the plot). Returns the arrangement
// with the space it needs under the plot: { angle, n, reserve, labels }.
function planBottomLabels(c, entries, plot, maxReserve, { minX, maxX, rotatedMinX }) {
  const labels = labelCandidates(c, entries);
  const count = labels.length;
  if (!count) return { angle: 0, n: 1, reserve: c.lineHeight, labels: [] };
  const band = plot.width / count, gap = c.labelGap, lineH = c.textHeight;
  const limit = Math.max(1, maxX - minX);
  const allowTwo = maxReserve >= c.lineHeight + lineH - 0.01;

  const horizontal = (n) => {
    const slot = n * band - gap, placed = [];
    let prevRight = -Infinity, rows = 1;
    for (let i = 0; i < count; i += n) {
      const label = labels[i];
      let { text, width } = label, lines = 1, truncated = false;
      if (width > slot && allowTwo) {
        const two = twoLines(c, label);
        if (two && two.width <= slot) ({ text, width } = two), lines = 2;
      }
      if (width > limit) ({ text, width } = ellipsize(c, label.text, limit)), lines = 1, truncated = true;
      const cx = plot.x + (i + 0.5) * band;
      const left = Math.min(Math.max(cx - width / 2, minX), maxX - width);
      if (left < prevRight + gap - 1e-6) return null;
      prevRight = left + width;
      rows = Math.max(rows, lines);
      placed.push({ i, text, width, lines, left, cx, truncated });
    }
    return { angle: 0, n, reserve: c.lineHeight + (rows - 1) * lineH, labels: placed };
  };
  let plain = null;
  for (let n = 1; n <= count && !plain; n++) plain = horizontal(n);
  // One label always fits by itself (it is clamped and ellipsized to the chart).
  plain ??= { angle: 0, n: count, reserve: c.lineHeight, labels: [] };

  const rotated = (angle) => {
    const sin = angle === 90 ? 1 : Math.SQRT1_2, cos = angle === 90 ? 0 : Math.SQRT1_2;
    const n = Math.max(1, Math.ceil(lineH / sin / band - 1e-9)), topGap = c.fontPx * 0.25;
    let extent = 0;
    const placed = [];
    for (let i = 0; i < count; i += n) {
      const { text, width } = labels[i], cx = plot.x + (i + 0.5) * band;
      if (cx - width * cos - lineH * sin / 2 < rotatedMinX - 1e-6) return null;
      extent = Math.max(extent, width * sin + lineH * cos);
      placed.push({ i, text, width, lines: 1, cx, truncated: false });
    }
    const reserve = Math.max(c.lineHeight, topGap + extent);
    return reserve > maxReserve + 1e-6 ? null : { angle, n, reserve, labels: placed, topGap };
  };
  const options = [plain, rotated(45), rotated(90)].filter(Boolean);
  return options.find((option) => option.n === 1) ?? options.reduce((best, option) => option.n < best.n ? option : best);
}

// Lay out the plot for a horizontal category axis. `geometry(reserve)` returns
// { plot, ...whatever else depends on the height }, the plot leaving `reserve`
// under it for the labels; rotated labels shrink the plot as Office does.
function planCategoryAxis(c, entries, geometry) {
  const cap = Math.max(c.lineHeight + c.textHeight, c.box.height * 0.4);
  const bounds = (plot) => ({ minX: plot.x - c.fontPx * 0.5, maxX: plot.x + plot.width + c.fontPx * 0.5, rotatedMinX: c.box.x + c.pad });
  // The space under the plot only grows (a smaller plot can change the value-tick
  // width and so the band, and the arrangement with it); it stops once the plan
  // fits the space that shaped the plot.
  let reserve = c.lineHeight, axis = geometry(reserve), plan = planBottomLabels(c, entries, axis.plot, cap, bounds(axis.plot));
  for (let pass = 0; pass < 3 && plan.reserve > reserve + 0.5; pass++) {
    reserve = plan.reserve;
    axis = geometry(reserve);
    plan = planBottomLabels(c, entries, axis.plot, cap, bounds(axis.plot));
  }
  if (plan.reserve > reserve + 0.5) plan = planBottomLabels(c, entries, axis.plot, reserve, bounds(axis.plot));
  return { ...axis, plan };
}

function drawBottomLabels(c, plan, plot, entries) {
  const y = plot.y + plot.height, band = plot.width / Math.max(1, entries.length), lineH = c.textHeight;
  for (const label of plan.labels) {
    const path = entries[label.i].path;
    if (plan.angle) {
      // Rotated labels end at their tick (Office -45 / -90 degree text).
      const cos = plan.angle === 90 ? 0 : Math.SQRT1_2;
      const px = label.cx, py = y + plan.topGap + lineH * cos / 2, width = label.width + 2;
      const text = c.textElement(label.text, { x: px - width, y: py - lineH * 0.55, width, height: lineH * 1.1 }, path, "right");
      if (text) c.children.push(c.svg.tag("g", { transform: `rotate(${-plan.angle} ${c.num(px)} ${c.num(py)})` }, text));
      continue;
    }
    const centred = Math.abs(label.left - (label.cx - label.width / 2)) < 1e-6;
    const rect = plan.n === 1 && centred && label.width <= band
      ? { x: plot.x + label.i * band, y, width: band, height: plan.reserve }
      : { x: label.left - 1, y, width: label.width + 2, height: plan.reserve };
    c.text(label.text, rect, path);
  }
  reportTruncatedLabels(c, plan.labels.filter((label) => label.truncated).map((label) => entries[label.i].path));
}

// A vertical category axis (labels to the left of horizontal bars and funnels).
// Labels stay on one line inside the gutter, wrap at spaces onto two lines when
// their rows are tall enough, else are ellipsized; every n-th row is labelled
// when the rows are shorter than a line of text.
function planRowLabels(c, entries, band, gutter) {
  const labels = labelCandidates(c, entries);
  const n = Math.max(1, Math.ceil(c.textHeight / band - 1e-9));
  const canWrap = n * band >= 2 * c.textHeight - 0.01;
  const placed = [];
  for (let i = 0; i < labels.length; i += n) {
    const label = labels[i];
    let text = label.text, truncated = false;
    if (label.width > gutter + 0.01) {
      const two = canWrap ? twoLines(c, label) : null;
      if (two && two.width <= gutter + 0.01) text = two.text;
      else ({ text } = ellipsize(c, label.text, gutter)), truncated = true;
    }
    placed.push({ i, text, truncated });
  }
  return { n, labels: placed };
}

// `rowTop(i)` is the top of category i's row; rows are `band` tall.
function drawRowLabels(c, plan, entries, band, gutter, x, rowTop) {
  const span = plan.n * band;
  for (const label of plan.labels) {
    const middle = rowTop(label.i) + band / 2;
    c.text(label.text, { x, y: middle - span / 2, width: gutter, height: span }, entries[label.i].path, "right");
  }
  reportTruncatedLabels(c, plan.labels.filter((label) => label.truncated).map((label) => entries[label.i].path));
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
  const valueFormat = series[0]?.format;
  const categories = c.rows.map((row) => c.label(row[0]));
  const count = categories.length;
  // Right to left (RR-05): column, line and area charts run their category axis from the right (PowerPoint's reversed categories,
  // c:catAx orientation maxMin), which also puts the value axis at the right. Bar charts keep their vertical category axis.
  const rtl = c.bound.geometry?.direction === "rtl" && !horizontal;
  const categorySlot = (i) => rtl ? count - 1 - i : i;
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
  let plot, scale, valueTickWidth;
  if (horizontal) {
    const categoryWidth = Math.min(box.width * 0.3, Math.max(0, ...categories.map((name) => c.width(flatLabel(name)))) + fontPx * 0.5);
    let x = box.x + pad + categoryWidth + c.pad / 2;
    const bottom = box.y + box.height - pad - c.lineHeight;
    let width = Math.max(1, right - x - fontPx);
    const tickWidth = Math.max(c.width(formatTick(dataMax, percent, valueFormat)), c.width(formatTick(dataMin, percent, valueFormat)), c.width("100%")) + fontPx;
    const scaleFor = (w) => niceScale(dataMin, dataMax, maxIntervalsFor(w, tickWidth), { percent });
    scale = scaleFor(width);
    // RR-54: a formatted value axis keeps its end labels inside the chart.
    if (valueFormat !== undefined && !percent) ({ x, width, scale } = insetForEndLabels(c, x, width, valueFormat, scaleFor));
    plot = { x, y: top, width, height: Math.max(1, bottom - top) };
    // Office bar charts draw the first category nearest the origin (bottom).
    const entries = categories.map((name, i) => ({ name, path: `${c.path}.data.rows.${i}.0` }));
    const rowBand = plot.height / count;
    drawRowLabels(c, planRowLabels(c, entries, rowBand, categoryWidth), entries, rowBand, categoryWidth, box.x + pad, (i) => plot.y + plot.height - (i + 1) * rowBand);
  } else {
    const entries = categories.map((name, i) => ({ name, path: `${c.path}.data.rows.${i}.0` }));
    if (rtl) entries.reverse();
    const axis = planCategoryAxis(c, entries, (reserve) => {
      const height = Math.max(1, box.y + box.height - pad - reserve - top);
      const fitted = niceScale(dataMin, dataMax, maxIntervalsFor(height, c.lineHeight * 1.2), { percent });
      const tickWidth = Math.max(...fitted.ticks.map((tick) => c.width(formatTick(tick, percent, valueFormat)))) + fontPx * 0.5;
      if (rtl) {
        const x = box.x + pad + fontPx / 2;
        return { scale: fitted, plot: { x, y: top, width: Math.max(1, right - tickWidth - x), height }, tickWidth };
      }
      const x = box.x + pad + tickWidth;
      return { scale: fitted, plot: { x, y: top, width: Math.max(1, right - x - fontPx / 2), height } };
    });
    ({ plot, scale } = axis);
    valueTickWidth = axis.tickWidth;
    drawBottomLabels(c, axis.plan, plot, entries);
  }
  c.plotArea = plot;
  const at = (value) => horizontal ? plot.x + axisFraction(value, scale) * plot.width : plot.y + axisFraction(value, scale, true) * plot.height;
  // Category axis crosses at zero when zero is on the axis (autoZero).
  const crossing = at(Math.min(scale.max, Math.max(scale.min, 0)));
  for (const tick of scale.ticks) {
    const position = at(tick), label = formatTick(tick, percent, valueFormat);
    if (horizontal) {
      gridline(c, position, plot.y, position, plot.y + plot.height);
      const width = c.width(label) + fontPx;
      c.text(label, { x: position - width / 2, y: plot.y + plot.height, width, height: c.lineHeight }, c.path);
    } else {
      gridline(c, plot.x, position, plot.x + plot.width, position);
      if (rtl) c.text(label, { x: plot.x + plot.width + fontPx * 0.35, y: position - c.lineHeight / 2, width: Math.max(1, valueTickWidth - fontPx * 0.35), height: c.lineHeight }, c.path, "left");
      else c.text(label, { x: box.x + pad, y: position - c.lineHeight / 2, width: plot.x - box.x - pad - fontPx * 0.35, height: c.lineHeight }, c.path, "right");
    }
  }
  const band = (horizontal ? plot.height : plot.width) / count;
  if (spec.kind === "bar") drawBars(c, spec, series, stacks, { plot, band, at, horizontal, scale, categorySlot });
  else if (spec.kind === "line") drawLines(c, spec, series, stacks, { plot, band, at, categorySlot });
  else drawAreas(c, series, stacks, { plot, band, at, crossing, categorySlot });
  if (horizontal) {
    axisLine(c, crossing, plot.y, crossing, plot.y + plot.height);
    axisLine(c, plot.x, plot.y + plot.height, plot.x + plot.width, plot.y + plot.height);
  } else {
    const valueAxisX = rtl ? plot.x + plot.width : plot.x;
    axisLine(c, valueAxisX, plot.y, valueAxisX, plot.y + plot.height);
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

function drawBars(c, spec, series, stacks, { plot, band, at, horizontal, scale, categorySlot = (i) => i }) {
  // Bars grow from zero, or from the axis minimum (maximum, for all-negative data) when zero is off the axis.
  const base = (value) => Math.min(scale.max, Math.max(scale.min, value));
  const geometry = barGeometry(band, series.length, spec.grouping);
  const labels = [];
  series.forEach((s, j) => {
    stacks[j].forEach((point, i) => {
      if (!point) return;
      const color = markColor(c, j, i);
      const slot = geometry.clustered ? j * geometry.width : 0;
      const a = at(base(point.from)), b = at(point.to);
      const path = `${c.path}.data.rows.${i}.${s.column}`;
      let rect;
      if (horizontal) {
        // Office bar charts draw the first category and first series nearest the origin (bottom).
        const y = plot.y + plot.height - i * band - geometry.offset - slot - geometry.width;
        rect = { x: Math.min(a, b), y, width: Math.abs(b - a), height: geometry.width };
        c.mark("rect", { ...rect, fill: color }, path);
      } else {
        const x = plot.x + categorySlot(i) * band + geometry.offset + slot;
        rect = { x, y: Math.min(a, b), width: geometry.width, height: Math.abs(b - a) };
        c.mark("rect", { ...rect, fill: color }, path);
      }
      if (c.dataLabels) labels.push({ rect, direction: horizontal ? (point.to >= point.from ? "right" : "left") : (point.to >= point.from ? "up" : "down"), path, color, text: labelString(c, { category: c.rows[i][0] === null || c.rows[i][0] === undefined ? "" : String(c.rows[i][0]), value: s.values[i], format: s.format }) });
    });
  });
  // RR-35: data labels sit on top of every bar.
  for (const label of labels) drawBarLabel(c, label.text, label.rect, label.direction, label.path, label.color);
}

function drawLines(c, spec, series, stacks, { plot, band, at, categorySlot = (i) => i }) {
  const radius = 3 * c.pt;
  for (let j = 0; j < series.length; j++) {
    const s = series[j], color = seriesColor(c, j);
    let run = [];
    const flush = () => {
      if (run.length > 1) c.mark("polyline", { points: run.map(([x, y]) => `${c.num(x)},${c.num(y)}`).join(" "), fill: "none", stroke: color, "stroke-width": 2 * c.pt, "stroke-linejoin": "round", "stroke-linecap": "round" }, `${c.path}.data.columns.${s.column}`);
      run = [];
    };
    stacks[j].forEach((point, i) => {
      if (!point) { flush(); return; }
      run.push([plot.x + (categorySlot(i) + 0.5) * band, at(point.to)]);
    });
    flush();
    // FA-14: with a highlight each point takes its own colour, and a line without markers marks the highlighted categories' points.
    if (spec.markers || c.highlight?.categories.some(Boolean)) stacks[j].forEach((point, i) => {
      if (!point || (!spec.markers && !c.highlight.categories[i])) return;
      const fill = markColor(c, j, i);
      c.mark("circle", { cx: plot.x + (categorySlot(i) + 0.5) * band, cy: at(point.to), r: radius, fill, stroke: fill, "stroke-width": 0.75 * c.pt }, `${c.path}.data.rows.${i}.${s.column}`);
    });
  }
  // RR-35: data labels sit beside each point, over every line.
  if (c.dataLabels) series.forEach((s, j) => stacks[j].forEach((point, i) => {
    if (point) drawPointLabel(c, labelString(c, { category: c.rows[i][0] === null || c.rows[i][0] === undefined ? "" : String(c.rows[i][0]), value: s.values[i], format: s.format }), [plot.x + (i + 0.5) * band, at(point.to)], `${c.path}.data.rows.${i}.${s.column}`);
  }));
}

function drawAreas(c, series, stacks, { plot, band, at, crossing, categorySlot = (i) => i }) {
  for (let j = 0; j < series.length; j++) {
    const s = series[j];
    const points = stacks[j].map((point, i) => ({ x: plot.x + (categorySlot(i) + 0.5) * band, from: point.from, to: point.to }));
    const upper = points.map((p) => `${c.num(p.x)} ${c.num(at(p.to))}`);
    const lower = points.slice().reverse().map((p) => `${c.num(p.x)} ${c.num(p.from === 0 ? crossing : at(p.from))}`);
    c.mark("path", { d: `M ${upper.join(" L ")} L ${lower.join(" L ")} Z`, fill: seriesColor(c, j) }, `${c.path}.data.columns.${s.column}`);
  }
  // RR-35: an area's label sits in the area at each category, halfway between its lower and upper edge.
  if (c.dataLabels) series.forEach((s, j) => stacks[j].forEach((point, i) => {
    if (!point) return;
    const lowerEdge = point.from === 0 ? crossing : at(point.from);
    drawCenteredLabel(c, labelString(c, { category: c.rows[i][0] === null || c.rows[i][0] === undefined ? "" : String(c.rows[i][0]), value: s.values[i], format: s.format }), plot.x + (i + 0.5) * band, (lowerEdge + at(point.to)) / 2, `${c.path}.data.rows.${i}.${s.column}`, seriesColor(c, j));
  }));
}

// ---------------------------------------------------------------------------
// Combo (FA-15): clustered columns and line series with markers in one plot. Core's resolveChartData orders the series
// (column series first, then lines) and says which lines use the secondary value axis. That axis sits at the right (the left,
// right to left) with its own scale and its tick labels in the first secondary series' number format; the gridlines follow
// the primary axis, whose ticks take the first column series' format. The PPTX export writes the same plan natively.

/** The combo plan of a chart: core's, or (a core without it) every series a column except the last, a line, all on the primary axis. */
function comboPlan(c, series) {
  if (Array.isArray(c.combo) && c.combo.length === series.length) return c.combo;
  return series.map((_, index) => ({ role: series.length > 1 && index === series.length - 1 ? "line" : "bar", axis: "primary" }));
}

/** Legend entries in series order: a square key for a column series, a line with a marker for a line series. */
function comboLegendEntries(c, series) {
  const plan = comboPlan(c, series);
  return series.map((s, index) => ({ name: s.name, color: c.colors[s.index % c.colors.length], path: `${c.path}.data.columns.${s.column}`, ...(plan[index].role === "line" ? { key: "line", marker: true } : {}) }));
}

function renderComboChart(c, spec) {
  const { box, pad, fontPx } = c;
  const series = c.series();
  const plan = comboPlan(c, series);
  const bars = series.filter((_, index) => plan[index].role === "bar");
  const lines = series.filter((_, index) => plan[index].role === "line");
  const onSecondary = (s) => plan[s.index].axis === "secondary";
  const primaryLines = lines.filter((s) => !onSecondary(s)), secondaryLines = lines.filter(onSecondary);
  const categories = c.rows.map((row) => c.label(row[0]));
  const count = categories.length;
  // Right to left (RR-05): the categories run from the right, the primary value axis moves to the right and the secondary one to the left.
  const rtl = c.bound.geometry?.direction === "rtl";
  const categorySlot = (i) => rtl ? count - 1 - i : i;
  const extent = (list) => {
    const values = list.flatMap((s) => s.values).filter((value) => value !== null);
    return values.length ? [Math.min(...values), Math.max(...values)] : [0, 1];
  };
  const [primaryMin, primaryMax] = extent([...bars, ...primaryLines]);
  const [secondaryMin, secondaryMax] = extent(secondaryLines);
  const primaryFormat = (bars[0] ?? primaryLines[0])?.format, secondaryFormat = secondaryLines[0]?.format;
  // The default legend sits at the far right, outside a right axis title (the secondary axis title, or right to left the primary
  // one), as PowerPoint places it: the legend is laid out against the box before the title band was carved, and the title moves in.
  const rightTitle = c.axisTitleBands?.some((band) => band.side === "right") && !c.legendManaged;
  let legendWidth = 0;
  if (series.length > 1) {
    const inner = c.box;
    if (rightTitle) c.box = { ...inner, width: inner.width + c.lineHeight };
    legendWidth = legendEntries(c, comboLegendEntries(c, series));
    c.box = inner;
    if (rightTitle) c.axisTitleRightInset = legendWidth + c.pad / 2;
  }
  const right = box.x + box.width - pad - legendWidth;
  const top = box.y + pad + c.lineHeight / 2;
  const entries = categories.map((name, i) => ({ name, path: `${c.path}.data.rows.${i}.0` }));
  if (rtl) entries.reverse();
  const tickWidthOf = (scale, format) => Math.max(...scale.ticks.map((tick) => c.width(formatTick(tick, false, format)))) + fontPx * 0.5;
  const axis = planCategoryAxis(c, entries, (reserve) => {
    const height = Math.max(1, box.y + box.height - pad - reserve - top);
    const intervals = maxIntervalsFor(height, c.lineHeight * 1.2);
    const scale = niceScale(primaryMin, primaryMax, intervals);
    const secondary = secondaryLines.length ? niceScale(secondaryMin, secondaryMax, intervals) : null;
    const primaryWidth = tickWidthOf(scale, primaryFormat), secondaryWidth = secondary ? tickWidthOf(secondary, secondaryFormat) : 0;
    const leftWidth = rtl ? secondaryWidth : primaryWidth, rightWidth = rtl ? primaryWidth : secondaryWidth;
    const x = box.x + pad + (leftWidth || fontPx / 2);
    const plotRight = right - (rightWidth || fontPx / 2);
    return { scale, secondary, primaryWidth, secondaryWidth, plot: { x, y: top, width: Math.max(1, plotRight - x), height } };
  });
  const { plot, scale, secondary } = axis;
  drawBottomLabels(c, axis.plan, plot, entries);
  c.plotArea = plot;
  const valueAt = (axisScale) => (value) => plot.y + axisFraction(value, axisScale, true) * plot.height;
  const at = valueAt(scale), atSecondary = secondary ? valueAt(secondary) : at;
  const crossing = at(Math.min(scale.max, Math.max(scale.min, 0)));
  const tickLabel = (label, position, side, width) => side === "left"
    ? c.text(label, { x: box.x + pad, y: position - c.lineHeight / 2, width: Math.max(1, plot.x - box.x - pad - fontPx * 0.35), height: c.lineHeight }, c.path, "right")
    : c.text(label, { x: plot.x + plot.width + fontPx * 0.35, y: position - c.lineHeight / 2, width: Math.max(1, width - fontPx * 0.35), height: c.lineHeight }, c.path, "left");
  for (const tick of scale.ticks) {
    const position = at(tick);
    gridline(c, plot.x, position, plot.x + plot.width, position);
    tickLabel(formatTick(tick, false, primaryFormat), position, rtl ? "right" : "left", axis.primaryWidth);
  }
  if (secondary) for (const tick of secondary.ticks) tickLabel(formatTick(tick, false, secondaryFormat), atSecondary(tick), rtl ? "left" : "right", axis.secondaryWidth);
  const band = plot.width / count;
  // Column series come first in core's order, so a column's palette index is its series index.
  if (bars.length) drawBars(c, spec, bars, stackCategoryValues(bars, count, "bar", "clustered", c.path), { plot, band, at, horizontal: false, scale, categorySlot });
  const point = (s, i, value) => [plot.x + (categorySlot(i) + 0.5) * band, (onSecondary(s) ? atSecondary : at)(value)];
  const radius = 3 * c.pt;
  for (const s of lines) {
    const color = c.colors[s.index % c.colors.length];
    let run = [];
    const flush = () => {
      if (run.length > 1) c.mark("polyline", { points: run.map(([x, y]) => `${c.num(x)},${c.num(y)}`).join(" "), fill: "none", stroke: color, "stroke-width": 2 * c.pt, "stroke-linejoin": "round", "stroke-linecap": "round" }, `${c.path}.data.columns.${s.column}`);
      run = [];
    };
    s.values.forEach((value, i) => { if (value === null) flush(); else run.push(point(s, i, value)); });
    flush();
    s.values.forEach((value, i) => {
      if (value === null) return;
      const [cx, cy] = point(s, i, value);
      c.mark("circle", { cx, cy, r: radius, fill: color, stroke: color, "stroke-width": 0.75 * c.pt }, `${c.path}.data.rows.${i}.${s.column}`);
    });
  }
  // Line labels sit beside each point at the combo's line position (core: above unless a point position was asked for).
  if (c.dataLabels) for (const s of lines) s.values.forEach((value, i) => {
    if (value === null) return;
    const category = c.rows[i][0] === null || c.rows[i][0] === undefined ? "" : String(c.rows[i][0]);
    drawPointLabel(c, labelString(c, { category, value, format: s.format }), point(s, i, value), `${c.path}.data.rows.${i}.${s.column}`, c.dataLabels.linePosition ?? "above");
  });
  const primaryX = rtl ? plot.x + plot.width : plot.x, secondaryX = rtl ? plot.x : plot.x + plot.width;
  axisLine(c, primaryX, plot.y, primaryX, plot.y + plot.height);
  if (secondary) axisLine(c, secondaryX, plot.y, secondaryX, plot.y + plot.height);
  axisLine(c, plot.x, crossing, plot.x + plot.width, crossing);
}

// ---------------------------------------------------------------------------
// Pie and doughnut: first series only, clockwise from 12 o'clock, one colour per category.

function renderCircularChart(c, spec) {
  const { box, pad } = c;
  const categories = c.rows.map((row) => c.label(row[0]));
  const values = c.rows.map((row) => Math.abs(chartNumber(row[1]) ?? 0));
  const legendWidth = legendEntries(c, categories.map((name, i) => ({
    name, color: sliceColor(c, i), path: `${c.path}.data.rows.${i}.0`
  })));
  const area = { x: box.x + pad, y: box.y + pad, width: Math.max(1, box.width - 2 * pad - legendWidth), height: Math.max(1, box.height - 2 * pad) };
  const cx = area.x + area.width / 2, cy = area.y + area.height / 2;
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total)) throw chartAggregateError(c.path, "slice total");
  // RR-35: a slice's label text (category, the signed value, the share of the total); outside-end labels shrink the pie to leave room.
  const sliceTexts = c.dataLabels ? values.map((value, i) => labelString(c, { category: categories[i], value: chartNumber(c.rows[i][1]) ?? 0, share: total ? value / total : 0, format: c.formats[1] })) : null;
  const outside = sliceTexts && spec.kind === "pie" && (c.dataLabels.position ?? "outside-end") === "outside-end";
  const reserve = outside ? outsideLabelReserve(c, sliceTexts) : { x: 0, y: 0 };
  const r = outside ? Math.max(1, Math.min(area.width / 2 - reserve.x, area.height / 2 - reserve.y)) : Math.max(1, Math.min(area.width, area.height) / 2 * 0.9);
  const inner = spec.kind === "doughnut" ? r * 0.5 : 0;
  if (!total) {
    c.text("No positive chart values", area, c.path);
    return;
  }
  const border = { stroke: "#F9F9F9", "stroke-width": 0.75 * c.pt };
  let angle = -Math.PI / 2;
  values.forEach((value, i) => {
    const delta = value / total * Math.PI * 2, end = angle + delta;
    const fill = sliceColor(c, i), path = `${c.path}.data.rows.${i}.1`;
    if (delta >= Math.PI * 2 - 1e-9) {
      if (inner) c.mark("path", { d: `${circlePath(c, cx, cy, r)} ${circlePath(c, cx, cy, inner)}`, fill, "fill-rule": "evenodd", ...border }, path);
      else c.mark("circle", { cx, cy, r, fill, ...border }, path);
    } else if (delta > 0) {
      c.mark("path", { d: slicePath(c, cx, cy, r, inner, angle, end), fill, ...border }, path);
    }
    angle = end;
  });
  if (sliceTexts) {
    let start = -Math.PI / 2;
    values.forEach((value, i) => {
      const delta = value / total * Math.PI * 2;
      if (delta > 0) drawSliceLabel(c, sliceTexts[i], { cx, cy, r, inner, mid: start + delta / 2 }, `${c.path}.data.rows.${i}.1`, sliceColor(c, i));
      start += delta;
    });
  }
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

export function scatterSeries(rows, columns, formats = []) {
  const numericX = columns.length > 2;
  const xs = rows.map((row, i) => numericX ? chartNumber(row[1]) : i + 1);
  const first = numericX ? 2 : 1;
  const series = columns.slice(first).map((name, offset) => ({
    name: name === null || name === undefined ? "" : String(name), column: first + offset, index: offset,
    ...(formats[first + offset] !== undefined ? { format: formats[first + offset] } : {}),
    points: rows.map((row, i) => ({ row: i, x: xs[i], y: chartNumber(row[first + offset]) })).filter((p) => p.x !== null && p.y !== null)
  }));
  return { series, xs };
}

function renderScatterChart(c) {
  const { box, pad, fontPx } = c;
  const { series } = scatterSeries(c.rows, c.columns, c.formats);
  const yFormat = series[0]?.format, xFormat = c.columns.length > 2 ? c.formats[1] : undefined;
  const points = series.flatMap((s) => s.points);
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const legendWidth = seriesLegend(c, series, "marker");
  const top = box.y + pad + c.lineHeight / 2, bottom = box.y + box.height - pad - c.lineHeight;
  const height = Math.max(1, bottom - top);
  const yScale = niceScale(ys.length ? Math.min(...ys) : 0, ys.length ? Math.max(...ys) : 1, maxIntervalsFor(height, c.lineHeight * 1.2));
  const tickWidth = Math.max(...yScale.ticks.map((tick) => c.width(formatTick(tick, false, yFormat)))) + fontPx * 0.5;
  const plot = { x: box.x + pad + tickWidth, y: top, height };
  plot.width = Math.max(1, box.x + box.width - pad - legendWidth - fontPx - plot.x);
  const xLabelWidth = Math.max(c.width(formatTick(xs.length ? Math.max(...xs) : 1, false, xFormat)), c.width(formatTick(xs.length ? Math.min(...xs) : 0, false, xFormat))) + fontPx;
  const scaleForX = (w) => niceScale(xs.length ? Math.min(...xs) : 0, xs.length ? Math.max(...xs) : 1, maxIntervalsFor(w, xLabelWidth));
  let xScale = scaleForX(plot.width);
  // RR-54: a formatted X axis keeps its end labels inside the chart.
  if (xFormat !== undefined) ({ x: plot.x, width: plot.width, scale: xScale } = insetForEndLabels(c, plot.x, plot.width, xFormat, scaleForX));
  c.plotArea = plot;
  const xAt = (v) => plot.x + axisFraction(v, xScale) * plot.width;
  const yAt = (v) => plot.y + axisFraction(v, yScale, true) * plot.height;
  for (const tick of yScale.ticks) {
    const y = yAt(tick);
    gridline(c, plot.x, y, plot.x + plot.width, y);
    c.text(formatTick(tick, false, yFormat), { x: box.x + pad, y: y - c.lineHeight / 2, width: plot.x - box.x - pad - fontPx * 0.35, height: c.lineHeight }, c.path, "right");
  }
  for (const tick of xScale.ticks) {
    const label = formatTick(tick, false, xFormat), width = c.width(label) + fontPx;
    c.text(label, { x: xAt(tick) - width / 2, y: plot.y + plot.height, width, height: c.lineHeight }, c.path);
  }
  const yCross = yAt(Math.min(yScale.max, Math.max(yScale.min, 0))), xCross = xAt(Math.min(xScale.max, Math.max(xScale.min, 0)));
  axisLine(c, xCross, plot.y, xCross, plot.y + plot.height);
  axisLine(c, plot.x, yCross, plot.x + plot.width, yCross);
  for (let j = 0; j < series.length; j++) {
    const s = series[j], color = seriesColor(c, j);
    for (const point of s.points) c.mark("circle", { cx: xAt(point.x), cy: yAt(point.y), r: 3 * c.pt, fill: color, stroke: color, "stroke-width": 0.75 * c.pt }, `${c.path}.data.rows.${point.row}.${s.column}`);
  }
  // RR-35: a scatter label shows the Y value, and the X value as its category.
  if (c.dataLabels) series.forEach((s) => {
    for (const point of s.points) drawPointLabel(c, labelString(c, { category: formatChartValue(point.x, xFormat), value: point.y, format: s.format }), [xAt(point.x), yAt(point.y)], `${c.path}.data.rows.${point.row}.${s.column}`);
  });
}

// ---------------------------------------------------------------------------
// Radar: categories clockwise from 12 o'clock, value axis on the vertical spoke.

function renderRadarChart(c, spec) {
  const { box, pad, fontPx } = c;
  const series = c.series();
  const valueFormat = series[0]?.format;
  const categories = c.rows.map((row) => c.label(row[0]));
  const count = categories.length;
  const values = series.flatMap((s) => s.values).filter((v) => v !== null);
  const legendWidth = seriesLegend(c, series, spec.style === "filled" ? undefined : "line", spec.markers);
  const labelWidth = Math.min(box.width * 0.2, Math.max(0, ...categories.map((name) => c.width(flatLabel(name)))) + fontPx * 0.5);
  // Spoke labels follow the same rules as other category labels (never broken
  // inside a word; one line, two lines at spaces, or an ellipsis). A chart with
  // two-line spoke labels keeps room for the second line above and below.
  const spokeLabels = labelCandidates(c, categories.map((name, i) => ({ name, path: `${c.path}.data.rows.${i}.0` })));
  const wraps = spokeLabels.some((label) => label.width > labelWidth + 0.01 && (twoLines(c, label)?.width ?? Infinity) <= labelWidth + 0.01);
  const area = { x: box.x + pad, y: box.y + pad, width: Math.max(1, box.width - 2 * pad - legendWidth), height: Math.max(1, box.height - 2 * pad) };
  const cx = area.x + area.width / 2, cy = area.y + area.height / 2;
  const radius = Math.max(1, Math.min(area.width / 2 - labelWidth, area.height / 2 - c.lineHeight - (wraps ? c.textHeight : 0)));
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
  // A spoke label that would collide with one already drawn is left out; the first is always kept.
  const drawn = [], truncated = [];
  categories.forEach((name, i) => {
    const [x, y] = polar(cx, cy, radius, angle(i));
    axisLine(c, cx, cy, x, y);
    const [lx, ly] = polar(cx, cy, radius + fontPx * 0.4, angle(i));
    const cos = Math.cos(angle(i)), sin = Math.sin(angle(i));
    const align = Math.abs(cos) < 0.2 ? "center" : cos > 0 ? "left" : "right";
    const label = spokeLabels[i];
    let { text, width } = label, lines = 1, shortened = false;
    if (width > labelWidth + 0.01) {
      const two = twoLines(c, label);
      if (two && two.width <= labelWidth + 0.01) ({ text, width } = two), lines = 2;
      else ({ text, width } = ellipsize(c, label.text, labelWidth)), lines = 1, shortened = true;
    }
    const height = c.lineHeight + (lines - 1) * c.textHeight;
    const rect = {
      x: align === "center" ? lx - labelWidth / 2 : align === "left" ? lx : lx - labelWidth,
      y: Math.abs(sin) < 0.2 ? ly - height / 2 : sin < 0 ? ly - height : ly,
      width: labelWidth, height
    };
    const left = align === "center" ? rect.x + (labelWidth - width) / 2 : align === "left" ? rect.x : rect.x + labelWidth - width;
    const ink = { left, right: left + width, top: rect.y + (height - lines * c.textHeight) / 2, bottom: rect.y + (height + lines * c.textHeight) / 2 };
    const gap = c.labelGap;
    if (drawn.some((other) => ink.left < other.right + gap && other.left < ink.right + gap && ink.top < other.bottom && other.top < ink.bottom)) {
      return;
    }
    if (shortened) truncated.push(label.path);
    drawn.push(ink);
    c.text(text, rect, label.path, align);
  });
  reportTruncatedLabels(c, truncated);
  for (let j = 0; j < series.length; j++) {
    const s = series[j], color = seriesColor(c, j), path = `${c.path}.data.columns.${s.column}`;
    if (spec.style === "filled") {
      const outline = s.values.map((v, i) => point(i, v ?? scale.min).map(n).join(" "));
      c.mark("path", { d: `M ${outline.join(" L ")} Z`, fill: color }, path);
      continue;
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
  }
  // Value axis labels sit on top of filled series, as in PowerPoint.
  for (const tick of scale.ticks) {
    const label = formatTick(tick, false, valueFormat), width = c.width(label) + fontPx * 0.5;
    c.text(label, { x: cx - width - fontPx * 0.2, y: cy - rAt(tick) - c.lineHeight / 2, width, height: c.lineHeight }, c.path, "right");
  }
  // RR-35: radar data labels sit above each point (PowerPoint has no position choice for a radar).
  if (c.dataLabels) series.forEach((s) => s.values.forEach((v, i) => {
    if (v !== null) drawPointLabel(c, labelString(c, { category: categories[i], value: v, format: s.format }), point(i, v), `${c.path}.data.rows.${i}.${s.column}`);
  }));
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
  const tickWidth = Math.max(0, ...tickLabels.map((label) => c.width(label))) + fontPx * 0.5;
  const x = box.x + pad + tickWidth;
  const right = box.x + box.width - pad - legendWidth - (percentAxis ? c.width("100%") + fontPx : fontPx / 2);
  const { plot, plan } = planCategoryAxis(c, categories, (reserve) => ({
    plot: { x, y: top, width: Math.max(1, right - x), height: Math.max(1, box.y + box.height - pad - reserve - top) }
  }));
  drawBottomLabels(c, plan, plot, categories);
  c.plotArea = plot;
  return { plot, band: plot.width / Math.max(1, categories.length) };
}

function valueAxis(c, plot, scale, format) {
  const at = (value) => plot.y + axisFraction(value, scale, true) * plot.height;
  for (const tick of scale.ticks) {
    const y = at(tick);
    gridline(c, plot.x, y, plot.x + plot.width, y);
    c.text(formatTick(tick, false, format), { x: c.box.x + c.pad, y: y - c.lineHeight / 2, width: plot.x - c.box.x - c.pad - c.fontPx * 0.35, height: c.lineHeight }, c.path, "right");
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
  // A histogram of a lone column plots bin counts, which carry no number format; with categories the bars are the column's values.
  const format = hasCategories ? c.formats[column] : undefined;
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
  const { plot, band } = chartexPlot(c, { categories: bars.map((bar) => ({ name: bar.name, path: bar.labelPath })), tickLabels: probe.ticks.map((tick) => formatTick(tick, false, format)), percentAxis: pareto });
  const scale = niceScale(dataMin, dataMax, maxIntervalsFor(plot.height, c.lineHeight * 1.2));
  const { at, crossing } = valueAxis(c, plot, scale, format);
  const width = band / 1.06, offset = (band - width) / 2;
  bars.forEach((bar, i) => {
    const y = at(bar.value);
    c.mark("rect", { x: plot.x + i * band + offset, y: Math.min(y, crossing), width, height: Math.abs(crossing - y), fill: c.colors[0] }, bar.path);
  });
  // RR-35: data labels on the columns (a histogram label is the bin's count).
  if (c.dataLabels) bars.forEach((bar, i) => {
    const y = at(bar.value);
    drawBarLabel(c, labelString(c, { category: bar.name, value: bar.value, format }), { x: plot.x + i * band + offset, y: Math.min(y, crossing), width, height: Math.abs(crossing - y) }, bar.value >= 0 ? "up" : "down", bar.path, c.colors[0]);
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
  const format = c.formats[column];
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
  const { plot, band } = chartexPlot(c, { categories: categories.map((name, i) => ({ name, path: `${c.path}.data.rows.${i}.0` })), tickLabels: probe.ticks.map((tick) => formatTick(tick, false, format)) });
  const scale = niceScale(dataMin, dataMax, maxIntervalsFor(plot.height, c.lineHeight * 1.2));
  const { at } = valueAxis(c, plot, scale, format);
  const width = band / 1.5, offset = (band - width) / 2;
  bars.forEach((bar, k) => {
    const a = at(bar.from), b = at(bar.to);
    const x = plot.x + bar.i * band + offset;
    c.mark("rect", { x, y: Math.min(a, b), width, height: Math.abs(b - a), fill: c.colors[bar.value < 0 ? 1 : 0] }, `${c.path}.data.rows.${bar.i}.${column}`);
    const next = bars[k + 1];
    if (next) c.mark("line", { x1: x + width, y1: b, x2: plot.x + next.i * band + offset, y2: b, stroke: c.axisColor, "stroke-width": c.pt });
  });
  // RR-35: data labels show each step's value (not the running total) on the floating bars.
  if (c.dataLabels) bars.forEach((bar) => {
    const a = at(bar.from), b = at(bar.to);
    drawBarLabel(c, labelString(c, { category: categories[bar.i], value: bar.value, format }), { x: plot.x + bar.i * band + offset, y: Math.min(a, b), width, height: Math.abs(b - a) }, bar.value >= 0 ? "up" : "down", `${c.path}.data.rows.${bar.i}.${column}`, c.colors[bar.value < 0 ? 1 : 0]);
  });
}

// Funnel: centred bars from the top, widths proportional to the value, value labels inside and category labels on the left.
function renderFunnelChart(c) {
  const { box, pad, fontPx } = c;
  const { column, values, categories } = chartexValues(c.rows, c.columns);
  const format = c.formats[column];
  const count = categories.length;
  const max = Math.max(0, ...values.filter((value) => value !== null));
  const labelWidth = Math.min(box.width * 0.3, Math.max(0, ...categories.map((name) => c.width(flatLabel(name)))) + fontPx * 0.5);
  const plot = { x: box.x + pad + labelWidth + pad / 2, y: box.y + pad, width: Math.max(1, box.width - 2 * pad - labelWidth - pad / 2), height: Math.max(1, box.height - 2 * pad) };
  c.plotArea = plot;
  const band = plot.height / count, height = band / 1.06, offset = (band - height) / 2;
  const entries = categories.map((name, i) => ({ name, path: `${c.path}.data.rows.${i}.0` }));
  drawRowLabels(c, planRowLabels(c, entries, band, labelWidth), entries, band, labelWidth, box.x + pad, (i) => plot.y + i * band);
  categories.forEach((name, i) => {
    const y = plot.y + i * band;
    const value = values[i];
    if (value === null || !(max > 0) || value <= 0) return;
    const width = plot.width * Math.min(1, value / max);
    const x = plot.x + (plot.width - width) / 2;
    c.mark("rect", { x, y: y + offset, width, height, fill: c.colors[0] }, `${c.path}.data.rows.${i}.${column}`);
    // RR-35: the funnel labels its bars with values by default; dataLabels picks the content, false removes them.
    if (c.dataLabelsOff) return;
    c.text(c.dataLabels ? labelString(c, { category: name, value, format }) : formatTick(value, false, format), { x: plot.x, y: y + offset, width: plot.width, height }, `${c.path}.data.rows.${i}.${column}`);
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
  const format = c.formats[column];
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
    // RR-35: the treemap labels its tiles with category names by default; dataLabels picks the content, false removes them. PowerPoint
    // draws the label at the bottom left of its tile whatever the position attribute says (native check 2026-10-01), so the preview does.
    if (!c.dataLabelsOff && rect.width >= fontPx * 2 && rect.height >= c.lineHeight) {
      c.text(c.dataLabels ? labelString(c, { category: categories[i], value: values[i], format }) : categories[i], { x: rect.x + fontPx * 0.25, y: rect.y + rect.height - c.lineHeight - fontPx * 0.2, width: rect.width - fontPx * 0.5, height: c.lineHeight }, `${c.path}.data.rows.${i}.0`, "left");
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
  const series = lone ? [{ name: c.label(c.columns[0]), column: 0, index: 0, ...(c.formats[0] !== undefined ? { format: c.formats[0] } : {}), values: c.rows.map((row) => chartNumber(row[0])) }] : c.series();
  const format = series[0]?.format;
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
  const { plot, band } = chartexPlot(c, { categories: groups.map((group) => ({ name: group.name, path: lone ? c.path : `${c.path}.data.rows.${group.first}.0` })), legendWidth, tickLabels: probe.ticks.map((tick) => formatTick(tick, false, format)) });
  const scale = niceScale(dataMin, dataMax, maxIntervalsFor(plot.height, c.lineHeight * 1.2));
  const { at } = valueAxis(c, plot, scale, format);
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
  const format = c.formats[column];
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
      if (value !== null) c.text(formatTick(value, false, format), { ...inset, y: y + tileHeight / 2, height: c.lineHeight }, `${c.path}.data.rows.${i}.${column}`);
    } else if (tileHeight >= c.lineHeight) {
      c.text(name, { ...inset, y: y + (tileHeight - c.lineHeight) / 2, height: c.lineHeight }, `${c.path}.data.rows.${i}.0`);
    }
  });
}
