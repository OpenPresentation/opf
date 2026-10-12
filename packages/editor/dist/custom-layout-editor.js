// A small, local grid authoring dialog for OPF 0.19 layout templates.
import { LAYOUT_REGION_FLOWS, LAYOUT_REGION_KINDS, LAYOUT_REGION_ROLES, layoutFromGrid, saveCustomLayout } from "./layout-templates.js";

const element = (doc, tag, text) => { const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
const field = (doc, title, input) => { const label = element(doc, "label", title); label.className = "opf-grid-field"; label.append(input); return label; };
const select = (doc, values, current) => {
  const input = element(doc, "select");
  for (const value of values) { const option = element(doc, "option", value); option.value = value; input.append(option); }
  input.value = current;
  return input;
};

/** Draw rectangular areas, set each region's accepted kinds, role and flow, then save one undoable custom record. */
export function openCustomLayoutEditor(editor, options = {}) {
  const doc = options.document ?? globalThis.document;
  const dialog = element(doc, "dialog");
  dialog.className = "opf-sm-dialog opf-grid-dialog";
  const heading = element(doc, "h2", "Create a custom layout");
  heading.id = "opf-grid-title";
  dialog.setAttribute("aria-labelledby", heading.id);
  const error = element(doc, "p"); error.setAttribute("role", "alert"); error.className = "opf-sm-error";
  const id = element(doc, "input"); id.placeholder = "roadmap-split"; id.pattern = "[a-z][a-z0-9-]*"; id.required = true;
  const name = element(doc, "input"); name.placeholder = "Roadmap split"; name.required = true;
  const summary = element(doc, "input"); summary.placeholder = "When to use this layout";
  const width = element(doc, "input"); width.type = "number"; width.min = "1"; width.max = "12"; width.value = "3";
  const height = element(doc, "input"); height.type = "number"; height.min = "1"; height.max = "12"; height.value = "3";
  const paint = element(doc, "input"); paint.value = "content"; paint.placeholder = "content or . to erase";
  const grid = element(doc, "div"); grid.className = "opf-custom-layout-grid"; grid.setAttribute("aria-label", "Layout cells");
  const regionsPanel = element(doc, "div"); regionsPanel.className = "opf-grid-regions";
  const hint = element(doc, "p", "Choose an area name, then drag across cells to draw a rectangle. Use title for the heading and . to clear cells."); hint.className = "field-help";
  const body = element(doc, "div"); body.className = "opf-grid-body";
  body.append(field(doc, "Layout ID", id), field(doc, "Name", name), field(doc, "Summary", summary));
  const dimensions = element(doc, "div"); dimensions.className = "opf-grid-dimensions";
  dimensions.append(field(doc, "Columns", width), field(doc, "Rows", height), field(doc, "Paint area", paint));
  body.append(dimensions, hint, grid, regionsPanel, error);
  const cancel = element(doc, "button", "Cancel"); cancel.type = "button"; cancel.className = "secondary";
  const save = element(doc, "button", "Save layout"); save.type = "submit"; save.className = "primary";
  const actions = element(doc, "div"); actions.className = "opf-sm-actions"; actions.append(cancel, save);
  const form = element(doc, "form"); form.append(heading, body, actions); dialog.append(form);
  let cells = [["title", "title", "title"], ["content", "content", "content"], ["content", "content", "content"]];
  const settings = new Map();
  let down = null;
  const opener = doc.activeElement;
  const regionNames = () => [...new Set(cells.flat())].filter((value) => value !== "." && value !== "title" && value !== "subtitle");
  function resize() {
    const cols = Number(width.value), rows = Number(height.value);
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || cols > 12 || rows < 1 || rows > 12) return;
    cells = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => cells[y]?.[x] ?? "."));
    render();
  }
  function draw(from, to) {
    const value = paint.value.trim() || ".";
    if (value !== "." && !/^[a-z][a-z0-9-]*$/.test(value)) { error.textContent = "Use lowercase area names with letters, digits and hyphens."; return; }
    for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++)
      for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) cells[y][x] = value;
    error.textContent = ""; render();
    grid.querySelector(`[data-x="${to.x}"][data-y="${to.y}"]`)?.focus();
  }
  function render() {
    grid.replaceChildren(); grid.style.gridTemplateColumns = `repeat(${cells[0].length}, minmax(38px, 1fr))`;
    cells.forEach((row, y) => row.forEach((area, x) => {
      const cell = element(doc, "button", area); cell.type = "button"; cell.className = "opf-grid-cell"; cell.dataset.area = area;
      cell.setAttribute("aria-label", `Row ${y + 1}, column ${x + 1}: ${area === "." ? "empty" : area}`);
      cell.onpointerdown = (event) => { if (event.button !== 0) return; down = { x, y }; cell.setPointerCapture?.(event.pointerId); };
      cell.onpointerup = (event) => { if (!down) return; const target = doc.elementFromPoint?.(event.clientX, event.clientY)?.closest?.(".opf-grid-cell"); const last = target ? { x: Number(target.dataset.x), y: Number(target.dataset.y) } : { x, y }; draw(down, last); down = null; };
      cell.dataset.x = String(x); cell.dataset.y = String(y);
      cell.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); draw({ x, y }, { x, y }); } };
      grid.append(cell);
    }));
    regionsPanel.replaceChildren();
    for (const area of regionNames()) {
      const setting = settings.get(area) ?? { accepts: new Set(["text"]), role: "primary", flow: "auto" };
      settings.set(area, setting);
      const section = element(doc, "fieldset"); section.className = "opf-grid-region";
      section.append(element(doc, "legend", area));
      const kinds = element(doc, "div"); kinds.className = "opf-grid-kinds";
      for (const kind of LAYOUT_REGION_KINDS) {
        const check = element(doc, "input"); check.type = "checkbox"; check.value = kind; check.checked = setting.accepts.has(kind);
        check.onchange = () => { if (check.checked) setting.accepts.add(kind); else setting.accepts.delete(kind); };
        const label = element(doc, "label", kind); label.prepend(check); kinds.append(label);
      }
      const role = select(doc, LAYOUT_REGION_ROLES, setting.role); role.onchange = () => { setting.role = role.value; };
      const flow = select(doc, LAYOUT_REGION_FLOWS, setting.flow); flow.onchange = () => { setting.flow = flow.value; };
      section.append(element(doc, "span", "Accepts"), kinds, field(doc, "Role", role), field(doc, "Flow", flow)); regionsPanel.append(section);
    }
  }
  width.onchange = resize; height.onchange = resize;
  cancel.onclick = () => dialog.close();
  form.onsubmit = (event) => {
    event.preventDefault();
    try {
      const regions = Object.fromEntries(regionNames().map((area) => {
        const setting = settings.get(area);
        return [area, { accepts: [...setting.accepts], role: setting.role, flow: setting.flow }];
      }));
      const layout = layoutFromGrid({ id: id.value.trim(), name: name.value, summary: summary.value, cells, regions });
      saveCustomLayout(editor, layout);
      options.onSave?.(layout);
      dialog.close();
    } catch (cause) { error.textContent = cause?.issues?.[0]?.message ?? cause.message; }
  };
  dialog.onclose = () => { dialog.remove(); opener?.focus?.(); options.onClose?.(); };
  doc.body.append(dialog); render(); dialog.showModal(); id.focus();
  return { dialog, close: () => dialog.close() };
}
