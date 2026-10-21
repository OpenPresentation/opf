// The layout editor (RR-99): a Figma-style GUI for building one OPF layout record, a `direction` plus an ordered `regions` list of regions
// and splits. `createLayoutEditor` composes four parts that are exported separately, so a host can arrange them differently: the tool
// palette, the canvas, the layers tree and the inspector. They share one model (the record, the selection, the tool, core's validation
// and the editor's own undo history). Plain DOM, styled only by `--opf-ui-*` tokens (src/styles/layout-editor.css); no network.
import { mergeCatalogs } from "./catalogs.js";
import { fail } from "./edit-helpers.js";
import { prepareDimensionSwitch } from "./switches.js";
import { prepareCustomLayout, saveCustomLayout } from "./layout-templates.js";
import { createLayoutCanvas } from "./layout-canvas.js";
import { createLayoutInspector } from "./layout-inspector.js";
import { createLayoutTree } from "./layout-layers.js";
import { createLayoutModel, layoutForCatalog } from "./layout-model.js";
import { createLayoutToolPalette } from "./layout-palette.js";
import { createDom, handleGlobalShortcut, nextId } from "./layout-editor-ui.js";

export { createLayoutCanvas } from "./layout-canvas.js";
export { createLayoutInspector } from "./layout-inspector.js";
export { createLayoutTree } from "./layout-layers.js";
export { LAYOUT_SCHEMA, LAYOUT_TOOLS, blankLayoutRecord, createLayoutModel, findingLocation, layoutForCatalog, validateLayoutRecord } from "./layout-model.js";
export { LAYOUT_PREVIEW_DEF, LAYOUT_TOOL_DEFS, createLayoutToolPalette } from "./layout-palette.js";
export { sampleDeck } from "./layout-samples.js";

const COMPACT_WIDTH = 760;

function assertEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}
function checkedLayout(model) {
  const errors = model.findings.filter((finding) => finding.severity === "error");
  if (errors.length) throw fail("layout-invalid", `Fix the findings before saving: ${errors[0].message}`, { findings: errors });
  return layoutForCatalog(model.record);
}

/**
 * Write the model's record into the deck's `catalogs.custom.layouts` through `saveCustomLayout`, as one undoable edit. The functions below are
 * what the composed editor's `saveToDeck` and `applyToSlide` call; a host that arranges the parts itself calls them with the shared model.
 * A layout with an error finding is refused, and so is an id the deck already has unless `replace` is true.
 */
export function saveLayoutToDeck(editor, model, options = {}) {
  assertEditor(editor);
  const layout = checkedLayout(model);
  const change = saveCustomLayout(editor, layout, { replace: options.replace === true });
  return { ...change, layoutId: layout.id };
}

/** Save the layout (replacing the deck's copy of the same id) and make it the layout of slide `slideIndex`, in one undoable edit. */
export function applyLayoutToSlide(editor, model, slideIndex, options = {}) {
  assertEditor(editor);
  if (!Number.isInteger(slideIndex) || !editor.presentation.slides?.[slideIndex]) throw fail("layout-slide", "Choose a slide of the deck.");
  const layout = checkedLayout(model);
  const saved = prepareCustomLayout(editor.presentation, layout, { replace: options.replace !== false });
  const switched = prepareDimensionSwitch(saved.presentation, "layouts", layout.id, { slideIndex, catalogs: mergeCatalogs(editor.catalogs, options.catalogs) });
  const change = editor.applyPatch([...saved.patches, ...switched.patches], { source: "layout-apply", rejectInvalid: true });
  return { ...change, layoutId: layout.id, slideIndex };
}

/**
 * Mount the layout editor in `container`: palette on the left, canvas in the middle, layers and inspector on the right (in tabs under the
 * canvas when the container is narrow).
 *
 * Options: `record` (the layout record to edit, default a title and one content region), `onChange(record)` (after each edit, undo and
 * redo), `density` ("comfortable" or "touch"), `readOnly`, `toSvg` and `fonts` (the host's renderer and its fonts handle, for Preview;
 * without them Preview draws a wireframe) and `renderOptions`. Returns the parts, the model and the API described in layout-editor.d.ts.
 */
