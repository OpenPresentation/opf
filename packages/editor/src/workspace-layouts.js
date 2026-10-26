// CE-06 (promoted from examples/playground.js): Layout Studio inside the workspace. The layout editor (palette, canvas, layers, inspector)
// works on one layout record at a time; "Save to deck" writes it to `catalogs.custom.layouts` (one undoable edit) and "Use on this slide"
// also makes it the layout of the current slide. A bar above the editor picks which of the deck's own layouts to edit.
import { blankLayoutRecord, createLayoutEditor } from "./layout-editor.js";

const make = (doc, tag, attributes = {}, ...children) => {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === "text") node.textContent = value;
    else node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
};

/**
 * Mount Layout Studio in `container`. Returns `{ element, refresh, destroy, load }`. `refresh()` re-reads the deck's layouts into the picker (call it
 * when the view opens); `load(id)` edits the deck's layout `id`, or a new layout for `""`.
 */
export function createLayoutStudio(container, { session, toSvg, fonts, renderOptions, getSlideIndex, onStatus, density = "comfortable", readOnly = false, labels = {} }) {
  const doc = container.ownerDocument;
  const text = { layout: "Layout", pick: "Layout to edit", fresh: "New layout", save: "Save to deck", apply: "Use on this slide", ...labels };
  const pick = make(doc, "select", { "data-opf-layouts": "pick", "aria-label": text.pick }, make(doc, "option", { value: "", text: text.fresh }));
  const save = make(doc, "button", { type: "button", "data-opf-layouts": "save", text: text.save });
  const apply = make(doc, "button", { type: "button", "data-opf-layouts": "apply", text: text.apply });
  const status = make(doc, "span", { "data-opf-layouts": "status", role: "status", class: "opf-ws-layouts-status" });
  const bar = make(doc, "div", { class: "opf-ws-layouts-bar" }, make(doc, "label", { class: "opf-ws-layouts-pick", text: `${text.layout} ` }, pick), save, apply, status);
  const host = make(doc, "div", { class: "opf-ws-layouts-host" });
  container.replaceChildren(bar, host);
  save.disabled = apply.disabled = readOnly;

  const customLayouts = () => session.presentation.catalogs?.custom?.layouts ?? {};
  function freeLayoutId() {
    const taken = customLayouts();
    if (!taken["my-layout"]) return "my-layout";
    for (let n = 2; ; n++) if (!taken[`my-layout-${n}`]) return `my-layout-${n}`;
  }
  const say = (message) => { status.textContent = message; };
  function refresh() {
    const current = pick.value;
    const layouts = customLayouts();
    pick.replaceChildren(new Option(text.fresh, ""), ...Object.entries(layouts).map(([id, record]) => new Option(`${record.name || id} (${id})`, id)));
    pick.value = current in layouts ? current : "";
  }
  const editor = createLayoutEditor(host, { record: { ...blankLayoutRecord(), id: freeLayoutId() }, toSvg, fonts, renderOptions, density, readOnly });
  function load(id) {
    const layouts = customLayouts();
    editor.setRecord(id ? { id, ...structuredClone(layouts[id]) } : { ...blankLayoutRecord(), id: freeLayoutId() });
    say(id ? `Editing ${id}. Save to deck replaces it.` : "A new layout. Save to deck adds it to this presentation.");
  }
  const problem = (error) => error.issues?.[0]?.message ?? error.message;
  pick.onchange = () => load(pick.value);
  save.onclick = () => {
    const replace = pick.value === editor.getRecord().id;
    try {
      const change = editor.saveToDeck(session, { replace });
      refresh();
      pick.value = change.layoutId;
      say(`Saved ${change.layoutId} in custom layouts`);
      onStatus?.(`Saved ${change.layoutId} in custom layouts`);
    } catch (error) { say(problem(error)); }
  };
  apply.onclick = () => {
    try {
      const slideIndex = getSlideIndex();
      const change = editor.applyToSlide(session, slideIndex);
      refresh();
      pick.value = change.layoutId;
      say(`Slide ${slideIndex + 1} now uses ${change.layoutId}`);
    } catch (error) { say(problem(error)); }
  };
  refresh();
  load("");
  return {
    element: bar.parentElement,
    editor,
    pick, save, apply, status,
    refresh,
    load,
    setReadOnly(on) { editor.setReadOnly(on); save.disabled = apply.disabled = on; },
    setDensity(next) { editor.setDensity(next); },
    destroy() { editor.destroy(); container.replaceChildren(); },
  };
}
