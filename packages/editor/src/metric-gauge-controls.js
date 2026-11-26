// The Gauge section of the metric inspector (FR-07, part 3): a toggle that draws the metric on an arc, its range (`min`, `max`), its target and
// its bands. Turning the gauge on fills `min` 0 and `max` from the value (core's format never guesses a range: this is the editor's convenience,
// `defaultMetricGauge`). The bands use the chart Bands section's rows, end parsing and colors (src/chart-bands-panel.js, src/chart-bands.js), so a
// band is written the same way in a chart and a gauge. Each change is one undoable session change through `setMetricData`; `sync` re-reads the
// session after every change, Undo and Redo included. The canvas draws the gauge and the warnings show on the metric.
import { formatBandEnd, parseBandEnd } from "./chart-bands-panel.js";
import { BAND_COLORS, MAX_BANDS } from "./chart-bands.js";
import { defaultMetricGauge, readMetricData, setMetricData } from "./content-actions.js";

/**
 * Build the Gauge section. `ctx` supplies the panel's helpers: `h`, `checkField`, `numberField`, `button`, `run(action, done)` and `editor`.
 * Returns `{ node, sync(blockPath) }`; `node.hidden` is true while the selection is not a metric.
 */
export function createMetricGaugeControls(ctx) {
  const { editor, h, checkField, numberField, button, run } = ctx;
  let blockPath;
  let state;

  const gauge = () => state?.gauge;
  const setGauge = (next, done) => run(() => setMetricData(editor, blockPath, { gauge: next }), done);
  const withKey = (key, value) => {
    const { [key]: _old, ...rest } = gauge() ?? {};
    return value === null || value === undefined ? rest : { ...rest, [key]: value };
  };

  const toggle = checkField("metric-gauge", "Gauge", {
    help: "Draw the metric on a half-circle from its minimum to its maximum, with bands and a target",
    onChange: (on) => (on ? setGauge(defaultMetricGauge(state?.number), "Gauge on: the metric is drawn on an arc.") : setGauge(null, "Gauge off.")),
  });
  const min = numberField("metric-gauge-min", "Minimum", { help: "The value at the arc's left end. Empty: 0", placeholder: "0", onCommit: (value) => setGauge(withKey("min", value), "Gauge minimum set.") });
  const max = numberField("metric-gauge-max", "Maximum", {
    help: "The value at the arc's right end",
    onCommit: (value) => (value === null ? undefined : setGauge(withKey("max", value), "Gauge maximum set.")),
  });
  const target = numberField("metric-gauge-target", "Target", { help: "A value marked by a tick across the arc. Empty: no target", onCommit: (value) => setGauge(withKey("target", value), value === null ? "Gauge target removed." : "Gauge target set.") });
  const bands = h("div", { class: "opf-co-group", "data-group": "gauge-bands", role: "list", "aria-label": "Gauge bands" });
  const addBand = button("Add band", () => {
    const list = gauge()?.bands ?? [];
    const last = list.length ? list[list.length - 1].to : gauge()?.min ?? 0;
    const top = gauge()?.max ?? 1;
    const to = list.length ? Math.min(top, last + (top - (gauge()?.min ?? 0)) / 3) : (top + (gauge()?.min ?? 0)) / 2;
    return setGauge(withKey("bands", [...list, { to }]), "Gauge band added.");
  });

  const bandList = () => (gauge()?.bands ?? []).map((band) => ({ ...band }));
  const writeBands = (list, done) => setGauge(withKey("bands", list.length ? list : null), done);
  bands.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.dataset.bandField) return;
    const index = Number(target.closest("[data-band]")?.dataset.band);
    const list = bandList();
    const field = target.dataset.bandField;
    if (field === "to") {
      const value = parseBandEnd(target.value);
      if (value === undefined) return sync(blockPath);
      list[index].to = value;
    } else if (field === "label") {
      if (target.value.trim()) list[index].label = target.value;
      else delete list[index].label;
    } else if (target.value) list[index].color = target.value;
    else delete list[index].color;
    writeBands(list, "Gauge bands updated.");
  });
  bands.addEventListener("click", (event) => {
    const control = event.target instanceof HTMLElement ? event.target.closest("[data-band-action]") : null;
    if (!control) return;
    const index = Number(control.closest("[data-band]")?.dataset.band);
    const list = bandList();
    const action = control.dataset.bandAction;
    if (action === "remove") return writeBands(list.filter((_, at) => at !== index), "Gauge band removed.");
    const to = index + (action === "up" ? -1 : 1);
    if (to < 0 || to >= list.length) return undefined;
    [list[index], list[to]] = [list[to], list[index]];
    return writeBands(list, "Gauge band moved.");
  });

  const fields = h("div", { class: "opf-dc-metric-gauge-fields" }, min.wrap, max.wrap, target.wrap, h("p", { class: "opf-dc-note" }, "Bands"), bands, addBand);
  const body = h("div", { class: "opf-dc-metric-gauge", "data-role": "metric-gauge" }, toggle.wrap, fields);
  const node = h("details", { class: "opf-dc-details", "data-role": "metric-gauge-section", open: true }, h("summary", {}, "Gauge"), body);

  function sync(path) {
    blockPath = path;
    state = path ? readMetricData(editor.presentation, path) : undefined;
    node.hidden = !state;
    if (!state) return;
    const value = gauge();
    toggle.set(Boolean(value));
    fields.hidden = !value;
    if (!value) return;
    const format = typeof state.format === "string" ? state.format : state.value?.format;
    min.set(value.min === undefined ? "" : String(value.min));
    max.set(String(value.max));
    target.set(value.target === undefined ? "" : String(value.target));
    const list = value.bands ?? [];
    bands.replaceChildren(...list.map((band, index) => {
      const n = index + 1;
      const row = h("div", { class: "opf-co-row opf-chart-band", role: "listitem", "data-band": String(index) });
      row.innerHTML = `<input type="text" inputmode="decimal" data-band-field="to" aria-label="Gauge band ${n} upper end" placeholder="Upper end">`
        + `<input type="text" data-band-field="label" aria-label="Gauge band ${n} label" placeholder="Label">`
        + `<select data-band-field="color" aria-label="Gauge band ${n} color"><option value="">Neutral</option>${BAND_COLORS.map((name) => `<option value="${name}">${name}</option>`).join("")}</select>`
        + `<button type="button" data-band-action="up" aria-label="Move gauge band ${n} down the arc"${index === 0 ? " disabled" : ""}>↑</button>`
        + `<button type="button" data-band-action="down" aria-label="Move gauge band ${n} up the arc"${index === list.length - 1 ? " disabled" : ""}>↓</button>`
        + `<button type="button" data-band-action="remove" aria-label="Remove gauge band ${n}">×</button>`;
      row.querySelector('[data-band-field="to"]').value = formatBandEnd(band.to, format);
      row.querySelector('[data-band-field="label"]').value = band.label ?? "";
      row.querySelector('[data-band-field="color"]').value = band.color ?? "";
      return row;
    }));
    addBand.disabled = list.length >= MAX_BANDS;
  }

  return { node, sync };
}
