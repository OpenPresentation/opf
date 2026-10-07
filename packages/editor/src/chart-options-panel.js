// The chart options panel (RR-35): axis titles, legend position and data labels for the selected chart, plus (FA-09) its alt text and
// (FA-14) which series and categories to highlight.
// It mounts into any host element over an editor session; every control commits one undoable change through
// `setChartOptions` (src/chart-options.js), the canvas redraws, and Undo restores the chart. The panel shows only what
// the selected chart type can show (core's support table), and hides itself when no chart is selected. On a combo chart
// (FA-15) a "Series" group sets which series are lines and which lines use the secondary value axis, and a secondary axis
// title field appears while a line uses that axis.
import { CHART_LABEL_CONTENT, CHART_LEGEND_POSITIONS, chartOptionsAvailable, parseChartPath, readChartOptions, setChartOptions } from "./chart-options.js";

const LEGEND_LABELS = { default: "Default", none: "None", top: "Top", bottom: "Bottom", left: "Left", right: "Right" };
const CONTENT_LABELS = { category: "Category", value: "Value", percent: "Percent" };
const POSITION_LABELS = { auto: "Automatic", center: "Center", "inside-end": "Inside end", "inside-base": "Inside base", "outside-end": "Outside end", above: "Above", below: "Below", left: "Left", right: "Right" };

