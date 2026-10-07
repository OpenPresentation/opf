// RR-35: chart options in the preview (axis titles, legend position, data labels).
//
// Core owns the normalisation and the per-type support table (`resolveChartOptions`); this module owns the drawing.
// A chart that carries none of the three fields resolves to `active: false` and never reaches any code here, so
// its SVG is exactly what it was before.
import { chartLabelText, formatChartLabelNumber, formatChartLabelPercent, formatDataNumber, resolveChartOptions, textColorForFill } from "@openpresentation/opf/composition";

const INACTIVE = Object.freeze({ active: false, axisTitles: {}, diagnostics: [] });

/**
 * The resolved options of a chart. `spec` is the catalog spec this module's charts.js resolved (`kind`, `grouping`).
 */
export function resolveOptions(chart, spec) {
  if (!chart || typeof chart !== "object") return INACTIVE;
  return resolveChartOptions(chart, { kind: spec.kind, stacked: spec.grouping === "stacked" || spec.grouping === "percentStacked" });
}

export function reportOptionDiagnostics(c, resolved) {
  for (const diagnostic of resolved.diagnostics) {
    c.svg.reportDiagnostic?.({ ...diagnostic, path: `${c.path}.${diagnostic.option}` }, c.options);
  }
}

/**
 * Which edge carries which axis title: the category axis of a bar or funnel chart is vertical (left). A combo chart titles its
 * secondary value axis at the right, next to that axis; right to left, its two value axes trade sides (FA-15).
 */
function titleSides(spec, rtl = false) {
  const verticalCategory = (spec.kind === "bar" && spec.dir === "bar") || spec.kind === "funnel";
  if (spec.kind === "combo") return rtl ? { category: "bottom", value: "right", secondary: "left" } : { category: "bottom", value: "left", secondary: "right" };
  return verticalCategory ? { category: "left", value: "bottom" } : { category: "bottom", value: "left" };
}

/**
 * Carve the axis title bands out of the chart box (the legend is carved first, by charts.js, from the outer edge).
 * The renderers lay the plot out inside `c.box`, so they need no knowledge of the bands.
 */
export function reserveAxisTitles(c, spec, titles) {
  const sides = titleSides(spec, spec.kind === "combo" && c.bound.geometry?.direction === "rtl");
  const bands = { left: 0, bottom: 0, right: 0 };
  c.axisTitleBands = [];
  for (const axis of ["category", "value", "secondary"]) {
    const text = titles[axis];
    // A secondary title is drawn only when the combo chart has a secondary axis (core reports the title it drops).
    if (!text || !sides[axis] || (axis === "secondary" && !c.combo?.some((entry) => entry.axis === "secondary"))) continue;
    const side = sides[axis];
    bands[side] = c.lineHeight;
    c.axisTitleBands.push({ axis, side, text });
  }
  if (!c.axisTitleBands.length) return;
  const outer = c.box;
  c.axisTitleOuter = outer;
  c.box = { x: outer.x + bands.left, y: outer.y, width: Math.max(1, outer.width - bands.left - bands.right), height: Math.max(1, outer.height - bands.bottom) };
}

/**
 * Draw the axis titles after the chart: the bottom title centred under the plot, the left title rotated 270 degrees
 * (reading upwards, as PowerPoint draws a vertical axis title) and centred on the plot. `c.plotArea` is the plot the
 * renderer laid out; without one the title centres on the reserved band.
 */
export function drawAxisTitles(c) {
  if (!c.axisTitleBands?.length) return;
  const outer = c.axisTitleOuter, inner = c.box, plot = c.plotArea;
  for (const { axis, side, text } of c.axisTitleBands) {
    const path = `${c.path}.axisTitles.${axis}`;
    if (side === "bottom") {
      const span = plot ? { x: plot.x, width: plot.width } : { x: inner.x, width: inner.width };
      const rect = { x: span.x, y: outer.y + outer.height - c.lineHeight, width: span.width, height: c.lineHeight };
      c.text(text, rect, path, "center");
    } else {
      const span = plot ? { y: plot.y, height: plot.height } : { y: inner.y, height: inner.height };
      // The rotated text box is laid out horizontally, `length` wide and one line tall, then turned about its centre. A right title
      // (a combo chart's secondary axis) is rotated the same way, as PowerPoint draws every vertical axis title by default.
      const length = Math.max(1, span.height), centreY = span.y + span.height / 2;
      const centreX = side === "right" ? outer.x + outer.width - (c.axisTitleRightInset ?? 0) - c.lineHeight / 2 : outer.x + c.lineHeight / 2;
      const rect = { x: centreX - length / 2, y: centreY - c.lineHeight / 2, width: length, height: c.lineHeight };
      const element = c.textElement(text, rect, path, "center");
      if (element) c.children.push(c.svg.tag("g", { transform: `rotate(-90 ${c.num(centreX)} ${c.num(centreY)})` }, element));
    }
  }
}

// ---------------------------------------------------------------------------
// Data labels

const INSIDE = new Set(["center", "inside-end", "inside-base"]);

