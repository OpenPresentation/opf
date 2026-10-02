// The chart options panel (RR-35): axis titles, legend position and data labels for the selected chart.
// It mounts into any host element over an editor session; every control commits one undoable change through
// `setChartOptions` (src/chart-options.js), the canvas redraws, and Undo restores the chart. The panel shows only what
// the selected chart type can show (core's support table), and hides itself when no chart is selected.
import { CHART_LABEL_CONTENT, CHART_LEGEND_POSITIONS, chartOptionsAvailable, parseChartPath, readChartOptions, setChartOptions } from "./chart-options.js";

const LEGEND_LABELS = { default: "Default", none: "None", top: "Top", bottom: "Bottom", left: "Left", right: "Right" };
const CONTENT_LABELS = { category: "Category", value: "Value", percent: "Percent" };
const POSITION_LABELS = { auto: "Automatic", center: "Center", "inside-end": "Inside end", "inside-base": "Inside base", "outside-end": "Outside end", above: "Above", below: "Below", left: "Left", right: "Right" };

let counter = 0;

/**
 * Mount the panel in `host`. `getSelectedPath()` returns the selected OPF path (any path inside a chart selects it);
 * `onStatus(message)` receives a short message after each change. Returns `{ element, refresh, destroy }`;
 * call `refresh()` when the selection changes (the panel also refreshes on every editor change).
 */