let counter = 0;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

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
    <div class="opf-co-group" data-group="alt">
      <label class="opf-co-row"><span>Alt text</span><input type="text" id="${id}-alt" aria-label="Chart alt text" data-opf-chart-option="alt" autocomplete="off" placeholder="What the chart shows"></label>
      <label class="opf-co-row opf-co-check"><input type="checkbox" id="${id}-decorative" aria-label="Decorative chart" data-opf-chart-option="alt.decorative"><span>Decorative (no alt text)</span></label>
    </div>
    <div class="opf-co-group" data-group="axisTitles">
      <label class="opf-co-row" data-axis="category"><span>Category axis title</span><input type="text" id="${id}-category" aria-label="Category axis title" data-opf-chart-option="axisTitles.category" autocomplete="off"></label>
      <label class="opf-co-row" data-axis="value"><span>Value axis title</span><input type="text" id="${id}-value" aria-label="Value axis title" data-opf-chart-option="axisTitles.value" autocomplete="off"></label>
      <label class="opf-co-row" data-axis="secondary"><span>Secondary axis title</span><input type="text" id="${id}-secondary" aria-label="Secondary axis title" data-opf-chart-option="axisTitles.secondary" autocomplete="off"></label>
    </div>
    <fieldset class="opf-co-group opf-co-series" data-group="combo"><legend>Series</legend><div data-row="combo-series"></div></fieldset>
    <div class="opf-co-group" data-group="legend">
      <label class="opf-co-row"><span>Legend</span><select id="${id}-legend" aria-label="Legend" data-opf-chart-option="legend">${CHART_LEGEND_POSITIONS.map((value) => `<option value="${value}">${LEGEND_LABELS[value]}</option>`).join("")}</select></label>
    </div>
    <div class="opf-co-group" data-group="dataLabels">
      <label class="opf-co-row opf-co-check"><input type="checkbox" id="${id}-labels" aria-label="Data labels" data-opf-chart-option="dataLabels.on"><span>Data labels</span></label>
      <fieldset class="opf-co-content"><legend>Label shows</legend>${CHART_LABEL_CONTENT.map((part) => `<label class="opf-co-check"><input type="checkbox" value="${part}" aria-label="Label shows ${CONTENT_LABELS[part].toLowerCase()}" data-opf-chart-option="dataLabels.content.${part}"><span>${CONTENT_LABELS[part]}</span></label>`).join("")}</fieldset>
      <label class="opf-co-row" data-row="position"><span>Label position</span><select id="${id}-position" aria-label="Label position" data-opf-chart-option="dataLabels.position"></select></label>
      <label class="opf-co-row" data-row="separator"><span>Separator</span><input type="text" id="${id}-separator" aria-label="Label separator" data-opf-chart-option="dataLabels.separator" autocomplete="off"></label>
    </div>
    <div class="opf-co-group" data-group="highlight">
      <fieldset class="opf-co-highlight" data-part="series"><legend>Highlight series</legend><div class="opf-co-choices" data-choices="series"></div></fieldset>
      <fieldset class="opf-co-highlight" data-part="categories"><legend>Highlight categories</legend><div class="opf-co-choices" data-choices="categories"></div></fieldset>
    </div>`;
  host.append(root);
  const $ = (selector) => root.querySelector(selector);
  const fields = {
    alt: $(`#${id}-alt`), decorative: $(`#${id}-decorative`), category: $(`#${id}-category`), value: $(`#${id}-value`), secondary: $(`#${id}-secondary`), legend: $(`#${id}-legend`), labels: $(`#${id}-labels`),
    series: $("[data-row='combo-series']"),
    position: $(`#${id}-position`), separator: $(`#${id}-separator`), contents: [...root.querySelectorAll("[data-opf-chart-option^='dataLabels.content.']")],
    highlight: { series: $("[data-choices='series']"), categories: $("[data-choices='categories']") },
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
    const { fields: support, state, choices, combo } = readChartOptions(chart, editor.document);
    root.hidden = false;
    const setValue = (input, value) => { if (input !== document.activeElement && input.value !== value) input.value = value; };
    setValue(fields.alt, state.alt);
    fields.decorative.checked = state.decorative;
    fields.alt.disabled = state.decorative;
    const secondaryInUse = Boolean(combo?.series.some((entry) => entry.axis === "secondary"));
    for (const axis of ["category", "value", "secondary"]) {
      $(`[data-axis="${axis}"]`).hidden = !support.axisTitles[axis] || (axis === "secondary" && !secondaryInUse);
      setValue(fields[axis], state.axisTitles[axis]);
    }
    // FA-15: one row per plotted series of a combo chart: "Line" and, for a line, "Secondary axis".
    $("[data-group='combo']").hidden = !combo;
    const series = combo?.series ?? [];
    const signature = JSON.stringify(series.map((entry) => entry.name));
    if (fields.series.dataset.series !== signature) {
      fields.series.innerHTML = series.map((entry, index) => `<div class="opf-co-row opf-co-series-row" data-series="${index}"><span>${escapeHtml(entry.name)}</span>` +
        `<label class="opf-co-check"><input type="checkbox" data-opf-chart-option="line" value="${escapeHtml(entry.name)}" aria-label="${escapeHtml(entry.name)} as a line"><span>Line</span></label>` +
        `<label class="opf-co-check"><input type="checkbox" data-opf-chart-option="secondaryAxis" value="${escapeHtml(entry.name)}" aria-label="${escapeHtml(entry.name)} on the secondary axis"><span>Secondary axis</span></label></div>`).join("");
      fields.series.dataset.series = signature;
    }
    series.forEach((entry, index) => {
      const row = fields.series.querySelector(`[data-series="${index}"]`);
      const line = row.querySelector("[data-opf-chart-option='line']"), secondary = row.querySelector("[data-opf-chart-option='secondaryAxis']");
      line.checked = entry.role === "line";
      secondary.checked = entry.axis === "secondary";
      secondary.disabled = entry.role !== "line";
    });
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
    // Highlight: one checkbox per plotted series and per category label the chart type can highlight.
    for (const part of ["series", "categories"]) {
      const offered = support.highlight[part] && choices[part].length > 0;
      $(`[data-part='${part}']`).hidden = !offered;
      const list = fields.highlight[part];
      if (!offered) continue;
      if (list.dataset.options !== JSON.stringify(choices[part])) {
        list.replaceChildren(...choices[part].map((name) => {
          const label = document.createElement("label");
          label.className = "opf-co-check";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.value = name;
          input.setAttribute("aria-label", `Highlight ${part === "series" ? "series" : "category"} ${name}`);
          input.setAttribute("data-opf-chart-option", `highlight.${part}`);
          const text = document.createElement("span");
          text.textContent = name;
          label.append(input, text);
          return label;
        }));
        list.dataset.options = JSON.stringify(choices[part]);
      }
      for (const input of list.querySelectorAll("input")) input.checked = state.highlight[part].includes(input.value);
    }
    $("[data-group='highlight']").hidden = $("[data-part='series']").hidden && $("[data-part='categories']").hidden;
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

  const checkedNames = (part) => [...fields.highlight[part].querySelectorAll("input:checked")].map((input) => input.value);
  const selectedContent = () => fields.contents.filter((input) => input.checked && !input.closest("label").hidden).map((input) => input.value);
  const listeners = [
    [fields.alt, "change", () => commit({ alt: fields.alt.value }, "Changed the chart's alt text. Undo restores it.")],
    [fields.decorative, "change", () => commit({ decorative: fields.decorative.checked }, fields.decorative.checked ? "Marked the chart decorative. Undo restores it." : "The chart is no longer decorative. Undo restores it.")],
    [fields.category, "change", () => commit({ axisTitles: { category: fields.category.value } }, "Changed the category axis title. Undo restores it.")],
    [fields.value, "change", () => commit({ axisTitles: { value: fields.value.value } }, "Changed the value axis title. Undo restores it.")],
    [fields.secondary, "change", () => commit({ axisTitles: { secondary: fields.secondary.value } }, "Changed the secondary axis title. Undo restores it.")],
    [fields.series, "change", () => {
      const checked = (option) => [...fields.series.querySelectorAll(`[data-opf-chart-option='${option}']`)].filter((input) => input.checked).map((input) => input.value);
      const line = checked("line");
      commit({ line, secondaryAxis: checked("secondaryAxis").filter((name) => line.includes(name)) }, "Changed which series are lines. Undo restores them.");
    }],
    [fields.legend, "change", () => commit({ legend: fields.legend.value }, "Changed the legend. Undo restores it.")],
    [fields.labels, "change", () => commit({ dataLabels: fields.labels.checked }, fields.labels.checked ? "Showing data labels. Undo restores the chart." : "Hid the data labels. Undo restores them.")],
    [fields.position, "change", () => commit({ dataLabels: { position: fields.position.value } }, "Moved the data labels. Undo restores them.")],
    [fields.separator, "change", () => commit({ dataLabels: { separator: fields.separator.value } }, "Changed the label separator. Undo restores it.")],
    ...["series", "categories"].map((part) => [fields.highlight[part], "change", () => {
      const names = checkedNames(part);
      commit({ highlight: { [part]: names } }, names.length ? `Highlighted ${names.join(", ")}. Undo restores the colors.` : `Cleared the ${part} highlight. Undo restores it.`);
    }]),
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
