// The tool palette of the layout editor (RR-99): a vertical icon toolbar, as in Figma. It sets the model's active tool; the canvas acts on it.
import { createLayoutModel } from "./layout-model.js";
import { createDom, handleGlobalShortcut } from "./layout-editor-ui.js";

/** The tools, in palette order. `key` is the shortcut letter. */
export const LAYOUT_TOOL_DEFS = Object.freeze([
  { id: "select", label: "Select", key: "V", icon: "MousePointer2", help: "Click a region to select it. Click again inside a split to select what is inside." },
  { id: "split-row", label: "Split into a row", key: "R", icon: "Columns2", help: "Click a region to split it into two side by side." },
  { id: "split-column", label: "Split into a column", key: "C", icon: "Rows2", help: "Click a region to split it into two, one above the other." },
  { id: "insert", label: "Insert region", key: "I", icon: "BetweenHorizontalStart", help: "Click between regions, or at the edge of a split, to insert a region there." },
  { id: "heading", label: "Heading regions", key: "T", icon: "Heading", help: "Add or remove the title and subtitle regions." },
  { id: "hand", label: "Hand", key: "H", icon: "Hand", help: "Drag to pan the slide when it is zoomed. Hold Space for the same." },
]);
export const LAYOUT_PREVIEW_DEF = Object.freeze({ id: "preview", label: "Preview", key: "P", icon: "Eye", help: "Show sample content in each region." });

/**
 * Mount the tool palette in `container`. Options: `model` (shared state; one is created when omitted, with `record`, `density` and the
 * other model options), `orientation` ("vertical" or "horizontal"), `label` (accessible name of the toolbar). Returns `{ element, model,
 * refresh, destroy }`.
 */
export function createLayoutToolPalette(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const dom = createDom(container.ownerDocument);
  const ownModel = !options.model;
  const model = options.model ?? createLayoutModel(options);
  const orientation = options.orientation === "horizontal" ? "horizontal" : "vertical";
  const root = dom.el("div", "opf-lx-palette opf-ui", { role: "toolbar", "aria-orientation": orientation, "aria-label": options.label ?? "Layout tools", "data-density": model.density, "data-orientation": orientation });
  const buttons = new Map();
  const make = (def, toggle) => {
    const node = dom.button("opf-lx-tool", { label: def.label, iconName: def.icon, size: 18, pressed: false, title: `${def.label} (${def.key})`, attributes: { "data-tool": def.id, "aria-keyshortcuts": def.key } });
    node.addEventListener("click", () => { if (toggle) model.setPreview(!model.preview); else model.setTool(model.tool === def.id && def.id !== "select" ? "select" : def.id); });
    buttons.set(def.id, node);
    return node;
  };
  for (const def of LAYOUT_TOOL_DEFS) root.append(make(def, false));
  root.append(dom.el("span", "opf-lx-tool-gap", { role: "separator", "aria-orientation": orientation === "vertical" ? "horizontal" : "vertical" }));
  root.append(make(LAYOUT_PREVIEW_DEF, true));
  container.append(root);

  let rover = "select";
  function paint() {
    root.dataset.density = model.density;
    for (const [id, node] of buttons) {
      const on = id === "preview" ? model.preview : model.tool === id;
      node.setAttribute("aria-pressed", String(on));
      node.classList.toggle("is-active", on);
      node.tabIndex = id === rover ? 0 : -1;
      node.disabled = model.readOnly && id !== "hand" && id !== "preview" && id !== "select";
    }
  }
  const unsubscribe = model.subscribe((event) => {
    if (event.type === "tool" || event.type === "view" || event.type === "load") { if (event.type === "tool" && buttons.has(model.tool)) rover = model.tool; paint(); }
  });
  root.addEventListener("focusin", (event) => { const id = event.target.dataset?.tool; if (id && buttons.has(id)) { rover = id; for (const [key, node] of buttons) node.tabIndex = key === rover ? 0 : -1; } });
  root.addEventListener("keydown", (event) => {
    if (handleGlobalShortcut(event, model)) return;
    const order = [...buttons.keys()].filter((id) => !buttons.get(id).disabled);
    const at = order.indexOf(event.target.dataset?.tool);
    // Both axes move along the toolbar: it is a column on a wide editor and a row on a narrow one.
    let to = -1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") to = (at + 1) % order.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") to = (at - 1 + order.length) % order.length;
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = order.length - 1;
    if (to < 0) return;
    event.preventDefault();
    buttons.get(order[to]).focus();
  });
  paint();

  return {
    element: root,
    model,
    refresh: paint,
    destroy() { unsubscribe(); root.remove(); if (ownModel) model.destroy(); },
  };
}
