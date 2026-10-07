// Chart options (RR-35): axis titles, legend position and data labels, plus (FA-09) the chart's text alternative `alt` and (FA-14) the
// highlight. A chart is `{ type, data, alt?, axisTitles?, legend?, dataLabels?, highlight? }`. These helpers read the fields as form
// state and edit them as one validated, undoable patch (a few add / replace / remove operations
// on the chart, one undo step), so the canvas redraws the legend, titles and labels and Undo
// restores the chart. Which fields a chart offers follows core's support table
// (`chartOptionSupport`): a pie has no axis titles, area and radar labels have no position
// choice, and only a pie or doughnut can show percent. A highlight names plotted series and category labels (the
// choices come from the chart's resolved data, so a dataset chart offers its dataset's columns and rows); a pie
// highlights slices (categories), an area only series. Nothing here invents text. A combo chart (FA-15) also offers which series are lines (`line`), which lines use the secondary value
// axis (`secondaryAxis`) and that axis's title.
import * as core from "@openpresentation/opf";
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath, validateOpfDocument } from "./index.js";
import { checkedDocument, fail, same } from "./edit-helpers.js";

export const CHART_LEGEND_POSITIONS = Object.freeze(["default", "none", "top", "bottom", "left", "right"]);
export const CHART_LABEL_CONTENT = Object.freeze(["category", "value", "percent"]);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const CONTENT_ORDER = CHART_LABEL_CONTENT;
const NO_HIGHLIGHT = Object.freeze({ series: false, categories: false });
const POSITIONS = new Set(["center", "inside-end", "inside-base", "outside-end", "above", "below", "left", "right"]);

/** True when the installed core knows the chart option fields; an older core leaves the panel out. */
export function chartOptionsAvailable() {
  return typeof core.chartOptionSupport === "function" && typeof core.chartOptionTarget === "function" && typeof core.resolveChartOptions === "function";
}

/** The chart path a selection path points at (`…chart`, `…chart.data.rows.0.1`), or undefined. */
export function parseChartPath(path) {
  let parts;
  try {
    parts = splitOpfPath(path);
  } catch {
    return undefined;
  }
  const index = parts.lastIndexOf("chart");
  return index >= 1 ? parts.slice(0, index + 1).join(".") : undefined;
}

function chartAt(document, chartPath) {
  const parts = splitOpfPath(chartPath);
  const chart = getValueAtPath(document, parts);
  if (!isObject(chart) || typeof chart.type !== "string") throw fail("chart-not-found", "Choose a chart (a path ending in .chart).", { chartPath });
  return { parts, chart };
}

// The names a highlight can take, from the chart's resolved data: the plotted series (the columns after the category and, on a
// scatter chart, the X column) and the distinct non-empty row labels. Empty when the data does not resolve.
function highlightChoices(chart, document) {
  const none = { series: [], categories: [] };
  if (typeof core.resolveChartData !== "function") return none;
  let resolved;
  try { resolved = core.resolveChartData(chart, document); } catch { return none; }
  if (!resolved?.ok || resolved.columns.length < 2) return none;
  const first = resolved.hasX ? 2 : 1;
  const label = (cell) => (cell === null || cell === undefined ? "" : String(cell));
  return { series: resolved.columns.slice(first), categories: [...new Set(resolved.rows.map((row) => label(row[0])).filter(Boolean))] };
}

const names = (value) => (Array.isArray(value) ? [...new Set(value.filter((entry) => typeof entry === "string"))] : []);

/**
 * What the chart options offer for `chart`, and the form state of the fields. `document` (optional) resolves a dataset-backed
 * chart's columns and rows for the highlight choices.
 * `fields.axisTitles.category` and `.value` say whether the type has that axis; `fields.legend` whether it has a legend;
 * `fields.dataLabels` the contents and positions it accepts (`positions` is empty when labels have no position choice).
 * `fields.axisTitles.secondary` is true on a combo chart, whose `combo.series` lists the plotted series ({ name, role, axis });
 * pass the `document` for a dataset-backed chart.
 */
