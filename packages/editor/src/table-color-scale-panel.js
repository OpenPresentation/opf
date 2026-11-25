// The table color scale panel (FR-07): the columns to shade (checkboxes of the number columns), sequential or diverging, `from`, `mid` and
// `to` as scheme colors (a color of the deck's scheme, never a custom color), `center`, and an optional pinned range. Every control commits one
// undoable change through `setTableColorScale` (src/table-color-scale.js) and the canvas re-shades at once. The panel hides itself when no table
// is selected. It reuses the chart options panel's classes (`opf-co-*`).
import { TABLE_SCALE_COLORS, parseTablePath, readTableColorScale, setTableColorScale } from "./table-color-scale.js";
import { getValueAtPath, splitOpfPath } from "./index.js";

let counter = 0;

/**
 * Mount the panel in `host`. `getSelectedPath()` returns the selected OPF path (any path inside a table selects it); `onStatus(message)` receives
 * a short message after each change. Returns `{ element, refresh, destroy }`; call `refresh()` when the selection changes (the panel also
 * refreshes on every editor change).
 */
export function createTableColorScalePanel(host, { editor, getSelectedPath, onStatus = () => {} }) {
  const id = `opf-table-scale-${++counter}`;
  const root = document.createElement("section");
  root.className = "opf-chart-options opf-table-scale";
  root.setAttribute("aria-label", "Color scale");
  root.hidden = true;
  const colorOptions = (selected, allowNone) => `${allowNone ? '<option value="">None</option>' : ""}${TABLE_SCALE_COLORS.map((name) => `<option value="${name}"${name === selected ? " selected" : ""}>${name}</option>`).join("")}`;
  root.innerHTML = `
    <h3 class="opf-co-title">Color scale</h3>
    <fieldset class="opf-co-group" data-group="columns"><legend>Shade columns</legend><div class="opf-co-choices" data-choices="columns"></div></fieldset>
    <div class="opf-co-group" data-group="scale">
      <label class="opf-co-row"><span>Kind</span><select id="${id}-kind" aria-label="Color scale kind" data-opf-scale="kind"><option value="sequential">Sequential</option><option value="diverging">Diverging</option></select></label>
      <label class="opf-co-row"><span>Lowest</span><select id="${id}-low" aria-label="Color of the lowest value" data-opf-scale="low">${colorOptions("surface", false)}</select></label>
      <label class="opf-co-row" data-row="mid"><span>Middle</span><select id="${id}-mid" aria-label="Color of the center" data-opf-scale="mid">${colorOptions("surface", false)}</select></label>
      <label class="opf-co-row"><span>Highest</span><select id="${id}-high" aria-label="Color of the highest value" data-opf-scale="high">${colorOptions("primary", false)}</select></label>
      <label class="opf-co-row" data-row="center"><span>Center</span><input type="number" step="any" id="${id}-center" aria-label="Value drawn in the middle color" data-opf-scale="center" placeholder="Automatic"></label>
      <label class="opf-co-row"><span>Range from</span><input type="number" step="any" id="${id}-min" aria-label="Lowest value of the range" data-opf-scale="min" placeholder="Lowest number"></label>
      <label class="opf-co-row"><span>Range to</span><input type="number" step="any" id="${id}-max" aria-label="Highest value of the range" data-opf-scale="max" placeholder="Highest number"></label>
    </div>`;
  host.append(root);
  const $ = (selector) => root.querySelector(selector);
  let tablePath;

  const tableNow = () => {
    if (!tablePath) return undefined;
    try {
      return getValueAtPath(editor.presentation, splitOpfPath(tablePath));
    } catch {
      return undefined;
    }
  };
  const commit = (change) => {
    try {
      const result = setTableColorScale(editor, tablePath, change);
      if (result.changed) onStatus("Color scale updated");
    } catch (error) {
      onStatus(error.message);
      refresh();
    }
  };
  const fillInput = (input, value) => { if (document.activeElement !== input) input.value = value === undefined ? "" : String(value); };

  function refresh() {
    const selected = getSelectedPath?.();
    tablePath = typeof selected === "string" ? parseTablePath(selected) : undefined;
    const table = tableNow();
    root.hidden = !table;
    if (!table) return;
    const state = readTableColorScale(table, editor.presentation);
    const choices = $('[data-choices="columns"]');
    choices.replaceChildren(...state.columns.filter((column) => column.numeric).map((column) => {
      const label = document.createElement("label");
      label.className = "opf-co-check";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = column.shaded;
      box.setAttribute("aria-label", `Shade ${column.name}`);
      box.dataset.column = column.name;
      label.append(box, document.createTextNode(` ${column.name}`));
      return label;
    }));
    const on = state.kind !== "none";
    for (const control of root.querySelectorAll("[data-opf-scale]")) control.disabled = !on && control.dataset.opfScale !== "kind";
    $('[data-opf-scale="kind"]').value = state.kind === "diverging" ? "diverging" : "sequential";
    const [low, middle, high] = state.colors.length === 3 ? state.colors : [state.colors[0], undefined, state.colors[1]];
    $('[data-opf-scale="low"]').value = low;
    $('[data-opf-scale="high"]').value = high;
    $('[data-opf-scale="mid"]').value = middle ?? "surface";
    $('[data-row="mid"]').hidden = $('[data-row="center"]').hidden = state.kind !== "diverging";
    fillInput($('[data-opf-scale="center"]'), state.center);
    fillInput($('[data-opf-scale="min"]'), state.min);
    fillInput($('[data-opf-scale="max"]'), state.max);
  }

  const onChange = (event) => {
    const target = event.target;
    if (!tablePath || !(target instanceof HTMLElement)) return;
    if (target.dataset.column !== undefined) {
      const state = readTableColorScale(tableNow(), editor.presentation);
      const names = state.columns.filter((column) => column.shaded && column.name !== target.dataset.column).map((column) => column.name);
      if (target.checked) names.push(target.dataset.column);
      commit({ columns: names });
      return;
    }
    const key = target.dataset.opfScale;
    if (!key) return;
    if (key === "kind") commit({ kind: target.value });
    else if (key === "center" || key === "min" || key === "max") commit({ [key]: target.value === "" ? null : Number(target.value) });
    else {
      // Two or three swatches in order: the lowest, the middle (diverging only) and the highest.
      const state = readTableColorScale(tableNow(), editor.presentation);
      const colors = [...state.colors];
      if (key === "low") colors[0] = target.value;
      else if (key === "high") colors[colors.length - 1] = target.value;
      else if (key === "mid" && colors.length === 3) colors[1] = target.value;
      commit({ colors });
    }
  };
  root.addEventListener("change", onChange);
  const unsubscribe = editor.subscribe?.(() => refresh());
  refresh();
  return { element: root, refresh, destroy() { root.removeEventListener("change", onChange); unsubscribe?.(); root.remove(); } };
}