export function createChartOptionsPanel(host, { editor, getSelectedPath, onStatus = () => {} }) {
  if (!chartOptionsAvailable()) return { refresh() {}, destroy() {}, element: undefined };
  const id = `opf-chart-options-${++counter}`;
  const root = document.createElement("section");
  root.className = "opf-chart-options";
  root.setAttribute("aria-label", "Chart options");
  root.hidden = true;
  root.innerHTML = `
    <h3 class="opf-co-title">Chart options</h3>
    <div class="opf-co-group" data-group="axisTitles">
      <label class="opf-co-row" data-axis="category"><span>Category axis title</span><input type="text" id="${id}-category" aria-label="Category axis title" data-opf-chart-option="axisTitles.category" autocomplete="off"></label>
      <label class="opf-co-row" data-axis="value"><span>Value axis title</span><input type="text" id="${id}-value" aria-label="Value axis title" data-opf-chart-option="axisTitles.value" autocomplete="off"></label>
    </div>
    <div class="opf-co-group" data-group="legend">
      <label class="opf-co-row"><span>Legend</span><select id="${id}-legend" aria-label="Legend" data-opf-chart-option="legend">${CHART_LEGEND_POSITIONS.map((value) => `<option value="${value}">${LEGEND_LABELS[value]}</option>`).join("")}</select></label>
    </div>
    <div class="opf-co-group" data-group="dataLabels">
      <label class="opf-co-row opf-co-check"><input type="checkbox" id="${id}-labels" aria-label="Data labels" data-opf-chart-option="dataLabels.on"><span>Data labels</span></label>
      <fieldset class="opf-co-content"><legend>Label shows</legend>${CHART_LABEL_CONTENT.map((part) => `<label class="opf-co-check"><input type="checkbox" value="${part}" aria-label="Label shows ${CONTENT_LABELS[part].toLowerCase()}" data-opf-chart-option="dataLabels.content.${part}"><span>${CONTENT_LABELS[part]}</span></label>`).join("")}</fieldset>
      <label class="opf-co-row" data-row="position"><span>Label position</span><select id="${id}-position" aria-label="Label position" data-opf-chart-option="dataLabels.position"></select></label>
      <label class="opf-co-row" data-row="separator"><span>Separator</span><input type="text" id="${id}-separator" aria-label="Label separator" data-opf-chart-option="dataLabels.separator" autocomplete="off"></label>
    </div>`;
  host.append(root);
  const $ = (selector) => root.querySelector(selector);
  const fields = {
    category: $(`#${id}-category`), value: $(`#${id}-value`), legend: $(`#${id}-legend`), labels: $(`#${id}-labels`),
    position: $(`#${id}-position`), separator: $(`#${id}-separator`), contents: [...root.querySelectorAll("[data-opf-chart-option^='dataLabels.content.']")],
  };
  let chartPath;

  function refresh() {
    const path = parseChartPath(getSelectedPath?.() ?? "");
    let chart;
    try { chart = path ? editor.get(path) : undefined; } catch { chart = undefined; }
    if (!path || !chart || typeof chart !== "object" || typeof chart.type !== "string") {
      root.hidden = true;
      chartPath = undefined;
      return;
    }
    chartPath = path;
    const { fields: support, state } = readChartOptions(chart);
    root.hidden = false;
    const setValue = (input, value) => { if (input !== document.activeElement && input.value !== value) input.value = value; };
    for (const axis of ["category", "value"]) {
      $(`[data-axis="${axis}"]`).hidden = !support.axisTitles[axis];
      setValue(fields[axis], state.axisTitles[axis]);
    }
    $("[data-group='axisTitles']").hidden = !support.axisTitles.category && !support.axisTitles.value;
    $("[data-group='legend']").hidden = !support.legend;
    fields.legend.value = state.legend;
    $("[data-group='dataLabels']").hidden = !support.dataLabels.supported;
    fields.labels.checked = state.dataLabels.on;
    const off = !state.dataLabels.on;
    for (const input of fields.contents) {
      input.closest("label").hidden = !support.dataLabels.content.includes(input.value);
      input.checked = state.dataLabels.content.includes(input.value);
      input.disabled = off;
    }
    const positions = ["auto", ...support.dataLabels.positions];
    $("[data-row='position']").hidden = support.dataLabels.positions.length === 0;
    if (fields.position.dataset.options !== positions.join()) {
      fields.position.innerHTML = positions.map((value) => `<option value="${value}">${POSITION_LABELS[value]}</option>`).join("");
      fields.position.dataset.options = positions.join();
    }
    fields.position.value = positions.includes(state.dataLabels.position) ? state.dataLabels.position : "auto";
    fields.position.disabled = off;
    setValue(fields.separator, state.dataLabels.separator);
    fields.separator.disabled = off || state.dataLabels.content.length < 2;
    $("[data-row='separator']").hidden = support.dataLabels.content.length < 2;
  }

  function commit(change, message) {
    if (!chartPath) return;
    try {
      const result = setChartOptions(editor, chartPath, change, { source: "chart-options-panel" });
      if (result.changed) onStatus(message);
    } catch (error) {
      onStatus(error?.message ?? String(error));
    }
    refresh();
  }

  const selectedContent = () => fields.contents.filter((input) => input.checked && !input.closest("label").hidden).map((input) => input.value);
  const listeners = [
    [fields.category, "change", () => commit({ axisTitles: { category: fields.category.value } }, "Changed the category axis title. Undo restores it.")],
    [fields.value, "change", () => commit({ axisTitles: { value: fields.value.value } }, "Changed the value axis title. Undo restores it.")],
    [fields.legend, "change", () => commit({ legend: fields.legend.value }, "Changed the legend. Undo restores it.")],
    [fields.labels, "change", () => commit({ dataLabels: fields.labels.checked }, fields.labels.checked ? "Showing data labels. Undo restores the chart." : "Hid the data labels. Undo restores them.")],
    [fields.position, "change", () => commit({ dataLabels: { position: fields.position.value } }, "Moved the data labels. Undo restores them.")],
    [fields.separator, "change", () => commit({ dataLabels: { separator: fields.separator.value } }, "Changed the label separator. Undo restores it.")],
    ...fields.contents.map((input) => [input, "change", () => {
      const content = selectedContent();
      // A label always shows something: unticking the last part keeps it.
      if (!content.length) { input.checked = true; return; }
      commit({ dataLabels: { content } }, "Changed what the data labels show. Undo restores them.");
    }]),
  ];
  for (const [element, type, handler] of listeners) element.addEventListener(type, handler);
  const unsubscribe = editor.subscribe?.(refresh);
  refresh();
  return {
    element: root,
    refresh,
    destroy() {
      for (const [element, type, handler] of listeners) element.removeEventListener(type, handler);
      if (typeof unsubscribe === "function") unsubscribe();
      root.remove();
    },
  };
}