export function readChartOptions(chart, document) {
  if (!chartOptionsAvailable()) throw fail("chart-options-unavailable", "The installed @openpresentation/opf does not know the chart option fields.");
  const target = core.chartOptionTarget(chart?.type);
  // A chart type outside the catalog is never restricted: every field is offered (a secondary axis exists only on combo charts).
  const support = target ? core.chartOptionSupport(target) : {
    axisTitles: { category: true, value: true, secondary: false }, legend: true,
    dataLabels: { supported: true, content: CONTENT_ORDER, positions: [...POSITIONS], defaultPosition: null, defaultOn: false },
    highlight: { series: true, categories: true },
  };
  const titles = isObject(chart?.axisTitles) ? chart.axisTitles : {};
  const labels = chart?.dataLabels;
  const labelObject = isObject(labels) ? labels : {};
  const combo = target?.kind === "combo" ? comboSeries(chart, document) : undefined;
  return {
    target,
    fields: {
      axisTitles: { ...support.axisTitles, secondary: support.axisTitles.secondary === true },
      legend: support.legend,
      dataLabels: { ...support.dataLabels, content: [...support.dataLabels.content], positions: [...support.dataLabels.positions] },
      // An older core without the highlight support entry offers none.
      highlight: { ...(support.highlight ?? NO_HIGHLIGHT) },
    },
    // FA-15: a combo chart's plotted series, each drawn as columns ("bar") or as a line, on the primary or secondary value axis.
    ...(combo ? { combo: { series: combo } } : {}),
    choices: highlightChoices(chart, document),
    state: {
      // FA-09: the text alternative. `decorative` is the empty alt, a reviewed choice, not a missing one.
      alt: typeof chart?.alt === "string" ? chart.alt : "",
      decorative: chart?.alt === "",
      highlight: { series: names(chart?.highlight?.series), categories: names(chart?.highlight?.categories) },
      axisTitles: { category: typeof titles.category === "string" ? titles.category : "", value: typeof titles.value === "string" ? titles.value : "", secondary: typeof titles.secondary === "string" ? titles.secondary : "" },
      legend: typeof chart?.legend === "string" ? chart.legend : "default",
      dataLabels: {
        // Funnel and treemap label their marks by default, so `dataLabels: false` is what switches them off.
        on: labels === true || isObject(labels) || (labels === undefined && support.dataLabels.defaultOn),
        explicit: labels !== undefined,
        content: Array.isArray(labelObject.content) && labelObject.content.length ? CONTENT_ORDER.filter((part) => labelObject.content.includes(part)) : (labels === undefined && support.dataLabels.defaultOn ? [target?.kind === "treemap" ? "category" : "value"] : ["value"]),
        position: typeof labelObject.position === "string" ? labelObject.position : "auto",
        separator: typeof labelObject.separator === "string" ? labelObject.separator : ", ",
      },
    },
  };
}

/**
 * FA-15: a combo chart's plotted series ({ name, role, axis }) in the data's plotted order (the mapping, else the columns), with
 * the role and axis core resolves for each; [] when the data does not resolve.
 */
function comboSeries(chart, document) {
  if (typeof core.resolveChartData !== "function") return [];
  const resolved = core.resolveChartData(chart, document);
  if (!resolved.ok || !Array.isArray(resolved.combo)) return [];
  const plan = new Map(resolved.columns.slice(1).map((name, index) => [name, resolved.combo[index]]));
  const { line: _line, secondaryAxis: _secondary, ...plain } = chart;
  const plotted = core.resolveChartData({ ...plain, type: "column" }, document);
  const names = plotted.ok ? plotted.columns.slice(1) : [...plan.keys()];
  return names.filter((name) => plan.has(name)).map((name) => ({ name, role: plan.get(name)?.role ?? "bar", axis: plan.get(name)?.axis ?? "primary" }));
}

