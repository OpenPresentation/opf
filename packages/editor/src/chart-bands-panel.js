// The Bands section of the chart inspector (FR-07): one row per band with its upper end (typed in the value axis's display format: "60%" on a
// percent axis), its label and an optional scheme color; add, remove and reorder. Every control commits one undoable change through
// `setChartBands` (src/chart-bands.js) and the canvas redraws at once. The section shows itself on charts whose type draws bands. It reuses the
// chart options panel's classes (`opf-co-*`).
import { resolveChartData } from "@openpresentation/opf";
import { BAND_COLORS, MAX_BANDS, addChartBand, moveChartBand, parseChartPath, readChartBands, removeChartBand, setChartBands } from "./chart-bands.js";
import { getValueAtPath, splitOpfPath } from "./index.js";

let counter = 0;

/** A band end as the value axis shows it: a percent axis (format with %) as a percentage, else the plain number. */
export function formatBandEnd(value, format) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return typeof format === "string" && format.includes("%") ? `${Number((value * 100).toPrecision(12))}%` : String(value);
}
/** A typed band end: "60%" is 0.6, "1,5" with a decimal comma is 1.5; undefined when it is not a number. */
export function parseBandEnd(text) {
  const raw = String(text ?? "").trim().replace(/\s/g, "");
  const percent = raw.endsWith("%");
  const digits = (percent ? raw.slice(0, -1) : raw).replace(/,(?=\d+$)/, ".");
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(digits)) return undefined;
  const number = Number(digits);
  return Number.isFinite(number) ? (percent ? Number((number / 100).toPrecision(12)) : number) : undefined;
}

/**
 * Mount the section in `host`. `getSelectedPath()` returns the selected OPF path (any path inside a chart selects it); `onStatus(message)`
 * receives a short message after each change. Returns `{ element, refresh, destroy }`.
 */
export function createChartBandsPanel(host, { editor, getSelectedPath, onStatus = () => {} }) {
  const id = `opf-chart-bands-${++counter}`;
  const root = document.createElement("section");
  root.className = "opf-chart-options opf-chart-bands";
  root.setAttribute("aria-label", "Bands");
  root.hidden = true;
  root.innerHTML = `<h3 class="opf-co-title" id="${id}-title">Bands</h3><div class="opf-co-group" data-group="bands" role="list" aria-labelledby="${id}-title"></div><button type="button" class="opf-co-button" data-band-action="add">Add band</button>`;
  host.append(root);
  const list = root.querySelector('[data-group="bands"]');
  let chartPath;
  const chartNow = () => {
    if (!chartPath) return undefined;
    try { return getValueAtPath(editor.presentation, splitOpfPath(chartPath)); } catch { return undefined; }
  };
  const formatOf = (chart) => {
    const resolved = resolveChartData(chart, editor.presentation);
    return resolved.ok ? resolved.formats[resolved.hasX ? 2 : 1] : undefined;
  };
  const attempt = (run, message) => {
    try {
      const result = run();
      if (result.changed) onStatus(message);
    } catch (error) {
      onStatus(error.message);
      refresh();
    }
  };

  function refresh() {
    const selected = getSelectedPath?.();
    chartPath = typeof selected === "string" ? parseChartPath(selected) : undefined;
    const chart = chartNow();
    const state = chart ? readChartBands(chart) : undefined;
    root.hidden = !state?.supported;
    if (!state?.supported) return;
    const format = formatOf(chart);
    list.replaceChildren(...state.bands.map((band, index) => {
      const row = document.createElement("div");
      row.className = "opf-co-row opf-chart-band";
      row.setAttribute("role", "listitem");
      row.dataset.band = String(index);
      const n = index + 1;
      row.innerHTML = `<input type="text" inputmode="decimal" data-band-field="to" aria-label="Band ${n} upper end" placeholder="Upper end">`
        + `<input type="text" data-band-field="label" aria-label="Band ${n} label" placeholder="Label">`
        + `<select data-band-field="color" aria-label="Band ${n} color"><option value="">Neutral</option>${BAND_COLORS.map((name) => `<option value="${name}">${name}</option>`).join("")}</select>`
        + `<button type="button" data-band-action="up" aria-label="Move band ${n} down the axis"${index === 0 ? " disabled" : ""}>↑</button>`
        + `<button type="button" data-band-action="down" aria-label="Move band ${n} up the axis"${index === state.bands.length - 1 ? " disabled" : ""}>↓</button>`
        + `<button type="button" data-band-action="remove" aria-label="Remove band ${n}">×</button>`;
      row.querySelector('[data-band-field="to"]').value = formatBandEnd(band.to, format);
      row.querySelector('[data-band-field="label"]').value = band.label ?? "";
      row.querySelector('[data-band-field="color"]').value = band.color ?? "";
      return row;
    }));
    root.querySelector('[data-band-action="add"]').disabled = state.bands.length >= MAX_BANDS;
  }

  const onChange = (event) => {
    const target = event.target;
    if (!chartPath || !(target instanceof HTMLElement) || !target.dataset.bandField) return;
    const index = Number(target.closest("[data-band]")?.dataset.band);
    const { bands } = readChartBands(chartNow());
    const next = bands.map((band) => ({ ...band }));
    const field = target.dataset.bandField;
    if (field === "to") {
      const value = parseBandEnd(target.value);
      if (value === undefined) { onStatus(`"${target.value}" is not a number.`); refresh(); return; }
      next[index].to = value;
    } else if (field === "label") next[index].label = target.value.trim() ? target.value : undefined;
    else next[index].color = target.value || undefined;
    attempt(() => setChartBands(editor, chartPath, next), "Bands updated");
  };
  const onClick = (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest("[data-band-action]") : null;
    if (!chartPath || !button) return;
    const index = Number(button.closest("[data-band]")?.dataset.band);
    const action = button.dataset.bandAction;
    if (action === "add") attempt(() => addChartBand(editor, chartPath), "Band added");
    else if (action === "remove") attempt(() => removeChartBand(editor, chartPath, index), "Band removed");
    else if (action === "up") attempt(() => moveChartBand(editor, chartPath, index, -1), "Band moved");
    else if (action === "down") attempt(() => moveChartBand(editor, chartPath, index, 1), "Band moved");
  };
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  const unsubscribe = editor.subscribe?.(() => refresh());
  refresh();
  return { element: root, refresh, destroy() { root.removeEventListener("change", onChange); root.removeEventListener("click", onClick); unsubscribe?.(); root.remove(); } };
}
