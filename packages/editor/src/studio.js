// CE-20: the Presentation and Slide Studio, `createOpfEditor(el, { layout: "studio" })` (STUDIO-SPEC.md). A Figma Auto Layout-style editor
// over the same session, canvas, source pane, presenter, Review and export the workspace already mounts: a filmstrip over a layers tree on
// the left, the rendered slide in a zoomable viewport with the kit overlay in the middle (and the source as a split, synchronized both ways),
// the Design and Review tabs on the right, and a bar and a status line. Selection is one ordered list of sibling keys (the scene's id paths)
// that every surface shows and changes; every structural command is one validated, undoable change through the slide adapter (CE-19), so
// there is one history, shared with the source pane. Slides stay auto-layout (decision D2): no free x/y, no corner handles.
//
// The `playground` preset (decision D1) is the same editor arranged for first contact: source and slide side by side, click to type, the
// slide row and no Studio panels. `setLayout` switches in place, keeping the session, the history, the slide and the selection.
//
// This file builds the shell (`buildStudioShell`, called by the workspace instead of its own shell) and the controller (`createStudio`,
// called once the workspace has mounted its parts). Plain DOM, styled only by `--opf-ui-*` tokens (src/styles/studio.css), no network.
import { createDom, isTypingTarget, openMenu } from "./studio-kit/dom.js";
import { createSelection } from "./studio-kit/selection.js";
import { formatKey, isHandled, markHandled, matchKey } from "./studio-kit/commands.js";
import { createSlideAdapter, composeSlideGeometry } from "./slide-adapter.js";
import { createStudioCommands, contextMenuGroups, STUDIO_INSERT_HINTS, STUDIO_INSERT_KINDS, STUDIO_INSERT_LABELS } from "./studio-commands.js";
import { createStudioCanvas, dottedPath, isTextNode } from "./studio-canvas.js";
import { createStudioLayers } from "./studio-layers.js";
import { createStudioDesign } from "./studio-design.js";
import { createContentBlock } from "./blocks.js";
import { addSlide, setHidden } from "./slides.js";
import { blockConversionTargets, convertBlock } from "./block-convert.js";
import { listSwitchOptions, switchDimension } from "./switches.js";
import { groupLayoutChoices } from "./layout-templates.js";
import { buildLayoutDiagram } from "./layout-diagram.js";
import { prepareSave } from "./catalogs.js";
import { prepareOpfImport } from "./transfer.js";
import { collectReservedPresentationIds } from "./presentation-ids.js";
import { regionsAsBlocks } from "./content-actions.js";
import { downloadSourceFile, copyText } from "./workspace-source.js";
import { DECK_FILE_ACCEPT, readDeckFile } from "./read-deck-file.js";
import { formatPointer, jsonEqual, parsePointer } from "@openpresentation/opf/patch";

const PREFIX = "opf-studio";
const WIDE = 1100, NARROW = 760;
const SIZES = { left: [232, 176, 360], right: [280, 240, 420], split: [0.42, 0.2, 0.8], stack: [0.5, 0.15, 0.85] };
const INSERT_ICONS = { text: "AlignLeft", list: "List", image: "Image", video: "Video", chart: "ChartColumn", table: "Table", code: "Code", metric: "Hash", quote: "Quote", timeline: "CalendarRange", group: "Group" };
const PLACEHOLDER_PICTURE = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#e4e8ef"/><path d="M640 600l160-200 120 140 80-90 160 150z" fill="#b4bdcb"/><circle cx="1010" cy="330" r="50" fill="#b4bdcb"/></svg>')}`;
// The clipboard of every Studio on the page, so copy in one editor and paste in another works (the system clipboard gets OPF text too).
let clipboard = null;

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const isSlideKey = (key) => typeof key === "string" && !key.includes("#") && /^\/slides\/[^/]+$/.test(key);
const toPointer = (path) => (typeof path === "string" && path.startsWith("/") ? path : formatPointer(String(path ?? "").split(".").filter(Boolean)));
const prefixOf = (a, b) => a.length <= b.length && a.every((token, at) => token === b[at]);

// ---- the shell ------------------------------------------------------------------------------------------------------------------------------

/**
 * Build the Studio's DOM inside `root` (the workspace's `.opf-workspace` element). `parts` says which parts the workspace mounts; `layout` is
 * the preset ("studio" or "playground"). Returns `{ slots, controls, shell }`: the slots the workspace mounts its parts in, the bar controls
 * it drives (undo, redo), and the Studio's own elements.
 */
export function buildStudioShell(root, { parts, layout, labels = {}, studio: config = {}, slots: given = {} }) {
  const dom = createDom(root.ownerDocument, { prefix: PREFIX });
  const { el } = dom;
  const slots = {};
  const controls = {};
  const slot = (name, tag = "div", className = "", attributes = {}) => (slots[name] = el(tag, className, { "data-opf-slot": name, ...attributes }));
  root.classList.add("opf-studio");
  root.dataset.opfLayout = layout;
  root.dataset.preset = layout;
  root.dataset.source = "off";
  root.dataset.panels = "shown";
  root.dataset.width = "wide";

  // The bar.
  const bar = el("div", `${PREFIX}-bar`, { role: "toolbar", "aria-label": labels.studio ?? "Studio" });
  const file = dom.button(`${PREFIX}-barbutton`, { text: "File", iconName: "Menu", size: 16, attributes: { "aria-haspopup": "menu", "data-studio": "file" } });
  const name = el("input", `${PREFIX}-name`, { type: "text", "aria-label": "Presentation name", spellcheck: "false", autocomplete: "off", "data-studio": "name" });
  const tools = el("div", `${PREFIX}-tools`, { role: "group", "aria-label": "Tools" });
  const toolButtons = {};
  for (const [id, text, icon, key] of [["select", "Select", "MousePointer2", "V"], ["hand", "Hand", "Hand", "H"], ["text", "Text", "Type", "T"]]) {
    toolButtons[id] = dom.button(`${PREFIX}-iconbutton`, { label: `${text} tool`, iconName: icon, size: 16, pressed: id === "select", title: `${text} tool (${key})`, attributes: { "data-tool": id, "aria-keyshortcuts": key } });
    tools.append(toolButtons[id]);
  }
  const insert = dom.button(`${PREFIX}-barbutton`, { text: "Insert", iconName: "Plus", size: 16, attributes: { "aria-haspopup": "menu", "data-studio": "insert" } });
  const addSlideButton = dom.button(`${PREFIX}-barbutton`, { text: "Slide", iconName: "Plus", size: 16, label: "New slide", attributes: { "aria-haspopup": "menu", "data-studio": "slide" } });
  addSlideButton.removeAttribute("aria-label");
  addSlideButton.setAttribute("aria-label", "Slide: add a slide");
  const history = el("div", `${PREFIX}-history`, { role: "group", "aria-label": "History" });
  controls.undo = dom.button(`${PREFIX}-iconbutton`, { label: "Undo", iconName: "Undo2", size: 16, attributes: { "data-opf-action": "undo", "aria-keyshortcuts": "Control+Z Meta+Z" } });
  controls.redo = dom.button(`${PREFIX}-iconbutton`, { label: "Redo", iconName: "Redo2", size: 16, attributes: { "data-opf-action": "redo", "aria-keyshortcuts": "Control+Shift+Z Meta+Shift+Z" } });
  history.append(controls.undo, controls.redo);
  // The Playground's view switch: Source, Both, Preview.
  const views = el("div", `${PREFIX}-views`, { role: "group", "aria-label": "Show" });
  const viewButtons = {};
  for (const [id, text] of [["source", "Source"], ["both", "Both"], ["preview", "Preview"]]) {
    viewButtons[id] = dom.button(`${PREFIX}-segment`, { text, pressed: id === "both", attributes: { "data-view": id } });
    views.append(viewButtons[id]);
  }
  const spacer = el("span", `${PREFIX}-spacer`);
  const zoom = dom.button(`${PREFIX}-barbutton ${PREFIX}-zoombutton`, { text: "100%", attributes: { "aria-haspopup": "menu", "aria-label": "Zoom 100%", "data-studio": "zoom" } });
  const source = dom.button(`${PREFIX}-barbutton`, { text: "Source", iconName: "Code", size: 16, pressed: false, attributes: { "data-studio": "source", "aria-keyshortcuts": "Control+`" } });
  const openStudio = dom.button(`${PREFIX}-barbutton ${PREFIX}-openstudio`, { text: "Open in Studio", iconName: "Layers", size: 16, attributes: { "data-studio": "open-studio" } });
  bar.append(file, name, tools, insert, addSlideButton, history, views, spacer, zoom);
  if (parts.source) bar.append(source);
  if (parts.present) bar.append(slot("present", "div", `${PREFIX}-present`));
  const topbarEnd = el("div", `${PREFIX}-topbar-end`, { "data-opf-slot": "topbarEnd" });
  if (given.topbarEnd) topbarEnd.append(given.topbarEnd);
  bar.append(topbarEnd);
  if (parts.export) bar.append(slot("export", "div", `${PREFIX}-export`));
  bar.append(openStudio);

  // The left panel: Slides over Layers, with a divider; at medium widths a rail of two buttons opens them as an overlay.
  const left = el("aside", `${PREFIX}-left`, { "aria-label": "Slides and layers" });
  const rail = el("div", `${PREFIX}-rail`, { role: "group", "aria-label": "Panels" });
  const railSlides = dom.button(`${PREFIX}-iconbutton`, { label: "Slides", iconName: "Square", size: 18, pressed: false, attributes: { "data-panel": "slides" } });
  const railLayers = dom.button(`${PREFIX}-iconbutton`, { label: "Layers", iconName: "Layers", size: 18, pressed: false, attributes: { "data-panel": "layers" } });
  rail.append(railSlides, railLayers);
  const slidesSection = el("section", `${PREFIX}-slides`, { "aria-labelledby": "opf-studio-slides-title" });
  const slidesHead = el("div", `${PREFIX}-panelhead`);
  slidesHead.append(el("h2", `${PREFIX}-paneltitle`, { id: "opf-studio-slides-title", text: "Slides" }), slot("slideToolbar", "div", `${PREFIX}-slidetools`));
  slidesSection.append(slidesHead, slot("slides", "div", `${PREFIX}-filmstrip`));
  const stackDivider = el("div", `${PREFIX}-splitter`, { role: "separator", "aria-orientation": "horizontal", "aria-label": "Resize slides and layers", tabindex: "0", "data-resize": "stack" });
  const layersSection = el("section", `${PREFIX}-layers`, { "aria-labelledby": "opf-studio-layers-title" });
  const layersHost = el("div", `${PREFIX}-layershost`);
  layersSection.append(el("div", `${PREFIX}-panelhead`), layersHost);
  layersSection.firstChild.append(el("h2", `${PREFIX}-paneltitle`, { id: "opf-studio-layers-title", text: "Layers" }));
  left.append(rail, slidesSection, stackDivider, layersSection);
  const leftDivider = el("div", `${PREFIX}-splitter`, { role: "separator", "aria-orientation": "vertical", "aria-label": "Resize the left panel", tabindex: "0", "data-resize": "left" });

  // The center: the viewport with the slide, the source split, the data dock, the Playground's slide row, Layout Studio.
  const center = el("div", `${PREFIX}-center`);
  const canvasArea = el("section", `${PREFIX}-canvasarea`, { "aria-label": "Slide" });
  const viewport = el("div", `${PREFIX}-viewport`, { "data-opf-slot": "slide" });
  slots.slide = viewport;
  const stage = el("div", `${PREFIX}-stage`);
  const frame = el("div", `${PREFIX}-frame`, { role: "group", "aria-label": "Slide", tabindex: "-1" });
  const overlay = el("div", `${PREFIX}-overlay`);
  frame.append(slot("canvas", "div", `${PREFIX}-canvas`), overlay);
  stage.append(frame);
  viewport.append(stage);
  const actionbar = el("div", `${PREFIX}-actionbar`, { role: "toolbar", "aria-label": "Selection actions" });
  actionbar.hidden = true;
  const dataDock = el("section", `${PREFIX}-datadock`, { "aria-label": "Data" });
  dataDock.hidden = true;
  const dock = el("div", `${PREFIX}-dock`);
  if (parts.navigator) dock.append(slot("navigator", "div", `${PREFIX}-navigator`));
  if (parts.thumbnails) dock.append(slot("thumbnails", "div", `${PREFIX}-thumbnails`));
  canvasArea.append(viewport, actionbar, dataDock, dock);
  const sourceDivider = el("div", `${PREFIX}-splitter`, { role: "separator", "aria-label": "Resize the source", tabindex: "0", "data-resize": "split" });
  const sourceArea = el("section", `${PREFIX}-sourcearea`, { "aria-label": "OPF source" });
  if (parts.source) sourceArea.append(slot("source", "div", `${PREFIX}-source`));
  const layoutsArea = el("section", `${PREFIX}-layoutsarea`, { "aria-label": "Layout Studio" });
  const crumbs = el("nav", `${PREFIX}-crumbs`, { "aria-label": "Breadcrumb" });
  layoutsArea.hidden = true;
  if (parts.layouts) layoutsArea.append(crumbs, slot("layouts", "div", `${PREFIX}-layouts`));
  center.append(canvasArea, sourceDivider, sourceArea, layoutsArea);
  slots.layoutsView = layoutsArea;

  // The right panel: Design, Review and the host's tabs.
  const right = el("aside", `${PREFIX}-right`, { "aria-label": "Properties" });
  const rightDivider = el("div", `${PREFIX}-splitter`, { role: "separator", "aria-orientation": "vertical", "aria-label": "Resize the right panel", tabindex: "0", "data-resize": "right" });
  const tablist = el("div", `${PREFIX}-tabs`, { role: "tablist", "aria-label": "Properties" });
  right.append(tablist);
  const tabs = {};
  const addTab = (id, text) => {
    const tab = el("button", `${PREFIX}-tab`, { type: "button", role: "tab", id: `${PREFIX}-tab-${id}`, "aria-selected": "false", "aria-controls": `${PREFIX}-panel-${id}`, "data-tab": id, tabindex: "-1", text });
    const panel = el("div", `${PREFIX}-tabpanel`, { role: "tabpanel", id: `${PREFIX}-panel-${id}`, "aria-labelledby": tab.id, tabindex: "0" });
    panel.hidden = true;
    tablist.append(tab);
    right.append(panel);
    tabs[id] = { tab, panel };
    return panel;
  };
  addTab("design", "Design").append(el("div", `${PREFIX}-design`));
  if (parts.review) addTab("review", labels.review ?? "Review").append(slot("review", "div", `${PREFIX}-review`));
  for (const host of config.hostPanels ?? []) {
    if (!host?.id || typeof host.mount !== "function") continue;
    if (host.side === "left") {
      const section = el("section", `${PREFIX}-hostsection`, { "aria-label": host.label, "data-host-panel": host.id });
      section.append(el("div", `${PREFIX}-panelhead`), el("div", `${PREFIX}-hostbody`));
      section.firstChild.append(el("h2", `${PREFIX}-paneltitle`, { text: host.label }));
      left.append(section);
      tabs[`host:${host.id}`] = { panel: section.lastChild, host };
    } else {
      const panel = addTab(`host-${host.id}`, host.label);
      tabs[`host-${host.id}`].host = host;
      panel.dataset.hostPanel = host.id;
    }
  }

  const main = el("div", `${PREFIX}-main`);
  main.append(left, leftDivider, center, rightDivider, right);

  // The status line.
  const status = el("footer", `${PREFIX}-status`);
  const validity = dom.button(`${PREFIX}-validity`, { text: "Valid", attributes: { "data-studio": "validity" } });
  const counter = el("span", `${PREFIX}-counter`, { text: "" });
  const format = el("span", `${PREFIX}-format`, { text: "JSON" });
  const message = slot("status", "p", `${PREFIX}-message`, { role: "status", "aria-live": "polite" });
  const sheetBar = el("div", `${PREFIX}-sheetbar`, { role: "group", "aria-label": "Panels" });
  const sheetButtons = {};
  for (const [id, text, icon] of [["slides", "Slides", "Square"], ["layers", "Layers", "Layers"], ["design", "Design", "Pencil"], ["review", "Review", "Info"]]) {
    sheetButtons[id] = dom.button(`${PREFIX}-iconbutton`, { label: text, iconName: icon, size: 18, pressed: false, attributes: { "data-sheet": id } });
    sheetBar.append(sheetButtons[id]);
  }
  const zoombar = el("div", `${PREFIX}-zoombar`, { role: "group", "aria-label": "Zoom" });
  const zoomOut = dom.button(`${PREFIX}-iconbutton`, { label: "Zoom out", iconName: "ZoomOut", size: 16, attributes: { "aria-keyshortcuts": "Control+- Meta+-" } });
  const zoomLabel = el("output", `${PREFIX}-zoomlabel`, { "aria-live": "off", text: "100%" });
  const zoomIn = dom.button(`${PREFIX}-iconbutton`, { label: "Zoom in", iconName: "ZoomIn", size: 16, attributes: { "aria-keyshortcuts": "Control+= Meta+=" } });
  const zoomFit = dom.button(`${PREFIX}-iconbutton`, { label: "Zoom to fit", iconName: "Maximize", size: 16, attributes: { "aria-keyshortcuts": "Shift+1" } });
  zoombar.append(zoomOut, zoomLabel, zoomIn, zoomFit);
  status.append(validity, counter, format);
  if (parts.persistence) status.append(slot("autosave", "span", `${PREFIX}-autosave`));
  status.append(message, sheetBar, zoombar);

  if (parts.persistence) root.append(bar, slot("banner", "div", `${PREFIX}-banner`, { hidden: true }));
  else root.append(bar);
  if (parts.find) root.append(slot("find", "div", `${PREFIX}-find`, { hidden: true }));
  root.append(main, status);

  const shell = {
    dom, bar, file, name, tools, toolButtons, insert, addSlide: addSlideButton, views, viewButtons, zoom, source, openStudio,
    left, rail, railSlides, railLayers, slidesSection, layersSection, layersHost, stackDivider, leftDivider, rightDivider, sourceDivider,
    center, canvasArea, viewport, stage, frame, overlay, actionbar, dataDock, dock, sourceArea, layoutsArea, crumbs,
    right, tablist, tabs, main, status, validity, counter, format, message, sheetBar, sheetButtons, zoomOut, zoomLabel, zoomIn, zoomFit,
  };
  return { slots, controls, shell };
}