// FA-15: `line` and `secondaryAxis` for a combo chart from the wanted line and secondary-axis names. `line` is written only when
// it differs from the default (the last plotted series), names keep the data's order, and only a line can use the secondary axis.
function comboFields(chart, change, document) {
  const series = comboSeries(chart, document);
  const plotted = series.map((entry) => entry.name);
  const currentLines = series.filter((entry) => entry.role === "line").map((entry) => entry.name);
  const currentSecondary = series.filter((entry) => entry.axis === "secondary").map((entry) => entry.name);
  const wanted = (value, current, field) => {
    if (value === undefined) return current;
    if (!Array.isArray(value) || value.some((name) => typeof name !== "string")) throw fail("invalid-chart-option", `${field} is a list of series names.`, { [field]: value });
    const unknown = value.filter((name) => !plotted.includes(name));
    if (unknown.length) throw fail("invalid-chart-option", `${unknown.map((name) => `'${name}'`).join(", ")} ${unknown.length === 1 ? "is not a plotted series" : "are not plotted series"} of this chart.`, { [field]: value });
    return value;
  };
  const lines = wanted(change.line, currentLines, "line");
  if (!lines.length) throw fail("invalid-chart-option", "A combo chart draws at least one series as a line; choose a column chart for columns only.", { line: change.line });
  if (lines.length >= plotted.length) throw fail("invalid-chart-option", "A combo chart keeps at least one series as columns.", { line: change.line });
  const ordered = plotted.filter((name) => lines.includes(name));
  const secondary = plotted.filter((name) => ordered.includes(name) && wanted(change.secondaryAxis, currentSecondary, "secondaryAxis").includes(name));
  const defaultLine = ordered.length === 1 && ordered[0] === plotted[plotted.length - 1];
  return { line: defaultLine ? undefined : ordered, secondaryAxis: secondary.length ? secondary : undefined };
}

// The desired value of each field (undefined removes it), from the chart and a patch.
function desired(chart, change, support, choices, current, document) {
  const out = {};
  const combo = support.axisTitles.secondary === true;
  if (change.line !== undefined || change.secondaryAxis !== undefined) {
    // Only a combo chart has line series; elsewhere the fields are removed.
    Object.assign(out, combo ? comboFields(chart, change, document) : { line: undefined, secondaryAxis: undefined });
  }
  // The secondary axis title exists only while a series uses the secondary axis.
  const hasSecondary = combo && (Object.hasOwn(out, "secondaryAxis") ? out.secondaryAxis !== undefined : Array.isArray(chart.secondaryAxis) && chart.secondaryAxis.length > 0);
  if (change.axisTitles !== undefined || (current.axisTitles.secondary && !hasSecondary)) {
    const titles = {};
    for (const axis of ["category", "value", "secondary"]) {
      const value = change.axisTitles?.[axis] !== undefined ? change.axisTitles[axis] : current.axisTitles[axis];
      if (typeof value === "string" && value.trim() && support.axisTitles[axis] && (axis !== "secondary" || hasSecondary)) titles[axis] = value.trim();
    }
    out.axisTitles = Object.keys(titles).length ? titles : undefined;
  }
  if (change.decorative === true) out.alt = "";
  else if (change.alt !== undefined) out.alt = typeof change.alt === "string" && change.alt.trim() ? change.alt.trim() : undefined;
  else if (change.decorative === false && chart.alt === "") out.alt = undefined;
  if (change.legend !== undefined) {
    if (change.legend !== "default" && !CHART_LEGEND_POSITIONS.includes(change.legend)) throw fail("invalid-chart-option", `'${change.legend}' is not a legend position.`, { legend: change.legend });
    out.legend = change.legend === "default" || !support.legend ? undefined : change.legend;
  }
  if (change.dataLabels !== undefined) {
    const labels = change.dataLabels;
    if (labels === null || labels === false || labels === "off") {
      // false is only meaningful where a construct labels its marks by default; elsewhere no labels is the absence of the field.
      out.dataLabels = support.dataLabels.defaultOn && labels !== null ? false : undefined;
    } else if (!support.dataLabels.supported) {
      out.dataLabels = undefined;
    } else {
      const base = isObject(chart.dataLabels) ? chart.dataLabels : {};
      const merged = labels === true ? {} : { ...base, ...labels };
      const next = {};
      const content = Array.isArray(merged.content) ? CONTENT_ORDER.filter((part) => merged.content.includes(part) && support.dataLabels.content.includes(part)) : [];
      if (content.length && !(content.length === 1 && content[0] === "value")) next.content = content;
      if (typeof merged.position === "string" && merged.position !== "auto" && support.dataLabels.positions.includes(merged.position)) next.position = merged.position;
      if (typeof merged.separator === "string" && merged.separator !== ", " && merged.separator !== "") next.separator = merged.separator.replace(/[\r\n]+/g, " ");
      out.dataLabels = Object.keys(next).length ? next : true;
    }
  }
  if (change.highlight !== undefined) {
    if (change.highlight === null) out.highlight = undefined;
    else {
      const next = {};
      for (const part of ["series", "categories"]) {
        const requested = change.highlight[part] !== undefined ? change.highlight[part] : current.highlight[part];
        if (!Array.isArray(requested) || requested.some((entry) => typeof entry !== "string")) throw fail("invalid-chart-option", `Highlight ${part} must be a list of names.`, { part });
        const listed = names(requested);
        // A part the chart type cannot highlight is never written (a pie highlights slices, not series).
        if (!support.highlight[part] || !listed.length) continue;
        const unknown = choices[part].length ? listed.find((entry) => !choices[part].includes(entry)) : undefined;
        if (unknown !== undefined) throw fail("invalid-chart-option", `'${unknown}' is not a ${part === "series" ? "plotted series" : "category label"} of this chart.`, { part, name: unknown });
        next[part] = listed;
      }
      out.highlight = Object.keys(next).length ? next : undefined;
    }
  }
  return out;
}

