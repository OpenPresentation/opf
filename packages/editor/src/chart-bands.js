// Bands on a chart's value axis (FR-07): ranges shaded behind the data, each with its upper end, an optional label and an optional scheme color.
// These helpers read the bands as form state and edit them as one validated, undoable patch, so the canvas redraws at once and Undo restores the
// chart. Colors are scheme names only (the schema's SchemeColorName); ends are numbers in the value axis's units. Nothing here invents text.
import { CHART_BAND_TYPES, SCHEME_COLOR_NAMES } from "@openpresentation/opf/composition";
import { getValueAtPath, splitOpfPath } from "./index.js";
import { checkedDocument, fail, same } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";

/** The scheme colors a band may take. */
export const BAND_COLORS = Object.freeze([...SCHEME_COLOR_NAMES]);
/** The most bands a chart takes (the schema's maxItems). */
export const MAX_BANDS = 6;

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

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

function chartAt(presentation, chartPath) {
  const chart = getValueAtPath(presentation, splitOpfPath(chartPath));
  if (!isObject(chart) || typeof chart.type !== "string") throw fail("chart-not-found", "Choose a chart (a path ending in .chart).", { chartPath });
  return chart;
}

/**
 * The bands as form state: `supported` (whether the chart's type draws bands: bar, column, line and area charts and their stacked forms, and
 * the bullet chart), and `bands`, each `{ to, label, color }` in the order written (`label` and `color` undefined when absent).
 */
export function readChartBands(chart) {
  const type = isObject(chart) && typeof chart.type === "string" ? chart.type : "";
  const bands = Array.isArray(chart?.bands) ? chart.bands.filter(isObject).map((band) => ({ to: band.to, label: typeof band.label === "string" ? band.label : undefined, color: typeof band.color === "string" ? band.color : undefined })) : [];
  return { supported: CHART_BAND_TYPES.has(type), bands };
}

function checkedBand(band, index) {
  if (!isObject(band) || typeof band.to !== "number" || !Number.isFinite(band.to)) throw fail("invalid-band", `Band ${index + 1} needs an upper end, a number in the value axis's units.`, { index });
  if (band.label !== undefined && (typeof band.label !== "string" || !band.label.trim())) throw fail("invalid-band", `Band ${index + 1}'s label is text, or no label at all.`, { index });
  if (band.color !== undefined && !BAND_COLORS.includes(band.color)) throw fail("invalid-band", `A band's color is a color of the deck's color scheme (${BAND_COLORS.join(", ")}).`, { index, color: band.color });
  return { to: band.to, ...(band.label !== undefined ? { label: band.label } : {}), ...(band.color !== undefined ? { color: band.color } : {}) };
}

/**
 * Prepare a change of a chart's bands as patches (nothing is applied). `bands` is the whole new list (`[]` or `null` removes the bands): up to six
 * `{ to, label?, color? }`. Ends that are not increasing are accepted (engines draw them sorted; the validator warns). The document is not modified.
 */
export function prepareChartBands(presentation, chartPath, bands) {
  const before = checkFormat(presentation);
  const chart = chartAt(presentation, chartPath);
  const list = bands === null || bands === undefined ? [] : bands;
  if (!Array.isArray(list)) throw fail("invalid-band", "Bands are a list of { to, label, color }.", {});
  if (list.length > MAX_BANDS) throw fail("invalid-band", `A chart takes at most ${MAX_BANDS} bands.`, { count: list.length });
  const wanted = list.map(checkedBand);
  const path = `${chartPath}.bands`;
  const patches = [];
  if (!wanted.length) { if (chart.bands !== undefined) patches.push({ op: "remove", path }); }
  else if (chart.bands === undefined) patches.push({ op: "add", path, value: wanted });
  else if (!same(chart.bands, wanted)) patches.push({ op: "replace", path, value: wanted });
  const next = checkedDocument(presentation, patches, before);
  return { action: "chart-bands", chartPath, changed: patches.length > 0, patches, presentation: next };
}

/** Apply a change of a chart's bands to an editor session as one undoable edit. Returns the editor change. */
export function setChartBands(editor, chartPath, bands, meta = {}) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const prepared = prepareChartBands(editor.presentation, chartPath, bands);
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const applied = editor.applyPatch(patches, { ...meta, source: meta.source ?? "chart-bands", action: prepared.action, path: chartPath });
  return { ...applied, ...summary };
}

/** Add a band above the last one (its end one step past the last end, or 1), remove band `index`, or move it up or down; one undoable edit each. */
export function addChartBand(editor, chartPath, band) {
  const { bands } = readChartBands(chartAt(editor.presentation, chartPath));
  const last = bands.length ? bands[bands.length - 1].to : 0;
  const step = bands.length > 1 ? last - bands[bands.length - 2].to : Math.abs(last) || 1;
  return setChartBands(editor, chartPath, [...bands, band ?? { to: last + (step > 0 ? step : 1) }].map(clean));
}
export function removeChartBand(editor, chartPath, index) {
  const { bands } = readChartBands(chartAt(editor.presentation, chartPath));
  return setChartBands(editor, chartPath, bands.filter((_, at) => at !== index).map(clean));
}
export function moveChartBand(editor, chartPath, index, offset) {
  const { bands } = readChartBands(chartAt(editor.presentation, chartPath));
  const to = index + offset;
  if (to < 0 || to >= bands.length) return setChartBands(editor, chartPath, bands.map(clean));
  const next = [...bands];
  [next[index], next[to]] = [next[to], next[index]];
  return setChartBands(editor, chartPath, next.map(clean));
}
const clean = (band) => ({ to: band.to, ...(band.label !== undefined ? { label: band.label } : {}), ...(band.color !== undefined ? { color: band.color } : {}) });