export function createLayoutEditor(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument, win = doc.defaultView;
  const dom = createDom(doc);
  const { el } = dom;
  const model = options.model ?? createLayoutModel(options);
  const id = nextId("opf-layout-editor");

  const root = el("div", "opf-lx opf-layout-editor opf-ui", { "data-density": model.density, "data-panel": "inspector", role: "group", "aria-label": options.label ?? "Layout editor" });
  const topbar = el("div", "opf-lx-topbar");
  const history = el("div", "opf-lx-history", { role: "group", "aria-label": "History" });
  const undo = dom.button("opf-lx-top-button", { label: "Undo", iconName: "Undo2", title: "Undo (Ctrl+Z)", attributes: { "aria-keyshortcuts": "Control+Z Meta+Z" } });
  const redo = dom.button("opf-lx-top-button", { label: "Redo", iconName: "Redo2", title: "Redo (Shift+Ctrl+Z)", attributes: { "aria-keyshortcuts": "Control+Shift+Z Meta+Shift+Z" } });
  history.append(undo, redo);
  const name = el("span", "opf-lx-doc-name");
  const status = dom.button("opf-lx-validity", {});
  topbar.append(history, name, status);
  const main = el("div", "opf-lx-main");
  const paletteHost = el("div", "opf-lx-palette-host");
  const canvasHost = el("div", "opf-lx-canvas-host");
  const side = el("div", "opf-lx-side");
  const tabs = el("div", "opf-lx-tabs", { role: "tablist", "aria-label": "Panels" });
  const tabLayers = el("button", "opf-lx-tab", { type: "button", role: "tab", id: `${id}-tab-layers`, "aria-controls": `${id}-layers`, text: "Layers" });
  const tabInspector = el("button", "opf-lx-tab", { type: "button", role: "tab", id: `${id}-tab-inspector`, "aria-controls": `${id}-inspector`, text: "Inspector" });
  tabs.append(tabLayers, tabInspector);
  const layersHost = el("div", "opf-lx-panel", { id: `${id}-layers`, "data-panel": "layers" });
  const inspectorHost = el("div", "opf-lx-panel", { id: `${id}-inspector`, "data-panel": "inspector" });
  side.append(tabs, layersHost, inspectorHost);
  main.append(paletteHost, canvasHost, side);
  root.append(topbar, main);
  container.append(root);

  const partOptions = { model, toSvg: options.toSvg, fonts: options.fonts, renderOptions: options.renderOptions };
  const palette = createLayoutToolPalette(paletteHost, partOptions);
  const canvas = createLayoutCanvas(canvasHost, partOptions);
  const layers = createLayoutTree(layersHost, { model, onFindingSelect: options.onFindingSelect });
  const inspector = createLayoutInspector(inspectorHost, { model });

  function showPanel(panel, focus = false) {
    root.dataset.panel = panel;
    tabLayers.setAttribute("aria-selected", String(panel === "layers"));
    tabInspector.setAttribute("aria-selected", String(panel === "inspector"));
    tabLayers.tabIndex = panel === "layers" ? 0 : -1;
    tabInspector.tabIndex = panel === "inspector" ? 0 : -1;
    if (focus) (panel === "layers" ? tabLayers : tabInspector).focus();
  }
  tabLayers.addEventListener("click", () => showPanel("layers"));
  tabInspector.addEventListener("click", () => showPanel("inspector"));
  tabs.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      showPanel(root.dataset.panel === "layers" ? "inspector" : "layers", true);
    }
  });
  showPanel("inspector");

  undo.addEventListener("click", () => model.undo());
  redo.addEventListener("click", () => model.redo());
  status.addEventListener("click", () => {
    const first = model.findings[0];
    if (first) { model.select(first.node.length ? [first.node] : []); showPanel("layers"); layers.focus(); }
  });
  function paint() {
    const record = model.record;
    name.replaceChildren(el("strong", "opf-lx-doc-title", { text: record.name || "Untitled layout" }), el("span", "opf-lx-doc-id", { text: record.id || "no id" }));
    undo.disabled = !model.canUndo();
    redo.disabled = !model.canRedo();
    const count = model.findings.length;
    status.replaceChildren(dom.icon(count ? "CircleX" : "Check", 14), el("span", "", { text: count ? `${count} finding${count === 1 ? "" : "s"}` : "Valid" }));
    status.dataset.state = count ? "invalid" : "valid";
    status.setAttribute("aria-label", count ? `${count} finding${count === 1 ? "" : "s"}. Show them in Layers.` : "The layout is valid");
    status.disabled = !count;
    root.dataset.density = model.density;
  }
  const unsubscribe = model.subscribe((event) => { if (event.type !== "notice" && event.type !== "tool" && event.type !== "rename") paint(); });
  paint();

  // The container's width decides the layout: wide shows the palette, canvas and side panels; narrow stacks them with tabs.
  const measure = () => { root.dataset.compact = String((container.clientWidth || root.clientWidth || COMPACT_WIDTH) < COMPACT_WIDTH); };
  let observer = null;
  if (typeof win.ResizeObserver === "function") { observer = new win.ResizeObserver(measure); observer.observe(container); }
  measure();

  root.addEventListener("keydown", (event) => { handleGlobalShortcut(event, model); });

  const api = {
    element: root,
    model,
    palette,
    canvas,
    layers,
    inspector,
    refresh() { palette.refresh(); canvas.refresh(); layers.refresh(); inspector.refresh(); paint(); },
    /** The record as it is now (a copy). */
    getRecord: () => model.getRecord(),
    /** Replace the record, e.g. with a layout the host loaded. Clears the selection and, unless `keepHistory`, the undo history. Does not call `onChange`. */
    setRecord: (record, opts) => model.setRecord(record, opts),
    /** Core's findings for the record: `{ ruleId, severity, message, path, node, field }`. */
    getFindings: () => model.findings.map((finding) => ({ ...finding, node: [...finding.node] })),
    getSelection: () => model.selection.map((path) => [...path]),
    select: (path) => model.select(path ? [path] : []),
    getTool: () => model.tool,
    setTool: (tool) => model.setTool(tool),
    getPreview: () => model.preview,
    setPreview: (on) => model.setPreview(on),
    setDensity: (density) => model.setDensity(density),
    setReadOnly: (on) => model.setReadOnly(on),
    undo: () => model.undo(),
    redo: () => model.redo(),
    canUndo: () => model.canUndo(),
    canRedo: () => model.canRedo(),
    /** Listen to the model (`record`, `selection`, `tool`, `view`, `load`, `notice`). Returns the unsubscribe function. */
    subscribe: (listener) => model.subscribe(listener),
    /**
     * Write the record into the deck's `catalogs.custom.layouts` through `saveCustomLayout`, as one undoable edit. A layout with an error
     * finding is refused. An id the deck already has is refused too, unless `replace` is true (editing a layout the deck already holds).
     */
    saveToDeck: (editor, saveOptions) => saveLayoutToDeck(editor, model, saveOptions),
    /** Save the layout (replacing the deck's copy of the same id) and set it as the layout of slide `slideIndex`, in one undoable edit. */
    applyToSlide: (editor, slideIndex, applyOptions) => applyLayoutToSlide(editor, model, slideIndex, applyOptions),
    destroy() {
      unsubscribe();
      observer?.disconnect();
      palette.destroy();
      canvas.destroy();
      layers.destroy();
      inspector.destroy();
      root.remove();
      if (!options.model) model.destroy();
    },
  };
  return api;
}