/**
 * Prepare one validated patch for a change to the chart's options. `change` is
 * `{ alt?, decorative?, axisTitles?: { category?, value?, secondary? }, legend?, dataLabels?, highlight?, line?, secondaryAxis? }`: `alt` is the text alternative (trimmed; empty or `null`
 * removes it), `decorative: true` writes the empty alt (and wins over `alt`), `decorative: false` removes an empty alt; `axisTitles` entries are strings (empty removes a title),
 * `legend` is `"default"` (remove the field), `"none"`, `"top"`, `"bottom"`, `"left"` or `"right"`, and `dataLabels` is
 * `true`, `false` (or `null`, which removes the field), or `{ content?, position?, separator? }` merged over the current labels, and
 * `highlight` is `null` (remove the field) or `{ series?, categories? }`: each list replaces that part (an empty list removes it, a name the
 * chart does not have is refused) and the other part is kept. On a combo chart (FA-15), `line` lists the series drawn as lines and
 * `secondaryAxis` the lines on the secondary value axis, by name; at least one series stays columns and at least one is a line, `line`
 * is written only when it differs from the default (the last series), and the secondary axis title goes when no series uses that axis.
 * Fields the chart type cannot show are never written. The document is not modified.
 */
export function prepareChartOptions(document, chartPath, change) {
  if (!chartOptionsAvailable()) throw fail("chart-options-unavailable", "The installed @openpresentation/opf does not know the chart option fields.");
  const before = validateOpfDocument(document);
  const { parts, chart } = chartAt(document, chartPath);
  const read = readChartOptions(chart, document);
  const wanted = desired(chart, change, read.fields, read.choices, read.state, document);
  const patches = [];
  for (const [key, value] of Object.entries(wanted)) {
    const path = opfPathToJsonPointer([...parts, key]);
    const present = Object.hasOwn(chart, key);
    if (value === undefined) {
      if (present) patches.push({ op: "remove", path });
    } else if (!present) patches.push({ op: "add", path, value: structuredClone(value) });
    else if (!same(chart[key], value)) patches.push({ op: "replace", path, value: structuredClone(value) });
  }
  const next = checkedDocument(document, patches, before);
  return { action: "chart-options", chartPath, changed: patches.length > 0, patches, document: next };
}

function checkEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}

/** Apply a chart option change to an editor session as one undoable edit. Returns the editor change. */
export function setChartOptions(editor, chartPath, change, meta = {}) {
  checkEditor(editor);
  const prepared = prepareChartOptions(editor.document, chartPath, change);
  const { document, patches, ...summary } = prepared;
  void document;
  if (!prepared.changed) return { ...summary, document: editor.document, patches: [], inversePatches: [], validation: editor.validation };
  const applied = editor.applyPatch(patches, { ...meta, source: meta.source ?? "chart-option", action: prepared.action, path: chartPath });
  return { ...applied, ...summary };
}