/** The label text for one mark: the selected parts, the series' number format (General when it has none), integer percent. */
export function labelString(c, { category, value, share, format }) {
  const labels = c.dataLabels;
  const parts = {};
  if (category !== undefined && category !== null) parts.category = String(category);
  if (typeof value === "number" && Number.isFinite(value)) parts.value = format !== undefined ? formatDataNumber(value, format) : formatChartLabelNumber(value);
  if (typeof share === "number" && Number.isFinite(share)) parts.percent = formatChartLabelPercent(share);
  return chartLabelText(parts, labels.content, labels.separator);
}

const labelSize = (c, text) => ({ width: c.width(text) + c.fontPx * 0.5, height: c.lineHeight });

function drawLabel(c, text, rect, path, fill) {
  if (!text) return;
  const element = c.textElement(text, rect, path, "center", fill);
  if (element) c.children.push(element);
}

/** The text colour for a label placed inside a mark of colour `fill`: the contrasting one; outside marks keep the chart text colour. */
export function labelFill(c, position, fill) {
  return INSIDE.has(position) && fill ? textColorForFill(fill, c.labelColor) : c.labelColor;
}

/**
 * A label on a bar or column. `rect` is the mark, `direction` the way the bar grows from its base
 * ("up", "down", "right" or "left"), so inside-end and outside-end follow the sign of the value.
 */
export function drawBarLabel(c, text, rect, direction, path, fill) {
  const position = c.dataLabels.position ?? "center";
  const { width, height } = labelSize(c, text);
  let x, y;
  const vertical = direction === "up" || direction === "down";
  const toEnd = direction === "up" || direction === "left" ? "start" : "end"; // which edge of the rect is the end
  const centerX = rect.x + rect.width / 2 - width / 2, centerY = rect.y + rect.height / 2 - height / 2;
  if (vertical) {
    x = centerX;
    const endEdge = toEnd === "start" ? rect.y : rect.y + rect.height, baseEdge = toEnd === "start" ? rect.y + rect.height : rect.y;
    const sign = toEnd === "start" ? -1 : 1; // growth direction along y
    if (position === "outside-end") y = sign < 0 ? endEdge - height : endEdge;
    else if (position === "inside-end") y = sign < 0 ? endEdge : endEdge - height;
    else if (position === "inside-base") y = sign < 0 ? baseEdge - height : baseEdge;
    else y = centerY;
  } else {
    y = centerY;
    const endEdge = toEnd === "start" ? rect.x : rect.x + rect.width, baseEdge = toEnd === "start" ? rect.x + rect.width : rect.x;
    const sign = toEnd === "start" ? -1 : 1;
    if (position === "outside-end") x = sign < 0 ? endEdge - width : endEdge;
    else if (position === "inside-end") x = sign < 0 ? endEdge : endEdge - width;
    else if (position === "inside-base") x = sign < 0 ? baseEdge - width : baseEdge;
    else x = centerX;
  }
  drawLabel(c, text, { x, y, width, height }, path, labelFill(c, position, fill));
}

/** A label beside a point mark (line and scatter): above, below, left, right or centred on it. `position` overrides the chart's (a combo chart's line series). */
export function drawPointLabel(c, text, point, path, position = c.dataLabels.position ?? "above") {
  const { width, height } = labelSize(c, text);
  const gap = 3 * c.pt + c.fontPx * 0.25;
  const [px, py] = point;
  const at = {
    above: [px - width / 2, py - gap - height],
    below: [px - width / 2, py + gap],
    left: [px - gap - width, py - height / 2],
    right: [px + gap, py - height / 2],
    center: [px - width / 2, py - height / 2],
  }[position] ?? [px - width / 2, py - gap - height];
  drawLabel(c, text, { x: at[0], y: at[1], width, height }, path, c.labelColor);
}

/** A label at the middle of an area (or any mark with no position choice), centred on (x, y). */
export function drawCenteredLabel(c, text, x, y, path, fill) {
  const { width, height } = labelSize(c, text);
  drawLabel(c, text, { x: x - width / 2, y: y - height / 2, width, height }, path, fill ? labelFill(c, "center", fill) : c.labelColor);
}

/** A label on a pie or doughnut slice at the angle `mid`; `inner` is the ring's inner radius (0 for a pie). */
export function drawSliceLabel(c, text, { cx, cy, r, inner, mid }, path, fill) {
  const { width, height } = labelSize(c, text);
  const cos = Math.cos(mid), sin = Math.sin(mid);
  const position = inner ? "center" : c.dataLabels.position ?? "outside-end";
  const half = (width * Math.abs(cos) + height * Math.abs(sin)) / 2;
  let radius;
  if (inner) radius = (r + inner) / 2;
  else if (position === "center") radius = r / 2;
  else if (position === "inside-end") radius = Math.max(0, r - half - c.fontPx * 0.25);
  else radius = r + half + c.fontPx * 0.25;
  const x = cx + radius * cos, y = cy + radius * sin;
  drawLabel(c, text, { x: x - width / 2, y: y - height / 2, width, height }, path, position === "outside-end" ? c.labelColor : labelFill(c, position, fill));
}

/** The room a pie needs around it for outside-end labels: the widest label and one line. */
export function outsideLabelReserve(c, texts) {
  const widest = Math.max(0, ...texts.map((text) => c.width(text) + c.fontPx * 0.5));
  return { x: widest + c.fontPx * 0.25, y: c.lineHeight + c.fontPx * 0.25 };
}