// ---- the controller -------------------------------------------------------------------------------------------------------------------------

/**
 * The Studio over the workspace's mounted parts. `ctx` is what the workspace hands over (see src/workspace.js): the session (`session`, and
 * `ui`, the same session refusing writes while read-only), the parts (`canvas`, `pane`, `presenter`, `review`, `exportMenu`, `slideManager`,
 * `find`, `thumbnailCache`), and its functions (`go`, `present`, `say`, `emit`, `report`, `setView`, `readOnly`, `inSync`, `fontsLoading`,
 * `catalogs`, `fonts`, `layoutFor`, `setDocument`, `layoutStudio`). Returns the controller; the workspace forwards its handle members to it.
 */
export function createStudio(ctx) {
  const { root, shell, session, ui, canvas, options } = ctx;
  const config = options.studio ?? {};
  const dom = shell.dom;
  const { el } = dom;
  const doc = root.ownerDocument, win = doc.defaultView;
  const cleanups = [];
  const listen = (target, type, handler, opts) => { target.addEventListener(type, handler, opts); cleanups.push(() => target.removeEventListener(type, handler, opts)); };
  let layout = ctx.layout;
  let destroyed = false;
  let menu = null;
  let sheet = null;
  let dataGrid = null;
  let layoutHandoff = null;
  let sourceMode = "off";
  let studioSource = config.panels?.source === false ? "off" : null; // the Studio's own split, remembered while the Playground shows its own
  let playgroundView = "both";
  let sizes = readSizes();
  let lastRender = null;

  // ---- the adapter, its geometry and the selection --------------------------------------------------------------------------------------
  // The scene's boxes come from the geometry the canvas drew (same fonts, same measurement); a document it has not drawn is composed here.
  const geometry = (presentation, index) => {
    if (lastRender && lastRender.presentation === presentation && lastRender.slideIndex === index) return lastRender.geometry;
    return composeSlideGeometry(presentation, index, { catalogs: ctx.catalogs(), fonts: ctx.layoutFor(presentation, index).fonts });
  };
  const adapter = createSlideAdapter(ui, {
    slideIndex: ctx.slideIndex(),
    geometry,
    selection: () => selection.snapshot(),
    onPreview: ({ presentation }) => {
      if (presentation) canvas.render(presentation);
      else canvas.render();
    },
    onSelection: (keys, info) => setSelection(keys, { source: info.source }),
    onRefuse: ({ reason }) => announce(reason),
  });
  const scene = () => adapter.scene();
  let selectionSource = "init";
  const selection = createSelection(adapter.selectionAdapter(), { onChange: ({ source } = {}) => selectionChanged(source) });

  const controller = {
    selecting: false,
    get layout() { return layout; },
    get readOnly() { return ctx.readOnly(); },
    get inSync() { return ctx.inSync(); },
    get fontsLoading() { return ctx.fontsLoading(); },
    get slideIndex() { return ctx.slideIndex(); },
    get hasSource() { return Boolean(ctx.pane); },
    get hasFind() { return Boolean(ctx.find); },
    get hasExport() { return Boolean(ctx.exportMenu); },
    catalogs: () => ctx.catalogs(),
  };
  const s = controller;
  const commands = createStudioCommands({ extra: config.commands ?? [], keymap: config.keymap });

  // ---- selection ----------------------------------------------------------------------------------------------------------------------
  s.selectedKeys = () => selection.items;
  s.primaryKey = () => selection.primary;
  s.selectedNodes = () => selection.items.map((key) => scene().node(key) ?? (isSlideKey(key) ? slideNodeFor(key) : null)).filter(Boolean);
  s.primaryNode = () => { const key = selection.primary; return key ? scene().node(key) ?? (isSlideKey(key) ? slideNodeFor(key) : null) : null; };
  const slideNodeFor = (key) => { const s0 = scene(); return s0.slideKey === key ? s0.node(key) : null; };
  function setSelection(keys, { source = "api" } = {}) {
    selectionSource = source;
    // A slide key of another slide shows that slide.
    const slideKey = keys.find(isSlideKey);
    if (slideKey && slideKey !== scene().slideKey) {
      const index = adapter.slides().findIndex((entry) => entry.key === slideKey);
      if (index >= 0 && index !== ctx.slideIndex()) { revealing = true; ctx.go(index); revealing = false; adapter.setSlide(index); }
    }
    if (!selection.set(keys, { source })) selectionChanged(source, { quiet: true });
  }
  s.select = (keys, options = {}) => setSelection(keys, options);
  s.selectAdd = (key, { source = "canvas" } = {}) => {
    const before = selection.items;
    const node = scene().node(key);
    const first = before.length ? scene().node(before[0]) : null;
    selectionSource = source;
    selection.add(key, { source });
    if (first && node && first.parent !== node.parent) announce(`Selected ${node.label.split(":")[0]}. Multiple selection works within one group.`);
  };
  s.selectRange = (key, { source = "layers" } = {}) => { selectionSource = source; selection.range(key, { source }); };
  s.selectParent = () => {
    const key = selection.primary;
    if (key && isSlideKey(key)) { setSelection([], { source: "keyboard" }); return; }
    if (!key) return;
    selection.selectParent({ source: "keyboard" });
  };
  s.selectChildren = () => { selection.selectChild({ source: "keyboard" }); };
  s.selectSibling = (delta) => {
    if (!selection.primary) { setSelection([scene().slideKey], { source: "keyboard" }); return; }
    selection.selectSibling(delta, { source: "keyboard" });
  };
  s.hasSibling = (delta) => {
    const key = selection.primary;
    if (!key) return true;
    return adapter.selectionAdapter().sibling(key, delta) ? true : delta > 0 ? "This is the last one." : "This is the first one.";
  };
  s.selectSiblings = () => { selection.selectSiblings({ source: "keyboard" }); };

  let revealing = false;
  function selectionChanged(source = selectionSource, { quiet = false } = {}) {
    if (destroyed) return;
    selectionSource = source;
    paint();
    // Focus in the layers follows the selection (an edit made from the layers keeps the focus on its result).
    layers?.paintSelection({ focus: shell.layersHost.contains(doc.activeElement) });
    design?.refresh();
    syncActionBar();
    if (source !== "source" && !quiet) revealInSource();
    if (source === "keyboard" && (shell.frame.contains(doc.activeElement) || doc.activeElement === doc.body)) canvasView?.focusPrimary();
    if (!quiet) ctx.emit("selection", selectionDetail(source));
  }
  function selectionDetail(source) {
    const items = s.selection;
    const primary = items.at(-1) ?? null;
    const path = primary ? (primary.path === "" ? undefined : dottedPath(primary.path)) : undefined;
    return { items, primary, source, path, value: path ? ui.get(path) : undefined, slideIndex: ctx.slideIndex() };
  }
  // The list is made once per selection (and scene), so a host's store snapshot (`useOpfSelection`) is stable between changes.
  let selectionCache = { items: null, scene: null, list: [] };
  Object.defineProperty(s, "selection", {
    get() {
      const current = scene();
      if (selectionCache.items === selection.items && selectionCache.scene === current) return selectionCache.list;
      const list = Object.freeze(selection.items.map((key) => {
        const node = scene().node(key) ?? slideNodeFor(key);
        const path = node?.path ?? adapter.pathOf(key) ?? "";
        return Object.freeze({ key, path, ...(key.includes("@") ? { idPath: key.split("#")[0] } : {}), kind: node?.kind ?? (isSlideKey(key) ? "slide" : "block") });
      }));
      selectionCache = { items: selection.items, scene: current, list };
      return list;
    },
  });

  // ---- announcements and the status line ------------------------------------------------------------------------------------------------
  const announce = (message) => { if (message) ctx.say(message); };
  s.announce = announce;
  s.status = announce;

  // ---- the parts --------------------------------------------------------------------------------------------------------------------------
  const canvasView = createStudioCanvas({ dom, elements: { root, viewport: shell.viewport, stage: shell.stage, frame: shell.frame, overlay: shell.overlay }, canvas, adapter, studio: s });
  const layers = createStudioLayers(shell.layersHost, { dom, adapter, studio: s });
  const design = createStudioDesign(shell.tabs.design.panel.firstChild, { dom, ui, studio: s, catalogs: ctx.hostCatalogs, designOptions: typeof options.design === "object" ? options.design : {}, onAddAsset: options.onAddAsset });

  function paint() {
    if (destroyed) return;
    root.dataset.editing = s.editingText() ? "true" : "false";
    canvasView.paint();
    syncStatus();
    syncBar();
  }
  s.frameLabel = () => {
    const slides = adapter.slides();
    const current = slides[ctx.slideIndex()];
    const node = scene().node(scene().slideKey);
    return `Slide ${ctx.slideIndex() + 1} of ${slides.length}${current && node?.label.includes(" · ") ? `, ${node.label.split(" · ")[1]}` : ""}`;
  };
  s.slideLabel = (node) => node.label;
  s.slideUsesLayout = () => scene().layout;

  // ---- tools and zoom ---------------------------------------------------------------------------------------------------------------------
  s.setTool = (tool) => {
    canvasView.setTool(tool);
    for (const [id, button] of Object.entries(shell.toolButtons)) button.setAttribute("aria-pressed", String(id === tool));
    announce(`${tool === "select" ? "Select" : tool === "hand" ? "Hand" : "Text"} tool`);
  };
  s.zoomBy = (direction) => canvasView.step(direction);
  s.setZoom = (value) => canvasView.setZoom(value);
  s.fit = (mode = "slide") => canvasView.fit(mode);
  s.onZoom = (value) => {
    const text = `${Math.round(value * 100)}%`;
    shell.zoom.querySelector(`.${PREFIX}-button-text`).textContent = text;
    shell.zoom.setAttribute("aria-label", `Zoom ${text}`);
    shell.zoomLabel.textContent = text;
    ctx.emit("zoom", { zoom: value });
  };

  // ---- panels, source split, responsive ---------------------------------------------------------------------------------------------------
  function readSizes() {
    const out = Object.fromEntries(Object.entries(SIZES).map(([key, [value]]) => [key, value]));
    try {
      const stored = config.sizes?.storage?.get?.(`${config.sizes.key}:studio-sizes`);
      if (stored) Object.assign(out, JSON.parse(stored));
    } catch { /* the defaults */ }
    return out;
  }
  function writeSizes() {
    try { config.sizes?.storage?.set?.(`${config.sizes.key}:studio-sizes`, JSON.stringify(sizes)); } catch { /* not kept */ }
  }
  function applySizes() {
    root.style.setProperty("--opf-studio-left", `${sizes.left}px`);
    root.style.setProperty("--opf-studio-right", `${sizes.right}px`);
    root.style.setProperty("--opf-studio-split", String(sizes.split));
    root.style.setProperty("--opf-studio-stack", String(sizes.stack));
    for (const [name, separator] of [["left", shell.leftDivider], ["right", shell.rightDivider], ["split", shell.sourceDivider], ["stack", shell.stackDivider]]) {
      const [, min, max] = SIZES[name];
      separator.setAttribute("aria-valuemin", String(name === "split" || name === "stack" ? Math.round(min * 100) : min));
      separator.setAttribute("aria-valuemax", String(name === "split" || name === "stack" ? Math.round(max * 100) : max));
      separator.setAttribute("aria-valuenow", String(name === "split" || name === "stack" ? Math.round(sizes[name] * 100) : sizes[name]));
    }
  }
  function resizer(separator, name) {
    const [, min, max] = SIZES[name];
    const fraction = name === "split" || name === "stack";
    const clamp = (value) => Math.max(min, Math.min(max, value));
    const set = (value) => { sizes[name] = fraction ? Math.round(clamp(value) * 1000) / 1000 : Math.round(clamp(value)); applySizes(); };
    listen(separator, "pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      try { separator.setPointerCapture?.(event.pointerId); } catch { /* a pointer that cannot be captured (a synthetic one) */ }
      const start = { x: event.clientX, y: event.clientY, value: sizes[name] };
      const box = (name === "stack" ? shell.left : shell.center).getBoundingClientRect();
      const vertical = name === "stack" || (name === "split" && sourceMode === "bottom");
      const move = (next) => {
        if (name === "left") set(start.value + (next.clientX - start.x));
        else if (name === "right") set(start.value - (next.clientX - start.x));
        else if (vertical) set(start.value + (name === "stack" ? 1 : -1) * (next.clientY - start.y) / Math.max(1, box.height));
        else set(start.value + (sourceMode === "left" ? 1 : -1) * (next.clientX - start.x) / Math.max(1, box.width));
      };
      const up = () => { separator.removeEventListener("pointermove", move); separator.removeEventListener("pointerup", up); writeSizes(); };
      separator.addEventListener("pointermove", move);
      separator.addEventListener("pointerup", up);
    });
    listen(separator, "keydown", (event) => {
      const step = (event.shiftKey ? 4 : 1) * (fraction ? 0.02 : 8);
      const keys = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      event.stopPropagation();
      const sign = name === "right" || (name === "split" && sourceMode !== "left") ? -1 : 1;
      set(sizes[name] + keys[event.key] * sign * step);
      writeSizes();
    });
  }
  resizer(shell.leftDivider, "left");
  resizer(shell.rightDivider, "right");
  resizer(shell.sourceDivider, "split");
  resizer(shell.stackDivider, "stack");
  applySizes();

  function setSourceMode(mode) {
    sourceMode = ctx.pane ? mode : "off";
    root.dataset.source = sourceMode;
    shell.source.setAttribute("aria-pressed", String(sourceMode !== "off"));
    shell.sourceDivider.setAttribute("aria-orientation", sourceMode === "bottom" ? "horizontal" : "vertical");
    shell.sourceArea.hidden = sourceMode === "off" && layout === "studio";
    if (sourceMode !== "off") revealInSource();
  }
  s.toggleSource = () => {
    if (layout === "playground") { setPlaygroundView(playgroundView === "preview" ? "both" : "preview"); return; }
    const width = root.getBoundingClientRect().width;
    studioSource = sourceMode === "off" ? (config.panels?.source && config.panels.source !== "tab" ? config.panels.source.replace("split-", "") : width < WIDE ? "bottom" : "right") : "off";
    setSourceMode(studioSource);
    announce(studioSource === "off" ? "Source hidden" : "Source shown");
  };
  s.togglePanels = () => {
    root.dataset.panels = root.dataset.panels === "hidden" ? "shown" : "hidden";
    announce(root.dataset.panels === "hidden" ? "Panels hidden" : "Panels shown");
  };
  function setPlaygroundView(view) {
    playgroundView = view;
    root.dataset.playgroundView = view;
    for (const [id, button] of Object.entries(shell.viewButtons)) button.setAttribute("aria-pressed", String(id === view));
    setSourceMode(view === "preview" ? "off" : "left");
  }
  const observer = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(() => syncWidth()) : null;
  observer?.observe(root);
  cleanups.push(() => observer?.disconnect());
  function syncWidth() {
    const width = root.getBoundingClientRect().width;
    const next = width >= WIDE ? "wide" : width >= NARROW ? "medium" : "narrow";
    if (root.dataset.width !== next) {
      root.dataset.width = next;
      root.dataset.leftOpen = "";
      closeSheet();
      if (layout === "studio" && sourceMode === "right" && next !== "wide") setSourceMode("bottom");
    }
    syncAspect();
  }
  function syncAspect() {
    const g = lastRender?.geometry;
    if (g?.width && g?.height) root.style.setProperty("--opf-studio-aspect", String(g.width / g.height));
  }
  // The rail (medium widths) and the sheet (phones).
  for (const button of [shell.railSlides, shell.railLayers]) {
    listen(button, "click", () => {
      const panel = button.dataset.panel;
      const open = root.dataset.leftOpen === panel ? "" : panel;
      root.dataset.leftOpen = open;
      shell.railSlides.setAttribute("aria-pressed", String(open === "slides"));
      shell.railLayers.setAttribute("aria-pressed", String(open === "layers"));
    });
  }
  function openSheet(name) {
    sheet = sheet === name ? null : name;
    root.dataset.sheet = sheet ?? "";
    for (const [id, button] of Object.entries(shell.sheetButtons)) button.setAttribute("aria-pressed", String(id === sheet));
    if (sheet === "design" || sheet === "review") showTab(sheet);
  }
  function closeSheet() { sheet = null; root.dataset.sheet = ""; for (const button of Object.values(shell.sheetButtons)) button.setAttribute("aria-pressed", "false"); }
  for (const [id, button] of Object.entries(shell.sheetButtons)) listen(button, "click", () => openSheet(id));

  // ---- tabs (Design, Review, host panels) -------------------------------------------------------------------------------------------------
  const tabIds = Object.keys(shell.tabs).filter((id) => shell.tabs[id].tab);
  function showTab(id, { focus = false } = {}) {
    if (!shell.tabs[id]?.tab) return false;
    for (const name of tabIds) {
      const { tab, panel } = shell.tabs[name];
      const on = name === id;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
    }
    if (focus) shell.tabs[id].tab.focus();
    ctx.emit("panel", { panel: id });
    return true;
  }
  s.showTab = showTab;
  for (const id of tabIds) {
    const { tab } = shell.tabs[id];
    listen(tab, "click", () => showTab(id));
    listen(tab, "keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const at = tabIds.indexOf(id);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabIds.length - 1 : (at + (event.key === "ArrowRight" ? 1 : -1) + tabIds.length) % tabIds.length;
      showTab(tabIds[next], { focus: true });
    });
  }
  showTab(options.panel && shell.tabs[options.panel]?.tab ? options.panel : "design");
  // Host panels: each is mounted once into its panel element; its cleanup runs on destroy.
  for (const entry of Object.values(shell.tabs)) {
    if (!entry.host) continue;
    try {
      const stop = entry.host.mount(entry.panel, ctx.handle);
      if (typeof stop === "function") cleanups.push(stop);
    } catch (error) { ctx.report(error); }
  }
  s.showDesignSection = (name) => { showTab("design"); design.showSection(name); };

  // ---- source sync (CE-17) ---------------------------------------------------------------------------------------------------------------
  function revealInSource() {
    const pane = ctx.pane;
    if (!pane || sourceMode === "off" || layout !== "studio") return;
    const node = s.primaryNode();
    const pointer = node ? node.path : null;
    if (!pointer) return;
    try { pane.revealPath(pointer, { focus: false, flash: true }); } catch { /* text that does not read */ }
  }
  cleanups.push(ctx.on("cursor", (detail) => {
    if (layout !== "studio" || !detail?.pointer || !shell.sourceArea.contains(doc.activeElement) && !detail.force) return;
    selectPointer(detail.pointer, "source");
  }));
  /** Select the deepest node of the scene whose path holds `pointer` (showing its slide first). */
  function selectPointer(pointer, source) {
    let tokens;
    try { tokens = parsePointer(toPointer(pointer)); } catch { return false; }
    if (tokens[0] !== "slides" || !/^\d+$/.test(tokens[1] ?? "")) return false;
    const index = Number(tokens[1]);
    if (index !== ctx.slideIndex()) { revealing = true; ctx.go(index); revealing = false; adapter.setSlide(index); }
    const s0 = scene();
    if (s0.slideIndex !== index) return false;
    let best = null;
    for (const node of s0.nodes) {
      if (node.virtual || node.kind === "part") continue;
      const path = parsePointer(node.path);
      if (prefixOf(path, tokens) && (!best || path.length > parsePointer(best.path).length)) best = node;
    }
    if (!best) return false;
    if (selection.primary === best.key && selection.items.length === 1) return true;
    setSelection([best.key], { source });
    return true;
  }
  s.revealPath = (path) => selectPointer(path, "reveal");
  /** Select keys (scene keys or slide keys) or paths (JSON Pointers or dotted OPF paths); returns whether everything was found. */
  s.selectTargets = (list) => {
    const items = [].concat(list ?? []).filter((item) => typeof item === "string");
    if (!items.length) { setSelection([], { source: "api" }); return true; }
    const keys = [];
    for (const item of items) {
      if (scene().node(item) || (isSlideKey(item) && adapter.slides().some((entry) => entry.key === item))) { keys.push(item); continue; }
      if (!selectPointer(item, "api")) return false;
      keys.push(selection.primary);
    }
    setSelection(keys, { source: "api" });
    return keys.every((key) => selection.items.includes(key));
  };

  // ---- commands state --------------------------------------------------------------------------------------------------------------------
  s.slideScope = () => {
    const active = doc.activeElement;
    if (ctx.slots.slides?.contains(active)) return true;
    return Boolean(selection.primary && isSlideKey(selection.primary));
  };
  const filmstripKeys = () => {
    const list = ctx.slideManager?.getSelection?.() ?? [ctx.slideIndex()];
    const slides = adapter.slides();
    return list.map((index) => slides[index]?.key).filter(Boolean);
  };
  const scopeKeys = () => (s.slideScope() ? (ctx.slots.slides?.contains(doc.activeElement) ? filmstripKeys() : selection.items.filter(isSlideKey)) : selection.items);
  s.hasClipboard = () => Boolean(clipboard);
  s.canUndo = () => session.canUndo;
  s.canRedo = () => session.canRedo;
  s.slideCount = () => adapter.slides().length;
  s.groupBeside = (delta) => {
    const nodes = s.selectedNodes();
    if (!nodes.length || !nodes[0].parent) return "Select blocks first.";
    const list = scene().contentChildren(nodes[0].parent);
    const at = delta < 0 ? list.findIndex((node) => node.key === nodes[0].key) - 1 : list.findIndex((node) => node.key === nodes.at(-1).key) + 1;
    return list[at]?.kind === "group" ? true : delta < 0 ? "There is no group just before this." : "There is no group just after this.";
  };
  s.canPlaceInRegions = () => (scene().layout ? "This slide uses a layout's regions." : scene().node(scene().slideKey)?.container?.promoted ? "This slide's content is already in regions." : true);
  s.canReleaseRegions = () => (scene().node(scene().slideKey)?.container?.promoted ? true : "This slide's content is not in regions.");
  s.canEditLayout = () => {
    if (!ctx.slots.layouts) return "Layout Studio is not part of this editor.";
    const slide = ui.get(`/slides/${ctx.slideIndex()}`);
    return typeof slide?.layout === "string" && slide.layout !== "auto" ? true : "This slide has no layout to edit. Choose one first.";
  };
  s.textTarget = () => {
    const node = s.primaryNode();
    if (!node || selection.items.length !== 1 || !isTextNode(node)) return null;
    return textPathOf(node);
  };
  s.editingText = () => Boolean(canvas.editingPath) || Boolean(canvas.cropping);
  /** Whether a key event is a shortcut of an enabled command other than a tool (so typing on a selected text node does not take it). */
  s.isShortcut = (event) => {
    const command = commands.match(event, s, { scope: "canvas" }) ?? commands.match(event, s, { scope: "global" });
    return Boolean(command && command.group !== "Tools");
  };
  s.commandState = (id) => {
    const info = commands.list(s, { win }).find((entry) => entry.id === id);
    return info ? { enabled: info.enabled, reason: info.reason, shortcut: info.shortcut } : { enabled: false, reason: "Unknown command." };
  };
  s.run = (id) => runCommand(id);
  function runCommand(id, event) {
    const command = commands.get(id);
    if (!command) return false;
    const verdict = command.when ? command.when(s) : true;
    if (verdict !== true) {
      if (typeof verdict === "string") announce(verdict);
      ctx.emit("command", { id, ok: false, reason: typeof verdict === "string" ? verdict : "" });
      return false;
    }
    let ok = true;
    try {
      const result = command.run(s, event);
      ok = result === undefined ? true : Boolean(result);
    } catch (error) {
      ok = false;
      announce(error?.message ?? String(error));
    }
    ctx.emit("command", { id, ok });
    return ok;
  }

  // ---- structural commands (one adapter call each: one undo step) -----------------------------------------------------------------------
  const nameOf = (node) => (node ? node.label.split(":")[0] : "");
  function placeMessage(keys, verb) {
    const s0 = scene();
    const node = s0.node(keys[0]);
    if (!node) return verb;
    const list = s0.contentChildren(node.parent);
    const at = list.findIndex((entry) => entry.key === node.key);
    const lastAt = list.findIndex((entry) => entry.key === keys.at(-1));
    const subject = keys.length > 1 ? plural(keys.length, "block") : nameOf(node);
    const next = list[lastAt + 1], previous = list[at - 1];
    if (next) return `${verb} ${subject} before ${nameOf(next)}`;
    if (previous) return `${verb} ${subject} after ${nameOf(previous)}`;
    const parent = s0.node(node.parent);
    return `${verb} ${subject} into ${parent?.kind === "slide" ? "the slide" : nameOf(parent)}`;
  }
  function applyCommand(command, args, message) {
    if (s.editingText() && !canvas.commit()) return false;
    const result = adapter.apply(command, ...args);
    if (!result.ok) return false;
    if (!result.changed) { announce("Nothing changed."); return false; }
    announce(typeof message === "function" ? message(result) : message ?? result.label);
    return true;
  }
  s.move = (keys, target, index) => applyCommand("move", [keys, target, index], (result) => placeMessage(result.keys, "Moved"));
  s.moveBy = (delta) => applyCommand("moveBy", [selection.items, delta], (result) => placeMessage(result.keys, "Moved"));
  s.moveInto = (delta) => applyCommand("moveInto", [selection.items, delta], (result) => placeMessage(result.keys, "Moved"));
  s.group = () => applyCommand("group", [selection.items], (result) => `${result.label}`);
  s.ungroup = () => applyCommand("ungroup", [selection.primary], (result) => `Ungrouped into ${plural(result.keys.length, "block")}`);
  s.duplicate = () => {
    const keys = scopeKeys();
    return applyCommand("duplicate", [keys]);
  };
  s.remove = () => {
    const keys = scopeKeys();
    const slides = keys.every(isSlideKey);
    if (slides && keys.length >= adapter.slides().length) { announce("A presentation keeps at least one slide."); return false; }
    return applyCommand("delete", [keys], (result) => `${result.label}. Undo with ${formatKey("Mod-z", win)}.`);
  };
  s.equalize = (key, index) => applyCommand("equalize", [key, index], "Equalized");
  s.setWeights = (key, weights) => applyCommand("setWeights", [key, weights]);
  s.nudgeDivider = (key, index, step, big) => {
    const node = scene().node(key);
    const track = node?.container?.tracks;
    if (!track) return false;
    const base = track[index].length / (track[index].length + track[index + 1].length);
    const current = node.container.tracks.map((entry) => entry.weight);
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      const fraction = Math.max(0.02, Math.min(0.98, base + step * attempt * (big ? 0.05 : 0.01)));
      let prepared;
      try { prepared = adapter.prepare("resizeTracks", key, index, fraction); } catch (error) { announce(error.message); return false; }
      const moved = prepared.changed && (!jsonEqual(prepared.weights, current) || attempt === 1 && !current.length);
      if (moved) return applyCommand("resizeTracks", [key, index, fraction]);
      if (fraction === 0.02 || fraction === 0.98) break;
    }
    announce("The divider is at its end.");
    return false;
  };
  s.writeComposition = (node, composition, label) => {
    if (s.readOnly) { announce("This editor is read-only."); return false; }
    try {
      const pointer = `${node.path}/composition`;
      const patches = composition === undefined ? (ui.get(pointer) === undefined ? [] : [{ op: "remove", path: pointer }]) : [{ op: ui.get(pointer) === undefined ? "add" : "replace", path: pointer, value: composition }];
      if (!patches.length) return false;
      ui.applyPatch(patches, { source: "studio", label, selection: selection.snapshot(), rejectInvalid: true });
      announce(label);
      return true;
    } catch (error) { announce(error.message); return false; }
  };
  s.writeValue = (pointer, value, label) => {
    if (s.readOnly) { announce("This editor is read-only."); return false; }
    try {
      const has = ui.get(pointer) !== undefined;
      const patches = value === undefined ? (has ? [{ op: "remove", path: pointer }] : []) : [{ op: has ? "replace" : "add", path: pointer, value }];
      if (patches.length) ui.applyPatch(patches, { source: "studio", label, rejectInvalid: true });
      announce(label);
      return true;
    } catch (error) { announce(error.message); return false; }
  };
  s.undo = () => { if (s.editingText() && !canvas.commit()) return false; ctx.pane?.getText(); return adapter.undo() ? (announce("Undone"), true) : false; };
  s.redo = () => { if (s.editingText() && !canvas.commit()) return false; ctx.pane?.getText(); return adapter.redo() ? (announce("Redone"), true) : false; };
  s.afterGesture = () => paint();

  // Convert to: the primary block's targets.
  s.canConvert = (kind) => {
    const node = s.primaryNode();
    if (!node || selection.items.length !== 1 || !(node.kind === "block" || node.kind === "implicit")) return "Select one block to convert it.";
    if (node.type === kind) return `This is already ${kind}.`;
    const target = blockConversionTargets(ui.presentation, dottedPath(node.path), { catalogs: ctx.catalogs() }).find((entry) => entry.kind === kind);
    if (!target) return `This cannot become ${kind}.`;
    return target.available ? true : target.reason ?? `This cannot become ${kind}.`;
  };
  s.convert = (kind) => {
    const node = s.primaryNode();
    try {
      const change = convertBlock(ui, dottedPath(node.path), kind, { source: "studio", selection: selection.snapshot() }, { catalogs: ctx.catalogs() });
      announce(`Converted to ${STUDIO_INSERT_LABELS[kind]?.toLowerCase() ?? kind}${change.lossless === false ? ". Some content did not fit; undo to get it back." : ""}`);
      return true;
    } catch (error) { announce(error.message); return false; }
  };
  s.placeInRegions = () => { setSelection([scene().slideKey], { source: "api" }); showTab("design"); design.showSection("slide-content"); announce("Choose how to place the blocks in the slide's Design panel."); };
  s.releaseRegions = () => {
    try { regionsAsBlocks(ui, ctx.slideIndex(), { source: "studio" }); announce("Regions are now blocks, in reading order."); return true; } catch (error) { announce(error.message); return false; }
  };

  // ---- clipboard ------------------------------------------------------------------------------------------------------------------------
  const token = Symbol("studio");
  s.copy = () => {
    const keys = scopeKeys();
    try {
      const clip = adapter.copy(keys);
      if (clip.kind === "opf-studio-blocks") {
        // A self-contained one-slide deck carries the catalog records the blocks use, so a paste into another deck namespaces them.
        const slide = { ...ui.get(`/slides/${ctx.slideIndex()}`) };
        for (const key of Object.keys(slide)) if (!["id", "layout", "design", "composition"].includes(key)) delete slide[key];
        delete slide.layout;
        clip.deck = prepareSave({ ...ui.presentation, slides: [{ ...slide, blocks: structuredClone(clip.blocks) }] }, { catalogs: ctx.catalogs() }).document;
      }
      clipboard = { ...clip, source: token, documentHash: session.documentHash() };
      const text = JSON.stringify(clip.kind === "opf-studio-slides" ? clip.presentation : clip.deck, null, 2);
      copyText(text).catch(() => {});
      announce(clip.kind === "opf-studio-slides" ? `Copied ${plural(clip.count, "slide")}` : `Copied ${plural(clip.count, "block")}`);
      return true;
    } catch (error) { announce(error.message); return false; }
  };
  s.cut = () => (s.copy() ? s.remove() : false);
  s.paste = () => {
    const clip = clipboard;
    if (!clip) { announce("The clipboard is empty."); return false; }
    if (s.editingText() && !canvas.commit()) return false;
    if (clip.kind === "opf-studio-slides") {
      const after = s.slideScope() && ctx.slideManager ? Math.max(...(ctx.slideManager.getSelection?.() ?? [ctx.slideIndex()])) : ctx.slideIndex();
      return applyCommand("paste", [clip, { slideIndex: after }], (result) => `${result.label}`);
    }
    const place = pastePlace();
    if (typeof place === "string") { announce(place); return false; }
    if (clip.source === token) return applyCommand("paste", [clip, place]);
    return pasteForeign(clip, place);
  };
  // Where a paste or an insert lands: after the primary in its container, into a selected container, or at the end of the slide.
  function pastePlace(kind) {
    const s0 = scene();
    const node = s.primaryNode();
    if (node && (node.kind === "block" || node.kind === "implicit" || node.kind === "group" && kind === undefined)) {
      const parent = s0.node(node.parent);
      if (parent && (parent.kind !== "slide" || !s0.layout)) return { target: parent.key, index: s0.contentChildren(parent.key).findIndex((entry) => entry.key === node.key) + 1 };
    }
    if (node && (node.kind === "group" || node.kind === "region")) return { target: node.key, index: s0.contentChildren(node.key).length };
    const slide = s0.node(s0.slideKey);
    if (s0.layout || slide.container?.promoted) {
      const regions = s0.children(s0.slideKey).filter((entry) => entry.kind === "region");
      const region = regions.find((entry) => !kind || !entry.accepts?.length || entry.accepts.includes(kind));
      if (!region) return kind ? `No region of this layout accepts ${kind}.` : "Select a region to paste into.";
      return { target: region.key, index: s0.contentChildren(region.key).length };
    }
    return { target: s0.slideKey, index: s0.contentChildren(s0.slideKey).length };
  }
  // Blocks copied from another deck: the transfer import brings their catalog records, assets and datasets along (renamed where they
  // differ), then the blocks are pasted; one change.
  function pasteForeign(clip, place) {
    try {
      const base = ui.presentation;
      const imported = prepareOpfImport(base, { presentation: clip.deck }, { mode: "insert", slideIndex: base.slides.length - 1, catalogs: ctx.catalogs() });
      const added = imported.presentation.slides[base.slides.length];
      const blocks = added?.blocks ?? clip.blocks;
      const patches = [];
      for (const key of new Set([...Object.keys(base), ...Object.keys(imported.presentation)])) {
        if (key === "slides" || jsonEqual(base[key], imported.presentation[key])) continue;
        patches.push(imported.presentation[key] === undefined ? { op: "remove", path: formatPointer([key]) } : { op: Object.hasOwn(base, key) ? "replace" : "add", path: formatPointer([key]), value: imported.presentation[key] });
      }
      const prepared = adapter.prepare("paste", { kind: "opf-studio-blocks", blocks, count: blocks.length }, place);
      ui.applyPatch([...patches, ...prepared.patches], { source: "studio", label: prepared.label, selection: selection.snapshot(), rejectInvalid: true }, { expectHash: session.documentHash() });
      setSelection(prepared.paths.map((path) => adapter.keyOf(path)), { source: "paste" });
      const renamed = Object.keys(imported.renamed ?? {}).length;
      announce(`${prepared.label}${renamed ? `, with ${plural(renamed, "catalog record")} renamed` : ""}`);
      return true;
    } catch (error) { announce(error.message); return false; }
  }

  // ---- insert ---------------------------------------------------------------------------------------------------------------------------
  s.insertVerdict = (kind, targetKey) => {
    const s0 = scene();
    const target = s0.node(targetKey);
    if (!target) return "Drop inside the slide.";
    if (target.kind === "region" && target.virtual && target.accepts?.length && !target.accepts.includes(kind)) return `Region ${target.region} accepts only ${target.accepts.join(", ")}.`;
    if (target.kind === "slide" && s0.layout) return "Drop into one of the layout's regions.";
    if (target.kind === "slide" && target.container?.promoted) return "Drop into one of the slide's regions.";
    if (target.kind === "region" && target.virtual && target.max && s0.contentChildren(target.key).length >= target.max) return `Region ${target.region} is full.`;
    return true;
  };
  s.canInsert = (kind) => {
    const place = pastePlace(kind);
    if (typeof place === "string") return place;
    return s.insertVerdict(kind, place.target);
  };
  function newBlock(kind) {
    if (kind === "image") return { image: { src: PLACEHOLDER_PICTURE, alt: "Placeholder picture" } };
    return createContentBlock(kind);
  }
  s.insert = (kind, place = pastePlace(kind)) => {
    if (typeof place === "string") { announce(place); return false; }
    const verdict = s.insertVerdict(kind, place.target);
    if (verdict !== true) { announce(verdict); return false; }
    if (kind === "video") { promptVideo((src) => insertBlock({ video: { src } }, kind, place)); return true; }
    return insertBlock(newBlock(kind), kind, place);
  };
  function insertBlock(block, kind, place) {
    if (s.editingText() && !canvas.commit()) return false;
    // A deck that uses ids gives the new block one too (`chart-2`, unused), so its key survives later moves.
    if (typeof ui.get(`/slides/${ctx.slideIndex()}/id`) === "string" && block.id === undefined) {
      const taken = new Set(collectReservedPresentationIds(ui.presentation));
      let number = 1;
      while (taken.has(`${kind}-${number}`)) number += 1;
      block.id = `${kind}-${number}`;
    }
    const label = `Inserted ${STUDIO_INSERT_LABELS[kind].toLowerCase()}`;
    const result = adapter.apply("paste", { kind: "opf-studio-blocks", blocks: [block], count: 1 }, { ...place, label });
    if (!result.changed) return false;
    announce(label);
    if (["text", "list", "quote", "metric", "code"].includes(kind)) win.requestAnimationFrame?.(() => { if (!destroyed && selection.primary === result.keys[0]) s.beginTextEdit(result.keys[0]); });
    return true;
  }
  s.insertAtPoint = (kind, point) => {
    const found = adapter.dropAt(point, []);
    s.setTool("select");
    if (!found) return false;
    return s.insert(kind, { target: found.target, index: found.index });
  };
  function promptVideo(done) {
    const dialog = el("div", `${PREFIX}-dialog`, { role: "dialog", "aria-modal": "true", "aria-labelledby": "opf-studio-video-title" });
    const input = el("input", `${PREFIX}-input`, { type: "url", placeholder: "https://…", "aria-label": "Video address" });
    const ok = dom.button(`${PREFIX}-action`, { text: "Insert video" });
    const cancel = dom.button(`${PREFIX}-action`, { text: "Cancel" });
    const close = () => { dialog.remove(); canvasView.focusPrimary(); };
    ok.addEventListener("click", () => { const value = input.value.trim(); if (!value) { input.focus(); return; } close(); done(value); });
    cancel.addEventListener("click", close);
    dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } if (event.key === "Enter" && event.target === input) ok.click(); });
    dialog.append(el("h2", `${PREFIX}-dialog-title`, { id: "opf-studio-video-title", text: "Insert a video" }), input, el("div", `${PREFIX}-actions`));
    dialog.lastChild.append(ok, cancel);
    root.append(dialog);
    input.focus();
  }

  // ---- text, data, crop -------------------------------------------------------------------------------------------------------------------
  const preview = () => ctx.slots.canvas.querySelector(".opf-canvas-preview");
  function textPathOf(node, point) {
    const host = preview();
    if (!host) return null;
    const dotted = dottedPath(node.path);
    const matches = (path) => path === dotted || path.startsWith(`${dotted}.`);
    if (point) {
      for (const element of doc.elementsFromPoint(point.clientX, point.clientY)) {
        const target = element.closest?.("[data-canvas-target]");
        if (target && host.contains(target) && matches(target.getAttribute("data-opf-path"))) return target.getAttribute("data-opf-path");
      }
    }
    for (const target of host.querySelectorAll("[data-canvas-target]")) if (matches(target.getAttribute("data-opf-path"))) return target.getAttribute("data-opf-path");
    return null;
  }
  s.beginTextEdit = (key, { point, replace } = {}) => {
    const node = scene().node(key);
    if (!node) return false;
    if (s.readOnly) { announce("This editor is read-only."); return false; }
    if (!(selection.items.length === 1 && selection.primary === key)) setSelection([key], { source: "canvas" });
    const path = textPathOf(node, point);
    if (!path) { announce("There is no text to edit here."); return false; }
    root.dataset.editing = "true";
    canvas.beginEdit(path, point ? { point } : undefined);
    if (replace) {
      const input = doc.activeElement;
      if (input && typeof input.setRangeText === "function") {
        input.setRangeText(replace, input.selectionStart ?? 0, input.selectionEnd ?? input.value.length, "end");
        input.dispatchEvent(new win.Event("input", { bubbles: true }));
      }
    }
    root.dataset.editing = s.editingText() ? "true" : "false";
    return true;
  };
  s.editText = () => s.beginTextEdit(selection.primary);
  s.cropImage = () => {
    const node = s.primaryNode();
    if (!node) return false;
    const dotted = dottedPath(node.path);
    const path = node.kind === "implicit" ? dotted : `${dotted}.image`;
    canvas.cropImage(path).then((opened) => { if (!opened) announce("This picture cannot be cropped."); else root.dataset.editing = "true"; });
    return true;
  };
  s.editData = () => {
    const node = s.primaryNode();
    if (!node) return false;
    openDataDock(dottedPath(node.path));
    return true;
  };
  async function openDataDock(path) {
    shell.dataDock.hidden = false;
    if (!dataGrid) {
      const { createDataGrid } = await import("./data-grid.js");
      if (destroyed) return;
      const head = el("div", `${PREFIX}-datahead`);
      const close = dom.button(`${PREFIX}-iconbutton`, { label: "Close data", iconName: "X", size: 16 });
      close.addEventListener("click", () => { shell.dataDock.hidden = true; canvasView.focusPrimary(); });
      head.append(el("h2", `${PREFIX}-paneltitle`, { text: "Data" }), close);
      const host = el("div", `${PREFIX}-datagrid`);
      shell.dataDock.replaceChildren(head, host);
      dataGrid = createDataGrid(host, { editor: ui, getSelectedPath: () => dataPath, maxHeight: "220px", onStatus: (message) => announce(message) });
    }
    dataPath = path;
    dataGrid.refresh();
    dataGrid.focus();
  }
  let dataPath = null;

  // ---- slides -----------------------------------------------------------------------------------------------------------------------------
  const currentLayout = () => { const slide = ui.get(`/slides/${ctx.slideIndex()}`); return typeof slide?.layout === "string" ? slide.layout : undefined; };
  s.newSlide = (layoutId = currentLayout(), at = ctx.slideIndex() + 1) => {
    try {
      const change = addSlide(ui, { at, ...(layoutId && layoutId !== "auto" ? { layout: layoutId } : {}) }, { source: "studio", label: "New slide", selection: selection.snapshot() });
      const index = change?.index ?? at;
      ctx.go(index);
      adapter.setSlide(index);
      setSelection([adapter.slides()[index].key], { source: "slide" });
      announce(`Added slide ${index + 1}${layoutId ? ` with ${layoutId}` : ""}`);
      return true;
    } catch (error) { announce(error.message); return false; }
  };
  s.applyLayout = (layoutId) => {
    try {
      switchDimension(ui, "layouts", layoutId, { slideIndex: ctx.slideIndex(), catalogs: ctx.catalogs() });
      announce(`Slide ${ctx.slideIndex() + 1} uses ${layoutId}`);
      return true;
    } catch (error) { announce(error.message); return false; }
  };
  s.duplicateSlide = () => applyCommand("duplicate", [[scene().slideKey]]);
  s.deleteSlide = () => applyCommand("delete", [[scene().slideKey]], (result) => `${result.label}. Undo with ${formatKey("Mod-z", win)}.`);
  s.hideSlide = () => {
    const index = ctx.slideIndex();
    const hidden = ui.get(`/slides/${index}/hidden`) === true;
    try { setHidden(ui, [index], !hidden, { source: "studio" }); announce(hidden ? `Slide ${index + 1} is shown` : `Slide ${index + 1} is hidden`); return true; } catch (error) { announce(error.message); return false; }
  };
  s.goSlide = (delta) => { const index = Math.max(0, Math.min(s.slideCount() - 1, ctx.slideIndex() + delta)); ctx.go(index); };
  s.present = (fromStart) => ctx.present(fromStart ? 0 : ctx.slideIndex());

  // ---- deck: find, export, file ---------------------------------------------------------------------------------------------------------
  s.find = (replace) => ctx.openFind(replace ? { replace: true } : {});
  s.openExport = () => { ctx.exportMenu?.open("first"); return true; };
  s.openShortcuts = () => openShortcutSheet();
  s.download = async (format) => {
    try {
      const deck = ui.presentation;
      let text, mime, extension;
      if (format === "json") { text = JSON.stringify(prepareSave(deck, { catalogs: ctx.catalogs() }).document, null, 2); mime = "application/json"; extension = "opf.json"; }
      else if (format === "yaml") { const { toYaml } = await import("@openpresentation/opf/yaml"); text = toYaml(deck).yaml; mime = "application/yaml"; extension = "opf.yaml"; }
      else { const { toMarkdown } = await import("@openpresentation/opf/markdown"); text = toMarkdown(deck).markdown; mime = "text/markdown"; extension = "opf.md"; }
      const base = String(ctx.getName() || deck.name || "presentation").replace(/[\\/:*?"<>|]+/g, "-").trim() || "presentation";
      const fileOut = { filename: `${base}.${extension}`, text, mime, format };
      if (options.export?.onDownload) await options.export.onDownload({ blob: new Blob([text], { type: mime }), fileName: fileOut.filename, format });
      else downloadSourceFile(fileOut);
      ctx.persistence?.markSaved?.();
      announce(`Downloaded ${fileOut.filename}`);
      return true;
    } catch (error) { announce(error.message); return false; }
  };
  s.copyDocument = () => {
    copyText(JSON.stringify(prepareSave(ui.presentation, { catalogs: ctx.catalogs() }).document, null, 2)).then(() => announce("Copied the presentation as OPF JSON"), (error) => announce(error.message));
    return true;
  };
  let fileInput = null;
  s.openFile = () => {
    fileInput ??= Object.assign(el("input", `${PREFIX}-fileinput`, { type: "file", accept: DECK_FILE_ACCEPT, "aria-hidden": "true", tabindex: "-1" }), {});
    if (!fileInput.isConnected) {
      root.append(fileInput);
      fileInput.addEventListener("change", async () => {
        const chosen = fileInput.files?.[0];
        fileInput.value = "";
        if (!chosen) return;
        try {
          const read = await readDeckFile(chosen, { catalogs: ctx.catalogs() });
          const text = await chosen.text();
          ctx.setDocument(read.document, { text, format: read.format, name: read.name });
          announce(`Opened ${chosen.name}`);
        } catch (error) { announce(error.message); }
      });
    }
    fileInput.click();
    return true;
  };
  s.newDocument = () => { ctx.setDocument({ name: "Untitled presentation", slides: [{ id: "slide-1", title: "Untitled slide" }] }, { name: "Untitled presentation" }); announce("New presentation"); return true; };

  // ---- Layout Studio handoff ("Edit layout") ---------------------------------------------------------------------------------------------
  s.editLayout = () => openLayout();
  function openLayout(layoutId = currentLayout(), { slide = ctx.slideIndex() } = {}) {
    if (!layoutId || !ctx.slots.layouts) return false;
    if (s.editingText() && !canvas.commit()) return false;
    const deck = ui.presentation;
    const custom = deck.catalogs?.custom?.layouts ?? {};
    let record, recordId = layoutId, forked = false;
    if (custom[layoutId]) record = { id: layoutId, ...structuredClone(custom[layoutId]) };
    else {
      const choice = listSwitchOptions(deck, "layouts", { catalogs: ctx.catalogs() }).find((entry) => entry.id === layoutId);
      if (!choice?.record) { announce(`Layout ${layoutId} was not found.`); return false; }
      let id = `${layoutId.replace(/^.*:/, "")}-custom`;
      for (let n = 2; custom[id]; n += 1) id = `${layoutId.replace(/^.*:/, "")}-custom-${n}`;
      recordId = id;
      forked = true;
      record = { ...structuredClone(choice.record), id, name: `${choice.record.name ?? choice.label ?? layoutId} (custom)` };
    }
    if (slide !== ctx.slideIndex()) ctx.go(slide);
    ctx.setView("layouts");
    const studioPart = ctx.layoutStudio();
    if (!studioPart) return false;
    studioPart.editor.setRecord(record);
    const start = JSON.stringify(studioPart.editor.getRecord());
    layoutHandoff = { slide, recordId, forked, start, selection: selection.snapshot(), part: studioPart };
    root.dataset.view = "layouts";
    shell.layoutsArea.hidden = false;
    buildCrumbs();
    ctx.emit("layoutStudio", { open: true, recordId });
    announce(forked ? `Editing a copy of ${layoutId} as ${recordId}` : `Editing ${recordId}`);
    return true;
  }
  s.openLayout = openLayout;
  function buildCrumbs() {
    const crumbs = shell.crumbs;
    const back = dom.button(`${PREFIX}-action`, { text: "Back", iconName: "ChevronRight", size: 14, attributes: { "data-handoff": "back" } });
    back.firstChild.style.transform = "rotate(180deg)";
    const use = dom.button(`${PREFIX}-action ${PREFIX}-primary`, { text: "Use on this slide", attributes: { "data-handoff": "apply" } });
    const save = dom.button(`${PREFIX}-action`, { text: "Save to deck", attributes: { "data-handoff": "save" } });
    use.disabled = save.disabled = s.readOnly;
    const trail = el("ol", `${PREFIX}-trail`);
    trail.append(el("li", "", { text: `Slide ${layoutHandoff.slide + 1}` }), el("li", "", { text: `Layout ${layoutHandoff.recordId}`, "aria-current": "page" }));
    crumbs.replaceChildren(back, trail, el("span", `${PREFIX}-spacer`), use, save);
    back.addEventListener("click", () => closeLayout({ ask: true }));
    use.addEventListener("click", () => {
      try {
        layoutHandoff.part.editor.applyToSlide(ui, layoutHandoff.slide, { source: "studio" });
        announce(`Slide ${layoutHandoff.slide + 1} now uses ${layoutHandoff.part.editor.getRecord().id}`);
        closeLayout();
      } catch (error) { announce(error.issues?.[0]?.message ?? error.message); }
    });
    save.addEventListener("click", () => {
      try {
        const change = layoutHandoff.part.editor.saveToDeck(ui, { replace: !layoutHandoff.forked });
        announce(`Saved ${change.layoutId} in this presentation's layouts`);
        closeLayout();
      } catch (error) { announce(error.issues?.[0]?.message ?? error.message); }
    });
    back.focus();
  }
  function closeLayout({ ask = false } = {}) {
    if (!layoutHandoff) return true;
    const changed = JSON.stringify(layoutHandoff.part.editor.getRecord()) !== layoutHandoff.start;
    if (ask && changed && !win.confirm("Leave the layout without saving your changes?")) return false;
    const { slide, recordId, selection: kept } = layoutHandoff;
    layoutHandoff = null;
    shell.layoutsArea.hidden = true;
    root.dataset.view = "slide";
    ctx.setView("slide");
    if (slide !== ctx.slideIndex()) ctx.go(slide);
    adapter.setSlide(slide);
    setSelection(kept, { source: "api" });
    ctx.emit("layoutStudio", { open: false, recordId });
    canvasView.focusPrimary();
    return true;
  }
  s.closeLayout = closeLayout;

  // ---- presets -------------------------------------------------------------------------------------------------------------------------
  function applyPreset() {
    root.dataset.preset = layout;
    root.dataset.opfLayout = layout;
    canvas.setTextEntry(layout === "playground" ? "click" : "dblclick");
    canvas.setTargets(layout === "playground" ? "interactive" : "passive");
    canvasView.setEnabled(layout === "studio");
    if (layout === "playground") setPlaygroundView(playgroundView);
    else {
      if (studioSource === null) studioSource = config.panels?.source && config.panels.source !== "tab" ? config.panels.source.replace("split-", "") : "off";
      setSourceMode(studioSource);
    }
    for (const button of [shell.insert, shell.addSlide, ...Object.values(shell.toolButtons)]) button.hidden = layout !== "studio";
    shell.views.hidden = layout !== "playground";
    shell.openStudio.hidden = layout !== "playground";
    shell.zoom.hidden = layout !== "studio";
  }
  s.setLayout = (next) => {
    if (next !== "studio" && next !== "playground") throw new RangeError('setLayout takes "studio" or "playground".');
    if (next === layout) return false;
    if (s.editingText() && !canvas.commit()) return false;
    if (layoutHandoff) closeLayout();
    const previous = layout;
    layout = next;
    applyPreset();
    ctx.mountSlideRow?.();
    paint();
    layers.render();
    design.refresh();
    ctx.emit("layout", { layout: next, previous });
    announce(next === "studio" ? "Studio" : "Playground");
    return true;
  };

  // ---- menus: File, Insert, + Slide, zoom, context ---------------------------------------------------------------------------------------
  const menuFrom = (ids) => commands.menu(ids, s, { win }).map((item) => ({ ...item, onSelect: () => runCommand(item.id) }));
  function show(items, anchor, label, extra = {}) {
    menu?.close({ restore: false });
    const box = anchor.getBoundingClientRect?.() ?? { left: anchor.x, bottom: anchor.y };
    menu = openMenu(dom, root, { x: box.left, y: box.bottom + 4, items, label, returnFocus: extra.returnFocus ?? anchor, onClose: () => { menu = null; anchor.setAttribute?.("aria-expanded", "false"); }, className: extra.className });
    anchor.setAttribute?.("aria-expanded", "true");
    return menu;
  }
  function fileMenu() {
    const items = [
      ...menuFrom(["studio.file.new", "studio.file.open"]),
      ...(typeof options.import?.pptx === "function" ? [{ label: "Import PowerPoint…", onSelect: () => options.import.pptx(ctx.handle) }] : []),
      { separator: true },
      ...menuFrom(["studio.file.download.json", "studio.file.download.yaml", "studio.file.download.markdown", "studio.file.copy"]),
      { separator: true },
      ...menuFrom(["studio.export", "studio.present", "studio.shortcuts"]),
      { separator: true },
      ...menuFrom([layout === "studio" ? "studio.layout.playground" : "studio.layout.studio"]),
    ];
    for (const item of config.fileItems ?? []) items.push({ label: item.label, onSelect: () => item.run(ctx.handle) });
    show(items, shell.file, "File");
  }
  function insertItems({ drag = true, target } = {}) {
    return STUDIO_INSERT_KINDS.map((kind) => {
      // Into a given region (its placeholder's +): its own verdict and place.
      const regionVerdict = target ? (s.readOnly ? "This editor is read-only." : s.insertVerdict(kind, target)) : null;
      const verdict = target ? { enabled: regionVerdict === true, reason: regionVerdict === true ? "" : regionVerdict } : commands.list(s, { win }).find((entry) => entry.id === `studio.insert.${kind}`);
      return {
        label: STUDIO_INSERT_LABELS[kind], description: STUDIO_INSERT_HINTS[kind], icon: INSERT_ICONS[kind],
        disabled: !verdict.enabled, title: verdict.reason || undefined,
        onSelect: () => (target ? s.insert(kind, { target, index: 0 }) : runCommand(`studio.insert.${kind}`)),
        pointerdown: drag ? (event, _item, menuHandle) => insertPress(event, kind, menuHandle) : undefined,
      };
    });
  }
  // A press on an Insert item that moves past 4px becomes a drag onto the slide (the drop lines decide where the block lands).
  function insertPress(event, kind, menuHandle) {
    if (event.button !== 0 || s.readOnly) return;
    const start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    const move = (next) => {
      if (next.pointerId !== start.id || Math.hypot(next.clientX - start.x, next.clientY - start.y) < 4) return;
      stop();
      menuHandle.close();
      canvasView.beginInsertDrag(kind, next);
    };
    const stop = () => { doc.removeEventListener("pointermove", move, true); doc.removeEventListener("pointerup", stop, true); };
    doc.addEventListener("pointermove", move, true);
    doc.addEventListener("pointerup", stop, true);
  }
  s.openInsertMenu = (anchor = shell.insert, { target } = {}) => show(insertItems({ target, drag: !target }), anchor, target ? `Insert into ${scene().node(target)?.label ?? "region"}` : "Insert", { className: `${PREFIX}-insertmenu` });
  function layoutChoices() {
    return listSwitchOptions(ui.presentation, "layouts", { catalogs: ctx.catalogs() });
  }
  s.openSlideMenu = (anchor = shell.addSlide, { apply = false } = {}) => {
    const items = [];
    if (!apply) items.push({ label: "New slide", description: currentLayout() ? `With ${currentLayout()}, after this one` : "After this one", icon: "Plus", onSelect: () => runCommand("studio.slide.new") });
    for (const group of groupLayoutChoices(layoutChoices())) {
      for (const choice of group.choices) {
        items.push({ label: choice.label, group: group.name, media: choice.record ? buildLayoutDiagram(doc, choice.record) : undefined, disabled: s.readOnly, title: s.readOnly ? "This editor is read-only." : undefined, onSelect: () => (apply ? s.applyLayout(choice.id) : s.newSlide(choice.id)) });
      }
    }
    show(items, anchor, apply ? "Change layout" : "Add a slide", { className: `${PREFIX}-slidemenu` });
  };
  function zoomMenu() {
    const items = [
      ...menuFrom(["studio.zoom.in", "studio.zoom.out", "studio.zoom.fit"]),
      { label: "Fit width", onSelect: () => s.fit("width") },
      { separator: true },
      ...[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map((value) => ({ label: `${value * 100}%`, role: "menuitemcheckbox", checked: Math.abs(canvasView.zoom - value) < 0.001, onSelect: () => s.setZoom(value) })),
    ];
    show(items, shell.zoom, "Zoom");
  }
  s.openContextMenu = (point, { returnFocus } = {}) => {
    const node = s.primaryNode();
    const slide = !node || node.kind === "slide";
    const items = [];
    const groups = contextMenuGroups({ slide });
    groups.forEach((ids, at) => {
      if (at) items.push({ separator: true });
      items.push(...menuFrom(ids));
      if (at === 1 && !slide) {
        // Move into: the groups and regions of this slide.
        const s0 = scene();
        for (const target of s0.nodes.filter((entry) => (entry.kind === "group" || entry.kind === "region") && !selection.items.includes(entry.key) && entry.key !== node?.parent)) {
          const verdict = node ? adapter.trialMove(selection.items, target.key, s0.contentChildren(target.key).length) : { ok: false, reason: "" };
          items.push({ label: `Move into ${target.label}`, group: "Move into", disabled: !verdict.ok || s.readOnly, title: verdict.reason || undefined, onSelect: () => s.move(selection.items, target.key, s0.contentChildren(target.key).length) });
        }
      }
      if (at === 1 && !slide) {
        for (const kind of STUDIO_INSERT_KINDS) {
          const id = `studio.convert.${kind}`;
          if (!commands.has(id)) continue;
          const verdict = commands.list(s, { win }).find((entry) => entry.id === id);
          if (verdict.enabled) items.push({ label: `Convert to ${STUDIO_INSERT_LABELS[kind].toLowerCase()}`, group: "Convert to", onSelect: () => runCommand(id) });
        }
      }
    });
    const focusNode = returnFocus ?? canvasView.boxOf(selection.primary) ?? shell.frame;
    menu?.close({ restore: false });
    menu = openMenu(dom, root, { x: point.x, y: point.y, items, label: slide ? "Slide actions" : "Block actions", returnFocus: focusNode, onClose: () => { menu = null; } });
    return menu;
  };

  // ---- the shortcut sheet --------------------------------------------------------------------------------------------------------------
  let sheetDialog = null;
  function openShortcutSheet() {
    sheetDialog?.close();
    const returnFocus = doc.activeElement;
    const dialog = el("div", `${PREFIX}-dialog ${PREFIX}-shortcuts`, { role: "dialog", "aria-modal": "true", "aria-labelledby": "opf-studio-shortcuts-title" });
    const search = el("input", `${PREFIX}-input`, { type: "search", placeholder: "Search commands", "aria-label": "Search commands" });
    const list = el("div", `${PREFIX}-shortcutlist`);
    const close = dom.button(`${PREFIX}-iconbutton`, { label: "Close", iconName: "X", size: 16 });
    const head = el("div", `${PREFIX}-dialoghead`);
    head.append(el("h2", `${PREFIX}-dialog-title`, { id: "opf-studio-shortcuts-title", text: "Keyboard shortcuts" }), close);
    dialog.append(head, search, list);
    const draw = () => {
      const query = search.value.trim().toLowerCase();
      const entries = commands.list(s, { win }).filter((entry) => (entry.keys.length || query) && (!query || `${entry.label} ${entry.group} ${entry.id}`.toLowerCase().includes(query)));
      const groups = new Map();
      for (const entry of entries) { if (!groups.has(entry.group)) groups.set(entry.group, []); groups.get(entry.group).push(entry); }
      list.replaceChildren(...[...groups].map(([group, rows]) => {
        const section = el("section", `${PREFIX}-shortcutgroup`);
        const table = el("dl", "");
        for (const row of rows) {
          const keys = el("dd", "");
          for (const key of row.keys.slice(0, 2)) keys.append(el("kbd", "", { text: formatKey(key, win) }));
          const term = el("dt", "");
          const run = dom.button(`${PREFIX}-linkbutton`, { text: row.label, attributes: { "aria-disabled": row.enabled ? undefined : "true", title: row.reason || undefined } });
          run.addEventListener("click", () => { if (!row.enabled) { announce(row.reason); return; } closeSheetDialog(); runCommand(row.id); });
          term.append(run);
          table.append(term, keys);
        }
        section.append(el("h3", `${PREFIX}-section-title`, { text: group }), table);
        return section;
      }));
    };
    const closeSheetDialog = () => { dialog.remove(); sheetDialog = null; returnFocus?.focus?.({ preventScroll: true }); };
    sheetDialog = { close: closeSheetDialog };
    search.addEventListener("input", draw);
    close.addEventListener("click", closeSheetDialog);
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeSheetDialog(); return; }
      if (event.key === "Tab") {
        const focusable = [...dialog.querySelectorAll("button, input")].filter((node) => !node.disabled);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      event.stopPropagation();
    });
    draw();
    root.append(dialog);
    search.focus();
    return true;
  }

  // ---- the keyboard -------------------------------------------------------------------------------------------------------------------------
  function focusArea(target) {
    if (!target || target === doc.body || target === root) return "body";
    if (target.closest?.(".cm-editor") || shell.sourceArea.contains(target)) return "source";
    if (target.closest?.(`[role=dialog], dialog, .${PREFIX}-dialog`)) return "dialog";
    if (target.closest?.("[role=menu]")) return "menu";
    if (ctx.slots.slides?.contains(target)) return "filmstrip";
    if (shell.layersHost.contains(target)) return "layers";
    if (shell.viewport.contains(target)) return "canvas";
    if (shell.layoutsArea.contains(target)) return "layouts";
    return "chrome";
  }
  function onKey(event) {
    if (destroyed || isHandled(event) || event.defaultPrevented || event.isComposing) return;
    const area = focusArea(event.target);
    // The source split toggles from anywhere, the source pane included.
    if (matchKey(event, "Ctrl-`") && commands.enabled("studio.source.toggle", s)) { event.preventDefault(); markHandled(event); runCommand("studio.source.toggle"); return; }
    if (["source", "dialog", "menu", "layouts"].includes(area) || isTypingTarget(event.target)) return;
    if (layout !== "studio") {
      // The Playground keeps the global commands (zoom aside), so undo, Present and the sheet work as they do in the Studio.
      if (commands.handle(event, s, { scope: "global" })) return;
      return;
    }
    const onSlide = area === "canvas" || area === "layers" || area === "body" || area === "filmstrip";
    if (event.key === "Escape" && onSlide && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      markHandled(event);
      if (menu) { menu.close(); return; }
      if (canvasView.dragging) { canvasView.cancelDrag(); return; }
      if (canvasView.tool !== "select") { s.setTool("select"); return; }
      if (!shell.dataDock.hidden && shell.dataDock.contains(event.target)) { shell.dataDock.hidden = true; return; }
      s.selectParent();
      if (area === "canvas" || area === "body") canvasView.focusPrimary();
      return;
    }
    if (area === "canvas" || area === "body") {
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && s.textTarget() && !s.readOnly) { event.preventDefault(); markHandled(event); s.editText(); return; }
      if ((event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) {
        event.preventDefault();
        markHandled(event);
        const box = (canvasView.boxOf(selection.primary) ?? shell.frame).getBoundingClientRect();
        s.openContextMenu({ x: box.left + Math.min(40, box.width / 2), y: box.top + Math.min(40, box.height / 2) });
        return;
      }
    }
    if (onSlide && commands.handle(event, s, { scope: "canvas" })) return;
    if (commands.handle(event, s, { scope: "global" })) return;
    // A key of a command that is off says why (read-only, fonts loading, nothing to paste), without taking the key.
    if (isTypingTarget(event.target)) return;
    const scopes = onSlide ? ["canvas", "global"] : ["global"];
    for (const entry of commands.list(s, { win })) {
      if (entry.enabled || !entry.reason || entry.group === "Selection") continue;
      const command = commands.get(entry.id);
      if (!scopes.some((scope) => [].concat(command.scope ?? "global").includes(scope))) continue;
      if (entry.keys.some((key) => matchKey(event, key))) { announce(entry.reason); break; }
    }
  }
  listen(root, "keydown", onKey);
  // The filmstrip: Enter adds a slide after the focused one with its layout (PowerPoint); the slide manager keeps its other keys.
  if (ctx.slots.slides) {
    listen(ctx.slots.slides, "keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || layout !== "studio") return;
      const card = event.target.closest?.(".slide-card");
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();
      markHandled(event);
      const index = Number(card.dataset.index);
      const slide = ui.get(`/slides/${index}`);
      if (s.readOnly) { announce("This editor is read-only."); return; }
      s.newSlide(typeof slide?.layout === "string" ? slide.layout : undefined, index + 1);
      win.requestAnimationFrame?.(() => ctx.slots.slides.querySelector(`.slide-card[data-index="${index + 1}"]`)?.focus());
    }, true);
  }

  // ---- the bar --------------------------------------------------------------------------------------------------------------------------
  listen(shell.file, "click", () => fileMenu());
  listen(shell.insert, "click", () => s.openInsertMenu(shell.insert));
  listen(shell.addSlide, "click", () => s.openSlideMenu(shell.addSlide));
  listen(shell.zoom, "click", () => zoomMenu());
  listen(shell.source, "click", () => runCommand("studio.source.toggle"));
  listen(shell.openStudio, "click", () => s.setLayout("studio"));
  for (const [id, button] of Object.entries(shell.toolButtons)) listen(button, "click", () => runCommand(`studio.tool.${id}`));
  for (const [id, button] of Object.entries(shell.viewButtons)) listen(button, "click", () => setPlaygroundView(id));
  listen(shell.zoomOut, "click", () => runCommand("studio.zoom.out"));
  listen(shell.zoomIn, "click", () => runCommand("studio.zoom.in"));
  listen(shell.zoomFit, "click", () => runCommand("studio.zoom.fit"));
  listen(shell.validity, "click", () => {
    if (!ctx.inSync() && ctx.pane) { if (sourceMode === "off") s.toggleSource(); ctx.pane.editor?.api?.focus?.(); return; }
    if (shell.tabs.review) { if (root.dataset.width === "narrow") openSheet("review"); else showTab("review", { focus: true }); }
  });
  // The name: the presentation's `name`, one undoable change (the source pane keeps its own file name).
  const deckName = () => { const value = ui.get("/name"); return typeof value === "string" ? value : ""; };
  listen(shell.name, "change", () => {
    const value = shell.name.value.trim();
    if (value === deckName()) return;
    if (s.writeValue("/name", value || undefined, value ? `Renamed to ${value}` : "Name removed")) return;
    shell.name.value = deckName();
  });
  listen(shell.name, "keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); shell.name.blur(); } if (event.key === "Escape") { shell.name.value = deckName(); shell.name.blur(); } });
  function syncBar() {
    const list = commands.list(s, { win });
    const state = (id) => list.find((entry) => entry.id === id);
    const insertState = STUDIO_INSERT_KINDS.some((kind) => state(`studio.insert.${kind}`)?.enabled);
    shell.insert.disabled = !insertState;
    shell.insert.title = insertState ? "Insert a block" : state("studio.insert.text")?.reason ?? "";
    const slideState = state("studio.slide.new");
    shell.addSlide.disabled = !slideState?.enabled;
    shell.addSlide.title = slideState?.enabled ? "Add a slide" : slideState?.reason ?? "";
    if (doc.activeElement !== shell.name) shell.name.value = deckName();
    shell.name.readOnly = s.readOnly;
  }

  // ---- the status line ----------------------------------------------------------------------------------------------------------------
  function syncStatus() {
    const slides = adapter.slides();
    shell.counter.textContent = `Slide ${ctx.slideIndex() + 1} of ${slides.length}`;
    shell.format.textContent = (ctx.pane?.getFormat?.() ?? "json").toUpperCase().replace("MD", "Markdown");
    const findings = session.validation?.findings?.filter((finding) => finding.severity === "error" || finding.severity === "warning").length ?? 0;
    const text = !ctx.inSync() ? "Source has errors" : findings ? plural(findings, "finding") : "Valid";
    const label = shell.validity.querySelector(`.${PREFIX}-button-text`);
    if (label) label.textContent = text;
    shell.validity.dataset.state = !ctx.inSync() ? "error" : findings ? "findings" : "valid";
    shell.validity.setAttribute("aria-label", `${text}. ${!ctx.inSync() ? "Go to the source." : "Open Review."}`);
  }

  // ---- the touch action bar --------------------------------------------------------------------------------------------------------------
  const actionButtons = [["studio.duplicate", "Duplicate", "Copy"], ["studio.delete", "Delete", "Trash2"], ["studio.group", "Group", "Group"], ["studio.move.earlier", "Move up", "ArrowUp"], ["studio.move.later", "Move down", "ArrowDown"]].map(([id, label, icon]) => {
    const button = dom.button(`${PREFIX}-iconbutton`, { label, iconName: icon, size: 18, attributes: { "data-command": id } });
    button.addEventListener("click", () => runCommand(id));
    shell.actionbar.append(button);
    return { id, button };
  });
  function syncActionBar() {
    const coarse = root.dataset.density === "touch" || win.matchMedia?.("(pointer: coarse)").matches;
    const nodes = s.selectedNodes();
    const show = coarse && layout === "studio" && nodes.length && nodes.every((node) => node.kind === "block" || node.kind === "group" || node.kind === "implicit");
    shell.actionbar.hidden = !show;
    if (!show) return;
    for (const { id, button } of actionButtons) { const verdict = s.commandState(id); button.disabled = !verdict.enabled; button.title = verdict.reason || button.getAttribute("aria-label"); }
    // 8px above the primary box, inside the canvas area.
    const box = canvasView.boxOf(selection.primary)?.getBoundingClientRect();
    const area = shell.canvasArea.getBoundingClientRect();
    if (!box) return;
    const width = shell.actionbar.offsetWidth || 240, height = shell.actionbar.offsetHeight || 52;
    shell.actionbar.style.left = `${Math.max(8, Math.min(area.width - width - 8, box.left - area.left + box.width / 2 - width / 2))}px`;
    shell.actionbar.style.top = `${Math.max(8, box.top - area.top - height - 8)}px`;
  }

  // ---- lazy filmstrip thumbnails --------------------------------------------------------------------------------------------------------------
  const intersect = typeof win.IntersectionObserver === "function" && ctx.slots.slides ? new win.IntersectionObserver((entries) => {
    const wanted = entries.filter((entry) => entry.isIntersecting).map((entry) => Number(entry.target.closest(".slide-card")?.dataset.index)).filter(Number.isInteger);
    if (!wanted.length) return;
    fillThumbnails(wanted);
  }, { root: ctx.slots.slides.closest(`.${PREFIX}-slides`) ?? null, rootMargin: "200px 0px" }) : null;
  cleanups.push(() => intersect?.disconnect());
  function fillThumbnails(indices) {
    const deck = session.snapshot().presentation;
    try { ctx.thumbnailCache?.prepare(deck, indices); } catch { return; }
    for (const index of indices) {
      const card = ctx.slots.slides.querySelector(`.slide-card[data-index="${index}"] .thumbnail`);
      if (!card || card.dataset.filled === "true") continue;
      const html = ctx.thumbnailCache?.peek?.(deck, index);
      if (html === undefined) continue;
      card.innerHTML = html;
      card.querySelectorAll("[tabindex]").forEach((node) => node.removeAttribute("tabindex"));
      card.dataset.filled = "true";
    }
  }
  function observeThumbnails() {
    if (!intersect) return;
    intersect.disconnect();
    for (const thumb of ctx.slots.slides.querySelectorAll(".slide-card .thumbnail")) {
      if (thumb.childElementCount || thumb.textContent) { thumb.dataset.filled = "true"; continue; }
      intersect.observe(thumb);
    }
  }

  // ---- following the session, the canvas and the workspace ----------------------------------------------------------------------------------
  cleanups.push(ctx.on("render", (event) => {
    lastRender = { presentation: event.draft ? event.presentation : session.snapshot().presentation, slideIndex: event.slideIndex, geometry: event.geometry };
    if (event.slideIndex !== adapter.slideIndex) adapter.setSlide(event.slideIndex);
    syncAspect();
    reconcile();
    if (!event.draft) layers.render();
    paint();
  }));
  cleanups.push(ctx.on("sync", () => {
    if (adapter.slideIndex !== ctx.slideIndex()) adapter.setSlide(ctx.slideIndex());
    observeThumbnails();
    design.refresh();
    syncStatus();
    syncBar();
  }));
  cleanups.push(ctx.on("slide", ({ index }) => {
    adapter.setSlide(index);
    if (!revealing) setSelection([adapter.slides()[index]?.key].filter(Boolean), { source: "slide" });
    layers.render();
  }));
  for (const name of ["commit", "cancel"]) {
    cleanups.push(ctx.on(name, () => {
      root.dataset.editing = s.editingText() ? "true" : "false";
      if (!s.editingText() && (shell.frame.contains(doc.activeElement) || doc.activeElement === doc.body)) canvasView.focusPrimary();
    }));
  }
  cleanups.push(ctx.on("source", () => { syncStatus(); design.refresh(); }));
  cleanups.push(session.subscribe((event) => {
    if (event.type === "catalogs") return;
    // Keys that are gone fall back to their nearest surviving ancestor (an edit by the source pane, another tool or undo).
    win.queueMicrotask?.(() => { if (!destroyed) { reconcile(); syncStatus(); syncBar(); } });
  }));
  function reconcile() {
    const items = selection.items;
    if (!items.length) return;
    const s0 = scene();
    const kept = [];
    for (const key of items) {
      if (isSlideKey(key) ? adapter.slides().some((entry) => entry.key === key) : s0.node(key)) { kept.push(key); continue; }
      const survivor = isSlideKey(key) ? s0.slideKey : s0.survivor(key) ?? s0.slideKey;
      if (survivor && !kept.includes(survivor)) kept.push(survivor);
    }
    const parents = new Set(kept.map((key) => s0.node(key)?.parent ?? null));
    const next = parents.size > 1 ? [kept.at(-1)] : kept;
    if (next.length !== items.length || next.some((key, at) => key !== items[at])) { selection.replace(next); selectionChanged("edit", { quiet: false }); }
  }

  // ---- start ------------------------------------------------------------------------------------------------------------------------
  applyPreset();
  syncWidth();
  s.onZoom(canvasView.zoom);
  setSelection([scene().slideKey], { source: "init" });
  layers.render();
  // The deck gets ids once when the Studio opens a document without them (one undoable change, "Add ids"), so keys survive reorders.
  if (layout === "studio" && config.assignIds !== false && !s.readOnly) {
    try { if (adapter.ensureIds()) setSelection([scene().slideKey], { source: "init" }); } catch { /* a deck that refuses ids keeps index keys */ }
  }

  Object.defineProperty(s, "zoom", { get: () => canvasView.zoom, enumerable: true });
  Object.assign(s, {
    commands: {
      list: () => commands.list(s, { win }),
      run: (id) => runCommand(id),
      register: (command) => commands.register(command),
    },
    focusCanvas: () => canvasView.focusPrimary(),
    refresh() { paint(); layers.render(); design.refresh(); },
    paint,
    adapter,
    destroy() {
      destroyed = true;
      menu?.close({ restore: false });
      sheetDialog?.close();
      for (const stop of cleanups.splice(0).reverse()) { try { stop(); } catch { /* gone */ } }
      dataGrid?.destroy();
      canvasView.destroy();
      layers.destroy();
      design.destroy();
      adapter.destroy();
      fileInput?.remove();
    },
  });
  return s;
}
