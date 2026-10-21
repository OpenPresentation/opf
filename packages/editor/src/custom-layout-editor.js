// A small, local authoring dialog for layout records (FA-33): one ordered list of regions, each with its size and rules, and splits that
// nest regions in the other direction for two dimensions.
import { LAYOUT_DIRECTIONS, LAYOUT_MAX_DEPTH, LAYOUT_MAX_ENTRIES, LAYOUT_REGION_FLOWS, LAYOUT_REGION_KINDS, LAYOUT_REGION_ROLES, layoutFromRegions, saveCustomLayout } from "./layout-templates.js";
import { buildLayoutDiagram } from "./layout-diagram.js";

const element = (doc, tag, text) => { const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
const field = (doc, title, input) => { const label = element(doc, "label", title); label.className = "opf-grid-field"; label.append(input); return label; };
const select = (doc, values, current, labels = {}) => {
  const input = element(doc, "select");
  for (const value of values) { const option = element(doc, "option", labels[value] ?? value); option.value = value; input.append(option); }
  input.value = current;
  return input;
};
// A button whose accessible name says which region it acts on: `label(name)` is recomputed when the region is renamed.
const button = (doc, text, label, onclick, disabled = false) => {
  const node = element(doc, "button", text); node.type = "button"; node.className = "secondary opf-grid-action"; node.disabled = disabled; node.onclick = onclick;
  node.relabel = (regionName) => node.setAttribute("aria-label", label(regionName));
  return node;
};
const HEADINGS = new Set(["title", "subtitle"]);
const isHeading = (item) => item.type === "region" && HEADINGS.has(item.name.trim());
const OTHER = { row: "column", column: "row" };

/**
 * Add regions in reading order, give each its size and rules, split a region to place regions beside or above each other, then save
 * one undoable custom record. A size is a number (a share of the row or column, default 1) or "auto" (a column only).
 */
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
  const direction = select(doc, LAYOUT_DIRECTIONS, "column", { row: "Row (side by side)", column: "Column (stacked)" });
  const structure = element(doc, "div"); structure.className = "opf-grid-structure";
  const tree = element(doc, "div"); tree.className = "opf-grid-regions";
  const hint = element(doc, "p", "Regions are listed in reading order. A row places them side by side, a column stacks them. Split a region to place regions the other way inside it. Name a region title or subtitle to make it a heading."); hint.className = "field-help";
  const body = element(doc, "div"); body.className = "opf-grid-body";
  body.append(field(doc, "Layout ID", id), field(doc, "Name", name), field(doc, "Summary", summary));
  const dimensions = element(doc, "div"); dimensions.className = "opf-grid-dimensions";
  dimensions.append(field(doc, "Direction", direction));
  body.append(dimensions, hint, structure, tree, error);
  const cancel = element(doc, "button", "Cancel"); cancel.type = "button"; cancel.className = "secondary";
  const save = element(doc, "button", "Save layout"); save.type = "submit"; save.className = "primary";
  const actions = element(doc, "div"); actions.className = "opf-sm-actions"; actions.append(cancel, save);
  const form = element(doc, "form"); form.append(heading, body, actions); dialog.append(form);

  let serial = 0;
  const uid = () => `r${++serial}`;
  const newRegion = (regionName) => ({ type: "region", uid: uid(), name: regionName, size: "", accepts: new Set(["text"]), role: "primary", flow: "auto" });
  const state = { regions: [newRegion("title"), newRegion("content")] };
  const opener = doc.activeElement;
  let focus = null;

  const allItems = (list = state.regions) => list.flatMap((item) => item.type === "split" ? [item, ...allItems(item.regions)] : [item]);
  const freeName = () => {
    const used = new Set(allItems().map((item) => item.name));
    for (let n = 1; ; n++) if (!used.has(`region-${n}`)) return `region-${n}`;
  };
  const parseSize = (text) => { const value = text.trim(); if (!value) return undefined; if (value === "auto") return "auto"; const number = Number(value); return Number.isFinite(number) ? number : value; };
  const toInput = (list) => list.map((item) => {
    const size = parseSize(item.size);
    const sized = size === undefined ? {} : { size };
    if (item.type === "split") return { direction: item.direction, ...sized, regions: toInput(item.regions) };
    const regionName = item.name.trim();
    if (HEADINGS.has(regionName)) return { name: regionName, ...sized };
    return { name: regionName, ...sized, accepts: [...item.accepts], role: item.role, flow: item.flow };
  });
  const refreshStructure = () => {
    structure.replaceChildren(buildLayoutDiagram(doc, { direction: direction.value, regions: toInput(state.regions) }));
    structure.setAttribute("role", "img");
    structure.setAttribute("aria-label", `Layout structure: ${allItems().filter((item) => item.type === "region").map((item) => item.name.trim() || "unnamed").join(", ")}`);
  };
  const forbidAuto = (list) => { for (const item of list) if (item.size.trim() === "auto") item.size = ""; };
  const rerender = (where) => { focus = where ?? null; render(); };

  function renderList(list, parent, level) {
    const ol = element(doc, "ol"); ol.className = "opf-grid-list";
    ol.setAttribute("aria-label", parent === "row" ? "Regions, left to right" : "Regions, top to bottom");
    list.forEach((item, index) => {
      const li = element(doc, "li"); li.dataset.uid = item.uid;
      const split = item.type === "split";
      const section = element(doc, "fieldset"); section.className = split ? "opf-grid-split" : "opf-grid-region";
      const legend = element(doc, "legend", split ? `Split ${item.direction === "row" ? "side by side" : "stacked"}` : item.name || "unnamed");
      section.append(legend);
      const controls = element(doc, "div"); controls.className = "opf-grid-controls";
      let nameInput = null;
      if (split) {
        const inner = select(doc, LAYOUT_DIRECTIONS, item.direction, { row: "Row (side by side)", column: "Column (stacked)" });
        inner.setAttribute("data-control", "direction");
        inner.onchange = () => { item.direction = inner.value; if (item.direction === "row") forbidAuto(item.regions); rerender({ uid: item.uid, control: "direction" }); };
        controls.append(field(doc, "Split direction", inner));
      } else {
        const regionName = element(doc, "input"); regionName.value = item.name; regionName.setAttribute("data-control", "name"); regionName.pattern = "[a-z][a-z0-9-]*";
        regionName.oninput = () => { item.name = regionName.value; legend.textContent = item.name || "unnamed"; refreshStructure(); };
        regionName.onchange = () => { if (HEADINGS.has(item.name.trim()) !== Boolean(section.dataset.heading)) rerender({ uid: item.uid, control: "name" }); };
        controls.append(field(doc, "Region name", regionName));
        nameInput = regionName;
      }
      const size = element(doc, "input"); size.value = item.size; size.setAttribute("data-control", "size"); size.inputMode = "decimal";
      size.placeholder = isHeading(item) && parent === "column" ? "auto" : "1";
      size.oninput = () => { item.size = size.value; refreshStructure(); };
      controls.append(field(doc, parent === "column" ? "Size (height share or auto)" : "Size (width share)", size));
      section.append(controls);
      if (!split && isHeading(item)) {
        section.dataset.heading = "true";
        const note = element(doc, "p", "A heading region holds the slide's headings and takes only a size."); note.className = "field-help"; section.append(note);
      } else if (!split) {
        const kinds = element(doc, "div"); kinds.className = "opf-grid-kinds";
        for (const kind of LAYOUT_REGION_KINDS) {
          const check = element(doc, "input"); check.type = "checkbox"; check.value = kind; check.checked = item.accepts.has(kind);
          check.onchange = () => { if (check.checked) item.accepts.add(kind); else item.accepts.delete(kind); };
          const label = element(doc, "label", kind); label.prepend(check); kinds.append(label);
        }
        const role = select(doc, LAYOUT_REGION_ROLES, item.role); role.onchange = () => { item.role = role.value; };
        const flow = select(doc, LAYOUT_REGION_FLOWS, item.flow); flow.onchange = () => { item.flow = flow.value; };
        const rules = element(doc, "div"); rules.className = "opf-grid-rules"; rules.append(field(doc, "Role", role), field(doc, "Flow", flow));
        section.append(element(doc, "span", "Accepts"), kinds, rules);
      }
      const tools = element(doc, "div"); tools.className = "opf-grid-tools";
      tools.append(
        button(doc, "Move up", (who) => `Move ${who} up`, () => { list.splice(index - 1, 0, list.splice(index, 1)[0]); rerender({ uid: item.uid, control: "up" }); }, index === 0),
        button(doc, "Move down", (who) => `Move ${who} down`, () => { list.splice(index + 1, 0, list.splice(index, 1)[0]); rerender({ uid: item.uid, control: "down" }); }, index === list.length - 1),
      );
      if (!split && !isHeading(item)) {
        tools.append(button(doc, "Split", (who) => `Split ${who}`, () => {
          const sibling = newRegion(freeName());
          const wrapper = { type: "split", uid: uid(), direction: OTHER[parent], size: item.size, regions: [item, sibling] };
          item.size = "";
          list.splice(index, 1, wrapper);
          rerender({ uid: sibling.uid, control: "name" });
        }, level >= LAYOUT_MAX_DEPTH));
      }
      tools.append(button(doc, "Remove", (who) => `Remove ${who}`, () => {
        if (list.length === 1) { error.textContent = "A list needs at least one region. Remove the split instead."; return; }
        list.splice(index, 1); error.textContent = "";
        rerender({ uid: list[Math.min(index, list.length - 1)].uid, control: "name" });
      }));
      const relabel = () => { for (const node of tools.querySelectorAll("button")) node.relabel(split ? "split" : item.name.trim() || "region"); };
      relabel();
      nameInput?.addEventListener("input", relabel);
      section.append(tools);
      if (split) section.append(renderList(item.regions, item.direction, level + 1));
      li.append(section); ol.append(li);
    });
    const add = button(doc, "Add region", () => `Add a region to this ${parent === "row" ? "row" : "column"}`, () => {
      const created = newRegion(freeName()); list.push(created); rerender({ uid: created.uid, control: "name" });
    }, list.length >= LAYOUT_MAX_ENTRIES);
    add.relabel();
    const wrap = element(doc, "div"); wrap.className = "opf-grid-list-wrap"; wrap.append(ol, add);
    return wrap;
  }
  function render() {
    tree.replaceChildren(renderList(state.regions, direction.value, 1));
    refreshStructure();
    if (focus) {
      const target = tree.querySelector(`[data-uid="${focus.uid}"] [data-control="${focus.control}"]`) ?? tree.querySelector(`[data-uid="${focus.uid}"] button:not(:disabled)`);
      target?.focus();
      focus = null;
    }
  }
  direction.onchange = () => {
    // "auto" sizes are allowed only in a column.
    if (direction.value === "row") forbidAuto(state.regions);
    render();
  };
  cancel.onclick = () => dialog.close();
  form.onsubmit = (event) => {
    event.preventDefault();
    try {
      const layout = layoutFromRegions({ id: id.value.trim(), name: name.value, summary: summary.value, direction: direction.value, regions: toInput(state.regions) });
      saveCustomLayout(editor, layout);
      options.onSave?.(layout);
      dialog.close();
    } catch (cause) { error.textContent = cause?.issues?.[0]?.message ?? cause.message; }
  };
  dialog.onclose = () => { dialog.remove(); opener?.focus?.(); options.onClose?.(); };
  doc.body.append(dialog); render(); dialog.showModal(); id.focus();
  return { dialog, close: () => dialog.close() };
}
