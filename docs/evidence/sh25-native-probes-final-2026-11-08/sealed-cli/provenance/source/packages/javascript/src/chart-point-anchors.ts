// SH-25: source-backed point identities; geometry is composed separately from the actual shared plot.
import { chartNumber, resolveChartData, type ResolvedChartData } from './chart-data.js';
import { chartDrawPlan, type ChartDrawPlan } from './chart-fallback.js';
import { chartAxisFraction, chartTextSize, stackCategoryValues } from './chart-axis.js';
import { chartBarGeometry } from './chart-layer.js';
import { chartPlotInset, type ChartPlotGeometry } from './chart-plot.js';
import { horizontalBarPlot } from './chart-marks.js';
import { chartOptionTarget, resolveChartOptions } from './chart-options.js';
import type { ComposedChart, LayoutBox } from './composition.js';
export type ChartPointKey = string | number;
export interface ChartPointReference {
    point: ChartPointKey;
    series?: ChartPointKey;
}
export interface ChartPointSelection {
    ok: true;
    type: string;
    row: number;
    series: number;
    column: number;
    value: number;
    plan: ChartDrawPlan;
    data: Extract<ResolvedChartData, {
        ok: true;
    }>;
}
export interface ChartPointMissing {
    ok: false;
    field: 'point' | 'series';
    reason: string;
}
export type ChartPointResult = ChartPointSelection | ChartPointMissing;
const CLASSIC = new Set(['column', 'stacked-column', '100pct-stacked-column', 'bar', 'stacked-bar', '100pct-stacked-bar', 'line', 'line-with-markers', 'stacked-line', 'stacked-line-with-markers', 'area', 'stacked-area', '100pct-stacked-area', 'scatter', 'pie', 'doughnut']);
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const label = (value: unknown) => value === null || value === undefined ? '' : String(value);
const missing = (field: ChartPointMissing['field'], reason: string): ChartPointMissing => ({ ok: false, field, reason });
function indexOf(key: unknown, names: readonly string[], field: ChartPointMissing['field']): number | ChartPointMissing {
    if (typeof key === 'number')
        return Number.isSafeInteger(key) && key >= 0 && key < names.length ? key : missing(field, `${field} index ${key} names no plotted ${field === 'series' ? 'series' : 'row'}.`);
    if (typeof key !== 'string' || !key.length)
        return missing(field, `A ${field} reference is a nonempty exact name or zero-based integer index.`);
    const matches = names.flatMap((name, index) => name === key ? [index] : []);
    return matches.length === 1 ? matches[0]! : missing(field, matches.length ? `${field} name '${key}' is ambiguous; use its numeric index.` : `${field} name '${key}' names nothing in the plotted data.`);
}
/** Exact names are resolved against drawn columns/categories. Missing or ambiguous identities are never guessed. */
export function selectChartPoint(chart: unknown, reference: unknown, presentation?: unknown, language?: string): ChartPointResult {
    const value = record(chart), at = record(reference), type = typeof value.type === 'string' ? value.type.trim().toLowerCase() : '';
    if (!CLASSIC.has(type))
        return missing('point', `Chart type '${type || 'unknown'}' has no qualified shared classic point geometry; this anchor is not drawn.`);
    const data = resolveChartData(chart, presentation);
    if (!data.ok)
        return missing('point', 'The chart data does not resolve, so its point anchor is not drawn.');
    const plan = chartDrawPlan(chart, data, { ...(language !== undefined ? { language } : {}) }), first = plan.kind === 'scatter' && plan.hasX ? 2 : 1;
    const series = indexOf(at.series ?? 0, plan.columns.slice(first).map(label), 'series');
    if (typeof series !== 'number')
        return series;
    const row = indexOf(at.point, plan.rows.map(entry => label(entry[0])), 'point');
    if (typeof row !== 'number')
        return row;
    const column = first + series, valueAt = chartNumber(plan.rows[row]?.[column]);
    if (valueAt === null || (plan.kind === 'pie' || plan.kind === 'doughnut') && valueAt === 0)
        return missing('point', 'The referenced row has no visible numeric mark in this series.');
    if (plan.kind === 'scatter' && plan.hasX && chartNumber(plan.rows[row]?.[1]) === null)
        return missing('point', 'The referenced scatter row has no numeric X coordinate.');
    return { ok: true, type: plan.type, row, series, column, value: valueAt, plan, data };
}
export interface ChartPointGeometry {
    ok: true;
    series: number;
    row: number;
    column: number;
    box: LayoutBox;
    position: {
        x: number;
        y: number;
    };
    normal: {
        x: number;
        y: number;
    };
}
/** A source-backed marker in the shared plot. Its plot is pinned in both native export and preview. */
export function chartPointGeometry(chart: unknown, composed: ComposedChart, reference: unknown, geometry: ChartPlotGeometry, presentation?: unknown): ChartPointGeometry | ChartPointMissing {
    const selected = selectChartPoint(chart, reference, presentation, geometry.language);
    if (!selected.ok)
        return selected;
    const at = record(reference), edge = at.edge, plan = selected.plan, type = selected.type;
    if (type === 'scatter')
        return scatterPoint(chart, composed, selected, at, geometry);
    if (type === 'pie' || type === 'doughnut')
        return circularPoint(chart, composed, selected, at, geometry);
    const horizontal = ['bar', 'stacked-bar', '100pct-stacked-bar'].includes(type);
    const kind = type.includes('line') ? 'line' : type.includes('area') ? 'area' : type.includes('column') || horizontal ? 'bar' : undefined;
    if (!kind)
        return missing('point', 'This classic plot has not supplied shared point geometry yet; the anchor is not drawn.');
    const axis = composed.valueAxis;
    if (!axis)
        return missing('point', 'The chart has no finite shared value axis for a native-comparable point.');
    if (composed.layer?.rows)
        return missing('point', 'Table-aligned chart rows are not yet qualified for point anchors; their native category pitch may differ.');
    const drawn = { ...record(chart), type }, data = { ...selected.data, columns: plan.columns, formats: plan.formats, rows: plan.rows };
    const inset = composed.layer?.plot ?? (horizontal ? horizontalBarPlot(drawn, data, composed.layer, axis, geometry.box, geometry) : chartPlotInset(drawn, data, composed, geometry));
    if (!inset)
        return missing('point', 'The chart has no finite shared inner plot for this point.');
    const outer = geometry.box, plot = { x: outer.x + inset.left, y: outer.y + inset.top, width: outer.width - inset.left - inset.right, height: outer.height - inset.top - inset.bottom };
    if (![plot.x, plot.y, plot.width, plot.height].every(Number.isFinite) || plot.width <= 0 || plot.height <= 0)
        return missing('point', 'The shared point plot has no usable space.');
    const grouping = type.startsWith('100pct-') ? 'percentStacked' : type.startsWith('stacked-') ? 'stacked' : kind === 'bar' ? 'clustered' : 'standard';
    const series = plan.columns.slice(1).map((_, index) => ({ values: plan.rows.map(row => chartNumber(row[index + 1])) }));
    let stacks: ReturnType<typeof stackCategoryValues>;
    try {
        stacks = stackCategoryValues(series, plan.rows.length, kind, grouping);
    }
    catch (error) {
        if (error instanceof RangeError)
            return missing('point', error.message);
        throw error;
    }
    const entry = stacks[selected.series]?.[selected.row];
    if (!entry)
        return missing('point', 'The source row has no plotted mark.');
    const count = plan.rows.length, slot = geometry.direction === 'rtl' ? count - 1 - selected.row : selected.row;
    const valueAt = (value: number) => horizontal ? plot.x + chartAxisFraction(value, axis) * plot.width : plot.y + chartAxisFraction(value, axis, true) * plot.height;
    let box: LayoutBox, position: {
        x: number;
        y: number;
    }, normal: {
        x: number;
        y: number;
    };
    if (kind === 'bar') {
        const band = (horizontal ? plot.height : plot.width) / count, bar = chartBarGeometry(band, series.length, grouping), shift = bar.clustered ? selected.series * bar.width : 0;
        const a = valueAt(Math.min(axis.max, Math.max(axis.min, entry.from))), b = valueAt(entry.to), sign = entry.to >= entry.from ? 1 : -1;
        box = horizontal ? { x: Math.min(a, b), y: plot.y + selected.row * band + bar.offset + shift, width: Math.abs(b - a), height: bar.width } : { x: plot.x + slot * band + bar.offset + shift, y: Math.min(a, b), width: bar.width, height: Math.abs(b - a) };
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        if (edge === 'start' || edge === 'end') {
            const end = edge === 'end', value = end ? b : a;
            position = horizontal ? { x: value, y: cy } : { x: cx, y: value };
            normal = horizontal ? { x: (end ? 1 : -1) * sign, y: 0 } : { x: 0, y: (end ? -1 : 1) * sign };
        }
        else if (edge === 'top') {
            position = { x: cx, y: box.y };
            normal = { x: 0, y: -1 };
        }
        else if (edge === 'bottom') {
            position = { x: cx, y: box.y + box.height };
            normal = { x: 0, y: 1 };
        }
        else {
            position = { x: cx, y: cy };
            normal = { x: 0, y: 0 };
        }
    }
    else {
        const across = kind === 'area' && composed.layer?.stack?.edge === true && count >= 2;
        const x = plot.x + (across ? slot * plot.width / (count - 1) : (slot + .5) * plot.width / count), y = valueAt(entry.to), radius = 4 * geometry.scale;
        box = { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 };
        position = { x, y };
        normal = edge === 'top' ? { x: 0, y: -1 } : edge === 'bottom' ? { x: 0, y: 1 } : edge === 'start' ? { x: geometry.direction === 'rtl' ? 1 : -1, y: 0 } : edge === 'end' ? { x: geometry.direction === 'rtl' ? -1 : 1, y: 0 } : { x: 0, y: 0 };
    }
    composed.layer = { ...composed.layer, plot: inset };
    return { ok: true, series: selected.series, row: selected.row, column: selected.column, box, position, normal };
}
const pointNormal = (edge: unknown, rtl: boolean) => edge === 'top' ? { x: 0, y: -1 } : edge === 'bottom' ? { x: 0, y: 1 } : edge === 'start' ? { x: rtl ? 1 : -1, y: 0 } : edge === 'end' ? { x: rtl ? -1 : 1, y: 0 } : { x: 0, y: 0 };
function pointArea(chart: unknown, selected: ChartPointSelection, geometry: ChartPlotGeometry, circular = false): LayoutBox {
    const { box, scale } = geometry, font = chartTextSize({ width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize }) * scale, pad = 10 * scale, line = font * 1.5;
    const options = resolveChartOptions(chart, chartOptionTarget(selected.type)!), names = circular ? selected.plan.rows.map(row => label(row[0])) : selected.plan.columns.slice(selected.plan.hasX ? 2 : 1).map(label);
    let x = box.x + pad, y = box.y + pad, width = box.width - 2 * pad, height = box.height - 2 * pad;
    const legend = options.legend ?? (names.length > 1 ? 'right' : 'none'), legendWidth = Math.min(box.width * .45, font * 1.5 + Math.max(0, ...names.map(text => geometry.measure(text, font)))) + pad;
    if (legend === 'left' || legend === 'right') {
        width -= legendWidth;
        if (legend === 'left')
            x += legendWidth;
    }
    if (legend === 'top' || legend === 'bottom') {
        height -= line + pad;
        if (legend === 'top')
            y += line + pad;
    }
    if (options.axisTitles.value) {
        x += line;
        width -= line;
    }
    if (options.axisTitles.category)
        height -= line;
    return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
}
function pin(composed: ComposedChart, outer: LayoutBox, plot: LayoutBox) { composed.layer = { ...composed.layer, plot: { left: plot.x - outer.x, top: plot.y - outer.y, right: outer.x + outer.width - plot.x - plot.width, bottom: outer.y + outer.height - plot.y - plot.height } }; }
function scatterPoint(chart: unknown, composed: ComposedChart, selected: ChartPointSelection, at: Record<string, unknown>, geometry: ChartPlotGeometry): ChartPointGeometry | ChartPointMissing {
    const axes = composed.layer?.numericAxes;
    if (!axes?.category)
        return missing('point', 'The scatter has no shared finite numeric axes.');
    const { box, scale } = geometry, font = chartTextSize({ width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize }) * scale;
    const area = pointArea(chart, selected, geometry), value = axes.value, category = axes.category;
    // Axis labels stay outside this explicitly pinned inner rectangle; Office and SVG use the same rectangle.
    const ticks = Array.from({ length: Math.round((value.max - value.min) / value.majorUnit) + 1 }, (_, i) => value.min + i * value.majorUnit);
    const gutter = Math.max(font, ...ticks.map(tick => geometry.measure(String(Number(tick.toPrecision(12))), font))) + font * .5;
    const plot = composed.layer?.plot ? { x: box.x + composed.layer.plot.left, y: box.y + composed.layer.plot.top, width: box.width - composed.layer.plot.left - composed.layer.plot.right, height: box.height - composed.layer.plot.top - composed.layer.plot.bottom } : { x: area.x + gutter, y: area.y + font * .75, width: Math.max(1, area.width - gutter - font), height: Math.max(1, area.height - font * 2.25) };
    const xValue = selected.plan.hasX ? chartNumber(selected.plan.rows[selected.row]?.[1])! : selected.row + 1;
    const x = plot.x + chartAxisFraction(xValue, category) * plot.width, y = plot.y + chartAxisFraction(selected.value, value, true) * plot.height, radius = 4 * scale;
    if (![x, y, plot.width, plot.height].every(Number.isFinite))
        return missing('point', 'The scatter point has no finite shared plot coordinate.');
    pin(composed, box, plot);
    return { ok: true, series: selected.series, row: selected.row, column: selected.column, box: { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 }, position: { x, y }, normal: pointNormal(at.edge, geometry.direction === 'rtl') };
}
function circularPoint(chart: unknown, composed: ComposedChart, selected: ChartPointSelection, at: Record<string, unknown>, geometry: ChartPlotGeometry): ChartPointGeometry | ChartPointMissing {
    const values = selected.plan.rows.map(row => Math.abs(chartNumber(row[selected.column]) ?? 0)), total = values.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total) || total <= 0)
        return missing('point', 'The slice total is not finite and positive.');
    const area = composed.layer?.valueList?.pie ?? composed.layer?.doughnut?.pie ?? pointArea(chart, selected, geometry, true), side = Math.min(area.width, area.height);
    const plot = { x: area.x + (area.width - side) / 2, y: area.y + (area.height - side) / 2, width: side, height: side };
    if (![plot.x, plot.y, side].every(Number.isFinite) || side <= 0)
        return missing('point', 'The circular point has no usable shared square.');
    const cx = plot.x + side / 2, cy = plot.y + side / 2, r = side / 2, rings = selected.type === 'doughnut' ? selected.plan.columns.length - 1 : 1, hole = selected.type === 'doughnut' ? r * .5 : 0, thickness = (r - hole) / rings;
    const inner = hole + selected.series * thickness, outer = inner + thickness, start = -Math.PI / 2 + values.slice(0, selected.row).reduce((a, b) => a + b, 0) / total * 2 * Math.PI, end = start + values[selected.row]! / total * 2 * Math.PI, mid = (start + end) / 2;
    const radii = [inner, outer], angles = [start, end, ...[0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 2].filter(angle => angle >= start && angle <= end)], points = radii.flatMap(radius => angles.map(angle => ({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })));
    const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y)), box = { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
    const radius = at.edge === 'start' ? inner : at.edge === 'center' ? (inner + outer) / 2 : outer, radial = { x: Math.cos(mid), y: Math.sin(mid) };
    const position = at.edge === 'top' ? { x: x + box.width / 2, y } : at.edge === 'bottom' ? { x: x + box.width / 2, y: y + box.height } : { x: cx + radius * radial.x, y: cy + radius * radial.y };
    const normal = at.edge === 'top' ? { x: 0, y: -1 } : at.edge === 'bottom' ? { x: 0, y: 1 } : at.edge === 'center' ? { x: 0, y: 0 } : at.edge === 'start' ? { x: -radial.x, y: -radial.y } : radial;
    pin(composed, geometry.box, plot);
    return { ok: true, series: selected.series, row: selected.row, column: selected.column, box, position, normal };
}
