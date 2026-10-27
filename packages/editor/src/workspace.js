// CE-06: the embeddable editor. `createOpfEditor(element, options)` mounts the editor's components (the source pane, the canvas, the slide row,
// the presenter, the export menu, the sorter, the outline, Layout Studio, the Review and Design panels, Find and the autosave) over ONE editor
// session and the ONE fonts handle, wires them to each other, and hands back a small handle. It is the glue the playground and the sites wrote
// by hand, promoted: the font gate before every draw, one slide index, commit-before-navigate, the source verdict, the lifecycle of the fonts
// lease and of every listener, and the order in which the parts hear a change.
//
// A host picks a layout: `"full"` (a bar, the source, the slide, the slide row and a side panel are built for it), `"canvas"`, `"source"`,
// or `slots`, an object of its own elements, one per part, for a host that arranges the page itself. Each part is optional (`panels`).
// Nothing here fetches anything, stores anything on its own or talks to a service; the host supplies fonts, catalogs and storage.
import { OPFEditorError, createEditorSession, mergeCatalogs } from "./index.js";
import { whenFontsReady } from "./font-gate.js";
import { createSourcePane } from "./source-pane.js";
import { createPersistence } from "./persistence.js";
import { createPersistenceUi } from "./persistence-ui.js";
import { buildWorkspaceShell } from "./workspace-shell.js";
import { fontSubstitutionNotes, layoutOptionsFor } from "./workspace-measure.js";
import { SOURCE_CHECKS, copyText, downloadSourceFile, lf, reportSource } from "./workspace-source.js";
import { createThemeController } from "./workspace-theme.js";
import { retainedSlideIndex } from "./slide-retention.js";
import { createSourceMemory, updateJsonSource } from "./exact-source.js";

export { THEME_TOKENS, createThemeController, normalizeTheme, normalizeThemeTokens } from "./workspace-theme.js";
// The script-aware measurement options for composing one slide: a host that calls `composeSlide` or `paginateSlide` on the session passes these (the playground does).
export { layoutOptionsFor } from "./workspace-measure.js";

// The slide and everything around it (the renderer, the canvas, the slide row, the presenter, Export, Review, Find, Design and the views) load
// on demand, in one chunk (`workspace-parts.js`): a host that mounts only the source pane never loads the renderer. Its factories are bound
// here once the chunk has arrived, before any part is mounted.
let toSvg, createCanvasEditor, createSlideNavigator, createThumbnailStrip, createThumbnailCache, createSlideManager, createOutlineView, createExportMenu;
let bindPresentShortcut, createPresentButton, createPresenter, createReviewPanel, createFindPanel, installFindShortcuts, createDesignControls;
let prepareDimensionSwitch, mergeSlides, splitSlideByBlocks, installCanvasVariableEditing, createLayoutStudio, buildStudioShell, createStudio;
let partsModule;
let partsLoaded = false;
function loadParts() {
  partsModule ??= import("./workspace-parts.js").then((parts) => {
    ({ toSvg, createCanvasEditor, createSlideNavigator, createThumbnailStrip, createThumbnailCache, createSlideManager, createOutlineView, createExportMenu } = parts);
    ({ bindPresentShortcut, createPresentButton, createPresenter, createReviewPanel, createFindPanel, installFindShortcuts, createDesignControls } = parts);
    ({ prepareDimensionSwitch, mergeSlides, splitSlideByBlocks, installCanvasVariableEditing, createLayoutStudio, buildStudioShell, createStudio } = parts);
    partsLoaded = true;
  });
  // A chunk that failed to load is asked for again by the next editor.
  partsModule.catch(() => {
    partsModule = undefined;
  });
  return partsModule;
}
/**
 * Whether the parts to mount need the slide chunk: any part but the source pane, its autosave and the history buttons, that has an element to
 * mount in (the presenter mounts in the overlay).
 */
const SOURCE_ONLY_PARTS = new Set(["source", "persistence", "history"]);
const needsSlideParts = (parts, slots) => Object.entries(parts).some(([name, on]) => on && !SOURCE_ONLY_PARTS.has(name) && (name === "present" || Boolean(slots[name])));

const VIEWS = Object.freeze(["slide", "sorter", "outline", "layouts"]);
const MUTATORS = new Set(["set", "setGroupComposition", "setCatalog", "setCatalogs", "applyPatch", "replaceDocument", "restoreState", "undo", "redo", "setComposition", "paginateSlide"]);
const STARTER = Object.freeze({ name: "Untitled presentation", slides: [{ id: "slide-1", title: "Untitled slide" }] });
const MESSAGES = Object.freeze({
  ready: "Ready to edit",
  loadingFonts: "Loading fonts…",
  views: {
    slide: "Slide view",
    sorter: "Slide sorter: drag slides, or use Alt and the arrow keys, to reorder",
    outline: "Outline: edit titles and text as an outline",
    layouts: "Layouts: build a layout from regions and splits, then save it to this presentation",
  },
});
const PART_NAMES = ["source", "navigator", "thumbnails", "history", "find", "present", "export", "review", "design", "layouts", "sorter", "outline", "slides", "persistence"];
const LAYOUT_PARTS = {
  full: { source: true, navigator: true, thumbnails: true, history: true, find: true, present: true, export: true, review: true, layouts: true, sorter: true, outline: true },
  canvas: { navigator: true, thumbnails: true, history: true },
  source: { source: true },
  // CE-20: the Studio and its Playground preset arrange the same parts; the Studio mounts its own Design panel.
  studio: { source: true, navigator: true, thumbnails: true, history: true, find: true, present: true, export: true, review: true, layouts: true, slides: true },
  playground: { source: true, navigator: true, thumbnails: true, history: true, find: true, present: true, export: true, review: true, layouts: true, slides: true },
};
const STUDIO_LAYOUTS = new Set(["studio", "playground"]);

const isThenable = (value) => value !== null && typeof value === "object" && typeof value.then === "function";

/**
 * Normalize the `fonts` option: a fonts handle, a lease `{ fonts, release() }` (what a host's own acquire function returns), a promise of either, a
 * function that returns any of those, or `{ lease(), release(handle) }`. `use(resolved)` turns what arrived into the handle to draw with and the
 * function that gives it back.
 */
function fontsSource(spec) {
  const unwrap = (resolved, release) => {
    if (resolved && typeof resolved === "object" && resolved.fonts && typeof resolved.release === "function") return { fonts: resolved.fonts, release: () => resolved.release() };
    return { fonts: resolved, release: release ? () => release(resolved) : undefined };
  };
  if (spec === undefined || spec === null) return { value: undefined, use: (resolved) => unwrap(resolved) };
  if (typeof spec === "function") return { value: spec(), use: (resolved) => unwrap(resolved) };
  if (typeof spec === "object" && typeof spec.lease === "function") {
    const release = typeof spec.release === "function" ? (handle) => spec.release(handle) : undefined;
    return { value: spec.lease(), use: (resolved) => unwrap(resolved, release) };
  }
  return { value: spec, use: (resolved) => unwrap(resolved) };
}

/** The session with its writes refused while the editor is read-only; everything else is the session itself. */
function guardSession(session, isReadOnly) {
  return new Proxy(session, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      if (!MUTATORS.has(property)) return value.bind(target);
      return (...args) => {
        if (isReadOnly()) throw new OPFEditorError("read-only", "This editor is read-only.");
        return value.apply(target, args);
      };
    },
  });
}

function resolveParts(options, layout, slots) {
  const panels = options.panels ?? {};
  const base = LAYOUT_PARTS[layout];
  const parts = {};
  for (const name of PART_NAMES) {
    if (name === "persistence") parts[name] = Boolean(options.persistence) && panels[name] !== false;
    else if (panels[name] !== undefined) parts[name] = Boolean(panels[name]);
    else parts[name] = base ? Boolean(base[name]) : Boolean(slots[name]);
  }
  // The slide is the editor; a source-only layout has none.
  parts.canvas = layout === "source" ? false : panels.canvas !== false;
  return parts;
}

/**
 * Mount the editor in `element`. Returns the handle at once; the parts mount once a `fonts` promise has resolved and, for a layout that shows
 * slides, once the slide chunk has loaded (`mounted` is emitted then, and `ready` settles after the first update). A source-only editor whose
 * fonts are at hand mounts before this returns.
 * See `workspace.d.ts` for the options and the handle.
 */
export function createOpfEditor(element, options = {}) {
  if (!element || element.nodeType !== 1 || !element.ownerDocument) throw new TypeError("createOpfEditor needs a DOM element to mount in.");
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  const listeners = new Map();
  const cleanups = [];
  let destroyed = false;
  let mounted = false;
  let readOnly = Boolean(options.readOnly);
  let lastError;

  // ---- events -----------------------------------------------------------------------------------------------------------------
  function off(name, listener) {
    listeners.get(name)?.delete(listener);
  }
  function on(name, listener) {
    if (typeof listener !== "function") throw new TypeError("An editor listener must be a function.");
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(listener);
    return () => off(name, listener);
  }
  function emit(name, detail = {}) {
    for (const listener of [...(listeners.get(name) ?? [])]) {
      try {
        listener(detail);
      } catch (error) {
        if (name === "error") globalThis.console?.error?.(error);
        else report(error);
      }
    }
  }
  function report(error, detail = {}) {
    const value = error instanceof Error ? error : new Error(String(error));
    lastError = value;
    emit("error", { error: value, message: value.message, ...detail });
  }
  for (const [name, listener] of Object.entries(options.on ?? {})) on(name, listener);
  if (options.onChange) on("change", options.onChange);
  if (options.onSelection) on("selection", options.onSelection);
  if (options.onCursor) on("cursor", options.onCursor);
  if (options.onError) on("error", ({ error, ...detail }) => options.onError(error, detail));
  if (options.onReady) on("ready", options.onReady);

  // ---- the session ------------------------------------------------------------------------------------------------------------
  const startText = typeof options.document === "string" ? options.document : undefined;
  const session = options.session ?? createEditorSession(options.document ?? STARTER, { rejectInvalid: true, catalogs: options.catalogs });
  const ui = guardSession(session, () => readOnly);
  const hostCatalogs = options.catalogs;
  const catalogs = () => mergeCatalogs(session.catalogs, hostCatalogs);

  // ---- layout, parts and slots ------------------------------------------------------------------------------------------------
  const given = options.slots ?? {};
  const layout = options.slots && !STUDIO_LAYOUTS.has(options.layout) ? "slots" : (options.layout ?? "full");
  if (!["full", "canvas", "source", "slots", "studio", "playground"].includes(layout)) throw new RangeError('layout must be "full", "canvas", "source", "studio" or "playground", or pass `slots`.');
  const studioLayout = STUDIO_LAYOUTS.has(layout);
  const parts = resolveParts(options, layout, given);
  const views = VIEWS.filter((view) => view === "slide" || parts[view]);
  if (options.view !== undefined && !views.includes(options.view)) throw new RangeError(`view "${options.view}" is not available in this layout (${views.join(", ")}).`);
  if (options.persistence && parts.persistence && (typeof options.persistence !== "object" || typeof options.persistence.key !== "string" || !options.persistence.key)) {
    throw new TypeError("persistence needs a `key` that names the document.");
  }

  const root = doc.createElement("div");
  root.className = "opf-workspace opf-ui";
  // The editor owns the content of the element it builds a layout in. With `slots` the element is the host's own page (it holds the slots), so the
  // editor only adds one empty node for its overlays.
  if (options.slots) element.append(root);
  else element.replaceChildren(root);
  const themeController = createThemeController(element, options.theme);
  let slots = { ...given };
  let controls = {};
  let studioShell = null;
  let overlay = root;
  // CE-20: the Studio builds its own shell; a host's slots add parts to it (`topbarEnd`, `overlay`). Its code is in the slide chunk, so the Studio
  // shell is built once that has loaded, right before the parts mount.
  function buildStudio() {
    const built = buildStudioShell(root, { parts, layout, labels: options.labels, studio: options.studio, slots: given });
    const { topbarEnd: _placed, ...rest } = given;
    slots = { ...built.slots, ...rest };
    controls = built.controls;
    studioShell = built.shell;
    overlay = slots.overlay ?? root;
  }
  if (layout === "slots") root.setAttribute("data-opf-layout", "slots");
  else if (!studioLayout) {
    const built = buildWorkspaceShell(root, { parts, views, layout, labels: options.labels });
    slots = { ...built.slots, ...given };
    controls = built.controls;
  }
  overlay = slots.overlay ?? root;
  // The slide chunk is loaded before the parts mount, unless only the source pane (with its autosave) is mounted. The Studio always needs it.
  const slideParts = studioLayout || needsSlideParts(parts, slots);

  // ---- state ------------------------------------------------------------------------------------------------------------------
  let fonts;
  let canvas;
  let pane;
  let slideNav;
  let strip;
  let slideManager;
  let sorter;
  let outline;
  let studio;
  let studioCtl;
  let fontsPending = false;
  let presenter;
  let presentButton;
  let exportMenu;
  let review;
  let find;
  let design;
  let persistence;
  let persistenceUi;
  let thumbnailCache;
  let unbindKeys;
  let checking;
  let slideIndex = Math.max(0, Number(options.slideIndex) || 0);
  let activeView = "slide";
  let selection = null;
  let slides = [];
  let authoredTemplate = false;
  let draftInvalid = false;
  let inSync = true;
  let reportedText = "";
  let drafting = false;
  let openedText;
  let sourceState = null;
  let sourceCursor = null;
  let fontsFailure;
  let refreshToken = 0;
  let lastRefresh = Promise.resolve();
  let geometrySize = null;
  let statusText = "";
  let density = "comfortable";
  let exportMode = "menu";
  // The parts are bound once the slide chunk has arrived and the fonts are at hand; `partsReady` is true from then on. A call on the handle made
  // before that (a React host's effects run right after `createOpfEditor` returns) must neither reach a factory that is not bound yet nor be lost:
  // a setting is remembered in `requested` and read when the parts mount; a call that acts on a mounted part waits in `queued` and runs, in order,
  // once the editor is mounted (a later call with the same key replaces the earlier one).
  let partsReady = false;
  const requested = {};
  const queued = [];
  const waiting = () => !mounted && !destroyed;
  const queue = (key, task) => {
    const at = queued.findIndex((entry) => entry.key === key);
    if (at >= 0) queued.splice(at, 1);
    const entry = { key, task };
    queued.push(entry);
    return entry;
  };
  function flushQueued() {
    for (const { task } of queued.splice(0)) {
      if (destroyed) return;
      try {
        task();
      } catch (error) {
        report(error);
      }
    }
  }
  let frameSize = { width: 0, height: 0 };
  const draftMemory = createSourceMemory();
  const variablesMode = options.variables === "resolved" ? "resolved" : "authored";
  const fitMode = studioLayout ? false : options.fit === undefined ? (layout === "slots" ? false : "contain") : options.fit;

  const say = (message) => {
    statusText = message;
    if (slots.status) slots.status.textContent = message;
    emit("status", { message });
  };
  const densityFor = (setting) => (setting === "touch" || setting === "comfortable" ? setting : win?.matchMedia?.("(pointer: coarse)").matches ? "touch" : "comfortable");
  const exportModeFor = (setting) => (setting === "sheet" || setting === "menu" ? setting : win?.matchMedia?.("(max-width: 900px)").matches ? "sheet" : "menu");

  // The options a draw uses: the host's, the image hook, and the registered catalogs. `variables` follow the document in "resolved" mode.
  function renderOptions() {
    const out = { ...(options.renderOptions ?? {}), catalogs: catalogs() };
    if (options.imageResolver) out.imageResolver = options.imageResolver;
    if (variablesMode === "resolved") out.variables = authoredTemplate ? false : {};
    return out;
  }
  const layoutFor = (deck, index) => layoutOptionsFor(fonts, deck, index, catalogs());

  // ---- navigation and the refresh loop ----------------------------------------------------------------------------------------
  function renderViews(deck) {
    // The Studio's filmstrip draws the thumbnails it shows itself, as they scroll in.
    if (!studioLayout) thumbnailCache?.prepare(deck);
    slideManager?.render();
    if (activeView === "sorter") sorter?.render();
    if (activeView === "outline") outline?.render();
  }
  // The detail of a `sync` event. Geometry and diagnostics compose the slide, so they are worked out only when a listener asks.
  function syncDetail(deck) {
    let geometry;
    let diagnostics;
    const compute = () => {
      geometry ??= session.composeSlide(slideIndex, layoutFor(deck, slideIndex));
      return geometry;
    };
    return {
      presentation: deck,
      slideIndex,
      count: deck.slides.length,
      get geometry() {
        return compute();
      },
      get diagnostics() {
        diagnostics ??= [...compute().diagnostics, ...fontSubstitutionNotes(fonts)];
        return diagnostics;
      },
    };
  }
  function sync() {
    fonts?.registry?.clearSubstitutions?.();
    // The frozen snapshot (one object per version): the session's `presentation` copies the whole deck on every read.
    const deck = session.snapshot().presentation;
    slideIndex = Math.max(0, Math.min(slideIndex, deck.slides.length - 1));
    renderViews(deck);
    slideNav?.setSlide(slideIndex);
    strip?.setSlide(slideIndex);
    fonts?.registry?.clearSubstitutions?.();
    if (canvas && canvas.slideIndex !== slideIndex) canvas.setSlide(slideIndex);
    emit("sync", syncDetail(deck));
    review?.schedule();
    design?.refresh();
  }
  // The one "ensure fonts, then update" path: every document change and every slide change goes through whenFontsReady, so nothing outside
  // the canvas (which gates its own draws with the same handle) measures a document whose faces are still loading.
  function refresh() {
    if (!mounted || destroyed) return Promise.resolve();
    const token = ++refreshToken;
    let loaded = false;
    lastRefresh = whenFontsReady(fonts, session.snapshot().presentation, {
      renderOptions: renderOptions(),
      isCurrent: () => token === refreshToken && !destroyed,
      loading: () => {
        loaded = true;
        fontsPending = true;
        emit("fonts", { state: "loading" });
        say(MESSAGES.loadingFonts);
      },
      ready: () => {
        fontsFailure = undefined;
        fontsPending = false;
        if (loaded) {
          thumbnailCache?.clear();
          emit("fonts", { state: "ready" });
          if (/Loading fonts/.test(statusText)) say(MESSAGES.ready);
        }
        try {
          sync();
        } catch (error) {
          report(error);
        }
      },
      failed: (error) => {
        fontsFailure = error;
        emit("fonts", { state: "error", error });
        say(error.message);
        report(error);
      },
    });
    return lastRefresh;
  }
  function go(index) {
    if (!mounted || !canvas) {
      slideIndex = Math.max(0, index);
      return false;
    }
    try {
      if (canvas.setSlide(index)) {
        const changed = index !== slideIndex;
        slideIndex = index;
        slideNav?.setSlide(index);
        strip?.setSlide(index);
        if (changed) emit("slide", { index, count: slides.length });
        refresh();
        return true;
      }
    } catch (error) {
      report(error);
    }
    slideNav?.setSlide(canvas.slideIndex);
    strip?.setSlide(canvas.slideIndex);
    return false;
  }
  function goTo(index, path) {
    if (waiting()) {
      go(index);
      queue("goTo", () => goTo(index, path));
      return true;
    }
    if (index !== slideIndex && !go(index)) return false;
    if (studioCtl) studioCtl.revealPath(path ?? `slides.${index}`);
    else if (path) canvas?.reveal(path);
    return true;
  }

  // ---- chrome that follows the source verdict, the history and read-only ------------------------------------------------------
  const slideFrame = () => (slots.slide ?? slots.canvas?.closest?.(".opf-ws-frame") ?? slots.canvas);
  function syncChrome() {
    exportMenu?.setDisabled(!inSync);
    presentButton?.setDisabled(!inSync || slides.length === 0);
    if (controls.undo) controls.undo.disabled = !inSync || readOnly || !session.canUndo;
    if (controls.redo) controls.redo.disabled = !inSync || readOnly || !session.canRedo;
    // Text in the source pane that is not a valid deck: the slide shows the last valid one and is not editable until the text is fixed.
    const frame = slots.canvas && (slots.slide ?? slots.canvas);
    // The Studio keeps selection, zoom and Present while read-only (its commands say why they are off); only invalid text locks the slide.
    if (frame && (!inSync || (readOnly && !studioLayout))) frame.setAttribute("inert", "");
    else frame?.removeAttribute("inert");
  }
  function applyFit() {
    if (!fitMode || !slots.canvas) return;
    const { width, height } = frameSize;
    if (geometrySize && width > 0 && height > 0) {
      const scale = Math.min(width / geometrySize.width, height / geometrySize.height);
      slots.canvas.style.width = `${geometrySize.width * scale}px`;
      slots.canvas.style.height = `${geometrySize.height * scale}px`;
      slots.canvas.style.visibility = "";
    } else {
      slots.canvas.style.width = "0px";
      slots.canvas.style.height = "0px";
      slots.canvas.style.visibility = "hidden";
    }
  }

  // ---- views ------------------------------------------------------------------------------------------------------------------
  function slideManagerOptions() {
    return {
      editor: ui,
      getSlideIndex: () => slideIndex,
      setSlideIndex: (index) => {
        go(index);
      },
      // The Studio's filmstrip draws only the thumbnails it shows (an IntersectionObserver fills the rest as they scroll in).
      renderThumbnail: studioLayout ? (deck, index) => thumbnailCache.peek(deck, index) ?? "" : (deck, index) => thumbnailCache.html(deck, index),
      renderLayoutPreview: (deck, index, choice) => {
        const candidate = prepareDimensionSwitch(deck, "layouts", choice.id, { slideIndex: index, catalogs: catalogs() }).presentation;
        return toSvg(candidate, index + 1, { ...renderOptions(), fonts, text: "system", trace: false });
      },
      onStatus: say,
      onError: (error) => report(error),
      autoRender: false,
      contentActions: { splitSlideByBlocks, mergeSlides },
    };
  }
  function markView(view) {
    root.setAttribute("data-view", view);
    for (const [name, button] of Object.entries(controls.views ?? {})) button.setAttribute("aria-pressed", String(name === view));
  }
  function setView(view, { focus = false } = {}) {
    if (!views.includes(view)) return false;
    if (!mounted) {
      activeView = view;
      requested.view = view;
      return true;
    }
    if (view !== "slide" && canvas && !canvas.commit()) return false;
    const previous = activeView;
    activeView = view;
    if (view === "sorter" && !sorter && slots.sorter) sorter = createSlideManager(slots.sorter, { ...slideManagerOptions(), variant: "sorter" });
    if (view === "outline" && !outline && slots.outline) {
      outline = createOutlineView(slots.outline, {
        editor: ui,
        getSlideIndex: () => slideIndex,
        onSelectSlide: (index) => {
          if (index !== slideIndex) go(index);
        },
        onStatus: say,
      });
    }
    if (view === "layouts" && !studio && slots.layouts) {
      studio = createLayoutStudio(slots.layouts, { session: ui, toSvg, fonts, renderOptions, getSlideIndex: () => slideIndex, onStatus: say, density, readOnly });
    }
    if (view === "layouts") studio?.refresh();
    const frame = slideFrame();
    if (frame) frame.hidden = view !== "slide";
    // `slots.sorterView` (and the like) name the element that is hidden when the view is not shown, when it is not the element the view mounts in.
    for (const name of ["sorter", "outline", "layouts"]) {
      const panel = slots[`${name}View`] ?? slots[name];
      if (panel) panel.hidden = view !== name;
    }
    markView(view);
    if (view === "sorter") {
      sorter?.render();
      if (focus) sorter?.focus(slideIndex);
    }
    if (view === "outline") {
      outline?.render();
      if (focus) outline?.focusSlide(slideIndex);
    }
    if (view === "slide" && canvas) canvas.setSlide(slideIndex);
    say(MESSAGES.views[view]);
    if (previous !== view) emit("view", { view, previous });
    return true;
  }
  function showPanel(name, focus = false) {
    if (!mounted) {
      // The tabs of the shell are known now, the Studio's when it mounts; the panel is shown after the default one.
      if (destroyed || (!studioLayout && !controls.tabs?.[name])) return false;
      queue("panel", () => showPanel(name, focus));
      return true;
    }
    return showPanelNow(name, focus);
  }
  function showPanelNow(name, focus = false) {
    if (studioCtl) return studioCtl.showTab(name, { focus });
    const tabs = controls.tabs;
    if (!tabs?.[name]) return false;
    for (const [tabName, tab] of Object.entries(tabs)) {
      const selected = tabName === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = doc.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    }
    if (focus) tabs[name].focus();
    emit("panel", { panel: name });
    return true;
  }

  // ---- the parts --------------------------------------------------------------------------------------------------------------
  function mountSlideRow() {
    // The row is built from the slide chunk's factories: before they are bound (and after destroy) there is nothing to rebuild; the first
    // mount reads the density and the layout as they are by then.
    if (!partsReady || destroyed) return;
    unbindKeys?.();
    slideNav?.destroy();
    strip?.destroy();
    slideNav = undefined;
    strip = undefined;
    // The Studio shows its filmstrip; the slide row is the Playground preset's, mounted only while that preset is on.
    if (studioLayout && (studioCtl?.layout ?? layout) !== "playground") return;
    if (parts.navigator && slots.navigator) {
      slideNav = createSlideNavigator(slots.navigator, {
        editor: ui,
        slideIndex,
        density,
        ...(options.labels?.navigator ? { labels: { navigation: options.labels.navigator } } : {}),
        onChange: (index) => {
          go(index);
        },
      });
      unbindKeys = slideNav.bindKeys(doc);
    }
    if (parts.thumbnails && slots.thumbnails) {
      strip = createThumbnailStrip(slots.thumbnails, {
        editor: ui,
        fonts,
        slideIndex,
        density,
        ...(options.labels?.thumbnails ? { labels: { navigation: options.labels.thumbnails } } : {}),
        renderOptions: renderOptions(),
        onSelect: (index) => {
          if (index !== slideIndex) go(index);
        },
        onError: (error) => report(error instanceof Error ? error : new Error("Thumbnails unavailable")),
      });
    }
  }

  function exportOptions() {
    const configured = options.export ?? {};
    return {
      ...configured,
      getDeck: () => session.presentation,
      // An open canvas edit is committed, and text typed a moment ago is applied, before the document is read; slide exports of a
      // document that turns out not to be valid wait for the fix.
      beforeExport: (kind) => {
        if (canvas?.commit() === false) return false;
        pane?.getText();
        return !(kind === "slides" && draftInvalid);
      },
      fonts,
      catalogs,
      renderOptions: { ...(configured.renderOptions ?? options.renderOptions ?? {}), ...(options.imageResolver ? { imageResolver: options.imageResolver } : {}) },
      onExport: (done) => {
        configured.onExport?.(done);
        emit("export", done);
        if (["json", "yaml", "markdown"].includes(done.format)) {
          persistence?.markSaved();
          emit("kept", { kind: "download" });
        }
      },
      onStatus: (value) => {
        configured.onStatus?.(value);
        if (value.state === "error") say(value.message);
      },
      handoffContainer: configured.handoffContainer ?? overlay,
      mode: exportMode,
      density,
    };
  }

  function paneOptions() {
    const configured = options.source ?? {};
    const text = configured.text ?? startText;
    return {
      ...(configured.outline !== undefined ? { outline: configured.outline } : {}),
      ...(configured.applyDelay !== undefined ? { applyDelay: configured.applyDelay } : {}),
      ...(configured.cursorDelay !== undefined ? { cursorDelay: configured.cursorDelay } : {}),
      ...(configured.completions !== undefined ? { completions: configured.completions } : {}),
      ...(configured.catalogs !== undefined ? { catalogs: configured.catalogs } : {}),
      ...((requested.name ?? configured.name) !== undefined ? { name: requested.name ?? configured.name } : {}),
      ...(text !== undefined ? { source: text } : {}),
      editor: ui,
      format: configured.format ?? "json",
      density,
      label: configured.label ?? "OPF source",
      readOnly,
      worker: configured.worker ?? false,
      resolvePreview: configured.resolvePreview,
      onRename: (name) => {
        configured.onRename?.(name);
        emit("rename", { name });
      },
      // CE-17: the path under the caret of the source pane, as `cursor` events.
      onCursor: (detail) => {
        sourceCursor = Object.freeze(detail);
        emit("cursor", sourceCursor);
      },
      getFindings: ({ format, text: shown }) => {
        reportedText = shown;
        const made = reportSource(format, shown, { catalogs: catalogs(), checks: configured.checks ?? SOURCE_CHECKS });
        draftInvalid = !made.valid;
        inSync = made.status.kind === "valid";
        sourceState = { status: made.status, format, text: shown };
        syncChrome();
        emit("source", sourceState);
        return made.findings;
      },
      onCopy: async (file) => {
        await (configured.onCopy ?? ((value) => copyText(value.text)))(file);
        emit("kept", { kind: "copy" });
      },
      onDownload: async (file) => {
        // A file the person opened and has not touched is written with its own bytes (its line endings included; the code editor holds LF).
        const original = file.format === "json" && openedText !== undefined && file.text === lf(openedText) ? openedText : undefined;
        await (configured.onDownload ?? ((value) => downloadSourceFile(value, original)))(original === undefined ? file : { ...file, text: original });
        emit("kept", { kind: "download" });
      },
      onError: (error) => report(error),
    };
  }

  // While the canvas holds an inline edit, the source shows the draft as it is typed, without touching the session.
  function showDraft(presentation) {
    if (!pane || pane.getFormat() !== "json") return;
    // Text typed in the source a moment ago is applied first, so its typing delay cannot fire while the draft is on show.
    if (!drafting) {
      pane.getText();
      drafting = true;
    }
    try {
      pane.editor.update(updateJsonSource(pane.editor.api.getValue(), presentation, draftMemory));
    } catch {
      /* the document stays as it was */
    }
  }

  function mountCanvas() {
    const configured = options.canvas ?? {};
    // Registered before the canvas, so it runs first: a source edit that reorders the slides keeps the slide the person was on (stable ids)
    // before the canvas draws the new document.
    cleanups.push(
      session.subscribe((event) => {
        const next = event.snapshot.presentation.slides ?? [];
        const before = slides;
        slides = next;
        // `slideRetention: "position"` keeps the position (the update clamps it to the deck) instead of following the slide's id.
        if (!canvas || event.type === "catalogs" || options.slideRetention === "position") return;
        const keep = retainedSlideIndex(before, next, canvas.slideIndex);
        if (keep !== canvas.slideIndex) {
          try {
            canvas.setSlide(keep);
          } catch {
            /* the canvas redraws its own slide */
          }
        }
      }),
    );
    canvas = createCanvasEditor(slots.canvas, {
      ...configured,
      ...(studioLayout ? { textEntry: layout === "playground" ? "click" : "dblclick", targets: layout === "playground" ? "interactive" : "passive", escape: "commit" } : {}),
      editor: ui,
      fonts,
      renderOptions: renderOptions(),
      slideIndex,
      ...(slots.properties ? { propertiesContainer: slots.properties } : {}),
      onFonts: (event) => {
        if (destroyed) return;
        if (event.state === "error") {
          fontsFailure = event.error;
          say(event.error.message);
        } else if (event.state === "loading") {
          fontsPending = true;
          say(MESSAGES.loadingFonts);
        }
        else if (fontsFailure) {
          fontsFailure = undefined;
          refresh();
        }
        if (event.state === "ready") fontsPending = false;
        emit("fonts", event);
        configured.onFonts?.(event);
      },
      onSelect: (value) => {
        selection = { path: value.path, value: value.value };
        // The Studio emits its own selection (a list of nodes); the canvas's single selection is internal there.
        if (!studioLayout) emit("selection", { path: value.path, value: value.value, slideIndex, element: value.element });
        design?.refresh();
        configured.onSelect?.(value);
      },
      onDraft: (value) => {
        if (destroyed) return;
        showDraft(value.presentation);
        emit("draft", value);
        configured.onDraft?.(value);
      },
      onCommit: (value) => {
        emit("commit", value);
        configured.onCommit?.(value);
      },
      onCancel: (value) => {
        if (destroyed) return;
        drafting = false;
        pane?.refresh();
        emit("cancel", value);
        configured.onCancel?.(value);
      },
      onError: (error) => {
        if (!destroyed) report(error);
        configured.onError?.(error);
      },
      onRender: (event) => {
        if (destroyed) return;
        geometrySize = { width: event.geometry.width, height: event.geometry.height };
        applyFit();
        emit("geometry", geometrySize);
        if (event.slideIndex !== slideIndex) {
          // The canvas moved to another slide itself (its slide was removed, say): the rest of the parts follow it.
          slideIndex = event.slideIndex;
          slideNav?.setSlide(slideIndex);
          strip?.setSlide(slideIndex);
          emit("slide", { index: slideIndex, count: slides.length });
          refresh();
        }
        emit("render", event);
        configured.onRender?.(event);
      },
    });
    if (variablesMode === "resolved") {
      cleanups.push(
        installCanvasVariableEditing(slots.canvas, ui, canvas, {
          resolved: () => !authoredTemplate,
          focusSource: () => pane?.editor?.api?.focus?.(),
        }),
      );
    }
  }

  function mountPersistence() {
    const configured = options.persistence;
    persistenceUi = createPersistenceUi({
      banner: slots.banner,
      indicator: slots.autosave,
      restoreEarlier: () => persistence.restoreEarlier(),
      suffix: configured.suffix ?? "Save an OPF file to keep a copy.",
      fallback: configured.fallback ?? "Changes stay in this session.\nSave an OPF file to keep your work.",
    });
    const { suffix, fallback, ...rest } = configured;
    persistence = createPersistence(ui, {
      ...rest,
      onRestorePrompt: configured.onRestorePrompt ?? persistenceUi.prompt,
      onStatus: (value) => {
        persistenceUi.status(value);
        configured.onStatus?.(value);
        emit("persistence", value);
      },
      beforeFlush: () => canvas?.commit(),
    });
  }

  function mountFind() {
    const configured = typeof options.find === "object" ? options.find : {};
    find = createFindPanel(slots.find, {
      editor: ui,
      canvas: () => canvas,
      getSlideIndex: () => slideIndex,
      goToSlide: (index) => {
        if (index === slideIndex) return undefined;
        go(index);
        return lastRefresh;
      },
      getSelectionText: () => {
        const active = doc.activeElement;
        if (active && /^(TEXTAREA|INPUT)$/.test(active.tagName) && active.selectionStart !== active.selectionEnd && !slots.find.contains(active)) {
          return active.value.slice(active.selectionStart, active.selectionEnd);
        }
        return win?.getSelection?.().toString() || undefined;
      },
      onGoTo: configured.onGoTo,
      onStatus: (message) => say(message),
      onClose() {
        controls.find?.setAttribute("aria-expanded", "false");
        slots.find.hidden = true;
      },
    });
    slots.find.hidden = true;
    const open = (openOptions) => {
      slots.find.hidden = false;
      controls.find?.setAttribute("aria-expanded", "true");
      find.open(openOptions);
    };
    find.openPanel = open;
    controls.find?.addEventListener("click", () => (find.isOpen ? find.close() : open({})));
    cleanups.push(
      installFindShortcuts({
        open,
        element: find.element,
        get isOpen() {
          return find.isOpen;
        },
      }),
    );
  }

  function mountReview() {
    const configured = typeof options.review === "object" ? options.review : {};
    const { hook, ...panelOptions } = configured;
    review = createReviewPanel(slots.review, {
      ...panelOptions,
      editor: ui,
      getSlideIndex: () => slideIndex,
      // The layout checks measure text with the fonts the canvas draws with, script-aware per slide.
      getValidateOptions: (deck) => (fonts?.textMeasurement ? { fonts: { textMeasurement: (index) => layoutFor(deck, index).fonts.textMeasurement } } : {}),
      // The workspace re-checks after it has redrawn, so the faces are loaded and the checks measure what the canvas shows.
      autoRefresh: false,
      ...(hook ? { review: hook } : {}),
      onGoTo: ({ finding, target }) => {
        if (target.slide === null) emit("review-goto", { finding, target });
        else goTo(target.slide, target.path);
        say(finding.message);
      },
      onFocusField: ({ fix, target }) => emit("review-focus", { fix, target }),
      onStatus: say,
      onChange: (counts) => {
        const tab = controls.tabs?.review ?? studioShell?.tabs.review?.tab;
        if (tab) {
          const name = options.labels?.review ?? "Review";
          const found = !counts.unavailable && counts.total;
          tab.textContent = found ? `${name} (${counts.total})` : name;
          tab.setAttribute("aria-label", found ? `${name}, ${counts.total} finding${counts.total === 1 ? "" : "s"}` : name);
        }
        emit("review", counts);
      },
    });
  }

  function present(from) {
    if (waiting() && parts.present) {
      queue("present", () => present(from));
      return true;
    }
    if (destroyed || !mounted || !presenter || presenter.isRunning() || !inSync || slides.length === 0) return false;
    // An open canvas edit is committed, and text typed a moment ago is applied, before the document is shown; a source that is not a valid deck waits.
    if (canvas?.commit() === false) return false;
    pane?.getText();
    if (draftInvalid) return false;
    void presenter.start(Number.isInteger(from) ? from : (canvas?.slideIndex ?? slideIndex));
    return true;
  }

  function mountParts() {
    slides = session.presentation.slides ?? [];
    authoredTemplate = session.presentation.template === true;
    if (parts.canvas && slots.canvas) mountCanvas();
    if (slideParts) thumbnailCache = createThumbnailCache({ toSvg, getOptions: () => ({ ...renderOptions(), fonts, text: "system", trace: false }) });
    mountSlideRow();
    if (parts.slides && slots.slides) slideManager = createSlideManager(slots.slides, { ...slideManagerOptions(), ...(slots.slideToolbar ? { toolbar: slots.slideToolbar } : {}) });
    if (parts.source && slots.source) {
      pane = createSourcePane(slots.source, paneOptions());
      checking = new MutationObserver(() => {
        if (!destroyed) emit("checking", { checking: pane.editor.api.getValue() !== reportedText });
      });
      checking.observe(pane.editor.view.dom, { subtree: true, childList: true, characterData: true });
    }
    if (parts.export && slots.export) exportMenu = createExportMenu(slots.export, exportOptions());
    if (parts.present) {
      presenter = createPresenter(overlay, {
        editor: ui,
        fonts,
        get renderOptions() {
          return renderOptions();
        },
        density,
        onExit: (index) => {
          if (!destroyed && index >= 0) go(index);
        },
      });
      if (slots.present) {
        presentButton = createPresentButton(slots.present, {
          variant: "quiet",
          onPresent: () => {
            present();
          },
          density,
        });
      }
      cleanups.push(
        bindPresentShortcut(doc, () => {
          present();
        }),
      );
    }
    if (parts.find && slots.find) mountFind();
    if (parts.review && slots.review) mountReview();
    if (parts.design && slots.design) {
      const configured = typeof options.design === "object" ? options.design : {};
      design = createDesignControls(slots.design, {
        ...configured,
        editor: ui,
        getSlideIndex: () => slideIndex,
        getSelectedPath: () => selection?.path,
        catalogs: hostCatalogs,
        ...(options.onAddAsset ? { onAddAsset: options.onAddAsset } : {}),
        onSelectPath: (path) => {
          canvas?.reveal(path);
        },
        onStatus: say,
      });
    }
    if (parts.persistence) mountPersistence();
    mountControls();
    mountEnvironment();
    if (studioShell && canvas) mountStudio();
    // These come last, so a host hears a change after every part has. The refresh runs for every event, the catalogs' included.
    cleanups.push(
      session.subscribe((event) => {
        if (event.type !== "catalogs") drafting = false;
        const template = event.snapshot.presentation.template === true;
        if (template !== authoredTemplate) {
          authoredTemplate = template;
          if (variablesMode === "resolved") canvas?.setRenderOptions(renderOptions());
          mountSlideRow();
        }
        if (event.type !== "catalogs") {
          syncChrome();
          emit("change", { document: event.snapshot.presentation, canUndo: event.snapshot.canUndo, canRedo: event.snapshot.canRedo, event });
        }
        refresh();
      }),
      // An edit of a catalog's record forks it into this deck's own records; tell the person.
      session.subscribe((event) => {
        if (event.meta?.notice) setTimeout(() => !destroyed && say(event.meta.notice));
      }),
    );
  }

  // CE-20: the Studio over the parts mounted above (src/studio.js).
  function mountStudio() {
    studioCtl = createStudio({
      root,
      element,
      shell: studioShell,
      slots,
      session,
      ui,
      canvas,
      options,
      layout,
      hostCatalogs,
      get pane() {
        return pane;
      },
      get find() {
        return find;
      },
      get exportMenu() {
        return exportMenu;
      },
      get slideManager() {
        return slideManager;
      },
      get thumbnailCache() {
        return thumbnailCache;
      },
      get persistence() {
        return persistence;
      },
      get handle() {
        return handle;
      },
      slideIndex: () => slideIndex,
      go: (index) => go(index),
      present: (from) => present(from),
      say,
      emit,
      report,
      on,
      setView: (view) => setView(view),
      readOnly: () => readOnly,
      inSync: () => inSync,
      fontsLoading: () => fontsPending,
      catalogs,
      layoutFor: (deck, index) => layoutFor(deck, index),
      setDocument: (document, openOptions) => setDocument(document, openOptions),
      openFind: (openOptions) => {
        if (!find) return false;
        find.openPanel(openOptions ?? {});
        return true;
      },
      getName: () => pane?.getName(),
      setName: (name) => pane?.setName(name),
      layoutStudio: () => studio,
      mountSlideRow: () => mountSlideRow(),
    });
  }

  // The shell's own controls: history, views, tabs.
  function mountControls() {
    controls.undo?.addEventListener("click", () => undo());
    controls.redo?.addEventListener("click", () => redo());
    for (const [name, button] of Object.entries(controls.views ?? {})) button.addEventListener("click", () => setView(name, { focus: true }));
    for (const [name, tab] of Object.entries(controls.tabs ?? {})) {
      tab.addEventListener("click", () => showPanelNow(name));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const names = Object.keys(controls.tabs);
        const at = names.indexOf(name);
        const next = event.key === "Home" ? 0 : event.key === "End" ? names.length - 1 : (at + (event.key === "ArrowRight" ? 1 : -1) + names.length) % names.length;
        showPanelNow(names[next], true);
      });
    }
    if (controls.tabs) showPanelNow(options.panel && controls.tabs[options.panel] ? options.panel : Object.keys(controls.tabs)[0]);
    if (options.shortcuts !== false) {
      // Ctrl/Cmd+Z and +Shift+Z undo and redo when nothing that edits text has focus (the code editor and the canvas's inputs keep their own).
      const onKey = (event) => {
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.defaultPrevented) return;
        if (event.target?.closest?.("input,textarea,select,[contenteditable],.cm-editor,dialog[open]")) return;
        if (!element.contains(event.target) && event.target !== doc.body) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      };
      doc.addEventListener("keydown", onKey);
      cleanups.push(() => doc.removeEventListener("keydown", onKey));
    }
  }

  // The slide fits its frame; the density and the export mode follow the device when they were left to "auto".
  function mountEnvironment() {
    if (fitMode && slots.canvas && typeof ResizeObserver === "function" && slots.canvas.parentElement) {
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width !== frameSize.width || height !== frameSize.height) {
          frameSize = { width, height };
          applyFit();
        }
      });
      observer.observe(slots.canvas.parentElement);
      cleanups.push(() => observer.disconnect());
    }
    const follow = (setting, query, apply) => {
      if (setting !== undefined && setting !== "auto") return;
      const media = win?.matchMedia?.(query);
      if (!media?.addEventListener) return;
      const change = () => apply("auto");
      media.addEventListener("change", change);
      cleanups.push(() => media.removeEventListener("change", change));
    };
    follow("density" in requested ? requested.density : options.density, "(pointer: coarse)", setDensity);
    follow("exportMode" in requested ? requested.exportMode : options.exportMode, "(max-width: 900px)", setExportMode);
  }

  // ---- the handle -------------------------------------------------------------------------------------------------------------
  function undo() {
    if (!mounted || readOnly) return false;
    if (canvas?.commit() === false) return false;
    pane?.getText();
    try {
      session.undo();
      return true;
    } catch (error) {
      report(error);
      return false;
    }
  }
  function redo() {
    if (!mounted || readOnly) return false;
    if (canvas?.commit() === false) return false;
    pane?.getText();
    try {
      session.redo();
      return true;
    } catch (error) {
      report(error);
      return false;
    }
  }
  function applyReadOnly() {
    pane?.setReadOnly(readOnly);
    studio?.setReadOnly(readOnly);
    root.toggleAttribute("data-readonly", readOnly);
    syncChrome();
    studioCtl?.refresh();
  }
  function setDensity(setting) {
    if (destroyed) return;
    // Before the parts mount the setting is kept; the mount reads it instead of the `density` option.
    if (!partsReady) {
      requested.density = setting;
      density = densityFor(setting);
      root.setAttribute("data-density", density);
      return;
    }
    const next = densityFor(setting);
    if (next === density) return;
    density = next;
    root.setAttribute("data-density", density);
    pane?.setDensity(density);
    exportMenu?.setDensity(density);
    presentButton?.setDensity(density);
    studio?.setDensity(density);
    mountSlideRow();
  }
  function setExportMode(setting) {
    if (destroyed) return;
    if (!partsReady) requested.exportMode = setting;
    exportMode = exportModeFor(setting);
    exportMenu?.setMode(exportMode);
  }
  function setDocument(document, openOptions = {}) {
    if (destroyed || !mounted) throw new OPFEditorError("not-ready", "The editor is not mounted yet. Await `ready` first.");
    const text = typeof openOptions.text === "string" ? lf(openOptions.text).replace(/^﻿/, "") : undefined;
    try {
      if (pane) {
        if (openOptions.format && pane.getFormat() !== openOptions.format && !pane.setFormat(openOptions.format)) throw new Error("The editor could not switch the source format.");
        // The pane shows the text as written (JSON, or a YAML or Markdown file with its comments and prose layout) and brings it back on Undo and Redo.
        pane.replaceDocument(document, {
          ...(text !== undefined ? { source: text } : {}),
          ...(openOptions.format ? { format: openOptions.format } : {}),
          ...(openOptions.name !== undefined ? { name: openOptions.name } : {}),
        });
        pane.getText();
        openedText = text !== undefined && pane.getFormat() === "json" ? openOptions.text : undefined;
      } else session.replaceDocument(document, { source: "load" });
      // A document the host loaded is not the person's work: it is not autosaved or warned about until it is edited.
      if (openOptions.rebase !== false) persistence?.rebase();
      return true;
    } catch (error) {
      if (error?.code !== "invalid-opf-edit") throw error;
      // A document the session refuses is no document to open: show its text with its findings, as a draft the person can fix.
      if (pane && text !== undefined) pane.setSourceText(text, { ...(openOptions.format ? { format: openOptions.format } : {}), ...(openOptions.name !== undefined ? { name: openOptions.name } : {}) });
      return false;
    }
  }
  // Raw text in the source pane (a file as it was read, a draft that does not parse), without converting it: what the person would get by
  // pasting it over everything. True when the session now holds its document; false when it stays a draft with its problems.
  function setSourceText(text, openOptions = {}) {
    if (destroyed || !mounted) throw new OPFEditorError("not-ready", "The editor is not mounted yet. Await `ready` first.");
    if (!pane) throw new OPFEditorError("no-source-pane", "This editor has no source pane.");
    if (readOnly) throw new OPFEditorError("read-only", "This editor is read-only.");
    if (typeof text !== "string") throw new TypeError("setSourceText needs the source text as a string.");
    // An open canvas edit is committed first; the text then replaces it.
    if (canvas?.commit() === false) return false;
    drafting = false;
    openedText = undefined;
    const applied = pane.setSourceText(text, {
      ...(openOptions.format ? { format: openOptions.format } : {}),
      ...(openOptions.name !== undefined ? { name: openOptions.name } : {}),
    });
    // Text the host loaded is not the person's work: it is not autosaved or warned about until it is edited.
    if (applied && openOptions.rebase !== false) persistence?.rebase();
    return applied;
  }

  // The Studio's command registry is not there before mount: `register` keeps the command and adds it when the Studio mounts (the function it
  // returns removes it either way); `list` is empty and `run` finds nothing yet.
  const preMountCommands = {
    list: () => [],
    run: () => false,
    register(command) {
      if (!waiting() || !studioLayout) return () => {};
      let stop;
      let withdrawn = false;
      const entry = queue(Symbol("command"), () => {
        if (!withdrawn) stop = studioCtl?.commands.register(command);
      });
      return () => {
        withdrawn = true;
        const at = queued.indexOf(entry);
        if (at >= 0) queued.splice(at, 1);
        stop?.();
      };
    },
  };
  let fontsRef = { value: undefined };
  let releaseFonts;
  let readyPromise;
  const handle = {
    get element() {
      return element;
    },
    get root() {
      return root;
    },
    get ready() {
      return readyPromise;
    },
    get destroyed() {
      return destroyed;
    },
    get mounted() {
      return mounted;
    },
    /** The editor session: every part reads and writes it. The host may write to it directly, also while the editor is read-only. */
    get session() {
      return session;
    },
    get canvas() {
      return canvas;
    },
    get sourcePane() {
      return pane;
    },
    get presenter() {
      return presenter;
    },
    get exportMenu() {
      return exportMenu;
    },
    get review() {
      return review;
    },
    get find() {
      return find;
    },
    get design() {
      return design;
    },
    get persistence() {
      return persistence;
    },
    get slideManager() {
      return slideManager;
    },
    get layoutStudio() {
      return studio;
    },
    get fonts() {
      return fonts;
    },
    get slideIndex() {
      return slideIndex;
    },
    /** The selection: the canvas's `{ path, value }` (or null); in the Studio, the list `[{ key, path, idPath, kind }]`. */
    get selection() {
      return studioCtl ? studioCtl.selection : selection;
    },
    /** CE-20: the arrangement ("full", "canvas", "source", "slots", or the Studio's "studio" and "playground"). */
    get layout() {
      return studioCtl?.layout ?? layout;
    },
    /** CE-20: switch the Studio between "studio" and "playground" in place (same session, history, slide and selection). */
    setLayout(next) {
      if (studioCtl) return studioCtl.setLayout(next);
      // Before mount the switch is queued (true), as the Studio's own check of the name would refuse it later.
      if (!waiting() || !studioLayout) return false;
      if (next !== "studio" && next !== "playground") throw new RangeError('setLayout takes "studio" or "playground".');
      queue("layout", () => studioCtl?.setLayout(next));
      return true;
    },
    get zoom() {
      return studioCtl?.zoom ?? 1;
    },
    setZoom(value) {
      if (studioCtl) studioCtl.setZoom(value);
      else if (waiting() && studioLayout) queue("zoom", () => studioCtl?.setZoom(value));
    },
    fit(mode) {
      if (studioCtl) studioCtl.fit(mode);
      else if (waiting() && studioLayout) queue("zoom", () => studioCtl?.fit(mode));
    },
    openLayout(layoutId, openOptions = {}) {
      if (studioCtl) return studioCtl.openLayout(layoutId, openOptions);
      if (!waiting() || !studioLayout) return false;
      queue("openLayout", () => studioCtl?.openLayout(layoutId, openOptions));
      return true;
    },
    /** CE-20: the Studio's command registry (`list`, `run`, `register`); empty outside the Studio. Commands registered before mount are added when it mounts. */
    get commands() {
      return studioCtl?.commands ?? preMountCommands;
    },
    get view() {
      return activeView;
    },
    get views() {
      return [...views];
    },
    get readOnly() {
      return readOnly;
    },
    get inSync() {
      return inSync;
    },
    /** The latest verdict on the text of the source pane (what the last `source` event carried), or `null` before the first. */
    get sourceCursor() {
      return sourceCursor;
    },
    get sourceState() {
      return sourceState;
    },
    get lastError() {
      return lastError;
    },
    get slots() {
      return slots;
    },
    getDocument() {
      return session.snapshot().presentation;
    },
    setDocument,
    setSourceText,
    setView,
    setSlide: go,
    goTo,
    select(path, selectOptions = {}) {
      if (waiting()) {
        queue("select", () => handle.select(path, selectOptions));
        return studioLayout ? true : null;
      }
      if (studioCtl) return studioCtl.selectTargets(path, selectOptions);
      return canvas?.reveal(path, { focus: Boolean(selectOptions.focus) }) ?? null;
    },
    showPanel,
    present,
    undo,
    redo,
    /** Run the update again now (the parts redraw, `sync` is emitted once the fonts are ready). Resolves when it is done. */
    refresh,
    /** Resolves when the latest update has finished (fonts loaded, parts redrawn). */
    whenIdle() {
      return lastRefresh;
    },
    commit() {
      return canvas?.commit() !== false;
    },
    focus(target) {
      if (waiting()) {
        queue("focus", () => handle.focus(target));
        return true;
      }
      if ((target ?? (pane ? "source" : "canvas")) === "source") {
        pane?.editor?.api?.focus?.();
        return Boolean(pane);
      }
      const node = slots.canvas?.querySelector?.("[data-canvas-target], [role='button']");
      node?.focus();
      return Boolean(node);
    },
    openFind(openOptions) {
      if (waiting() && parts.find) {
        queue("find", () => handle.openFind(openOptions));
        return true;
      }
      if (!find) return false;
      find.openPanel(openOptions ?? {});
      return true;
    },
    readSource() {
      if (!pane) return { text: JSON.stringify(session.presentation, null, 2), format: "json", draft: false };
      // While the canvas holds an inline edit the pane shows that draft; reading it must not commit it to the document.
      if (canvas?.editingPath != null) return { text: pane.editor.api.getValue(), format: pane.getFormat(), draft: true };
      const text = pane.getText();
      return { text, format: pane.getFormat(), draft: draftInvalid };
    },
    setName(name) {
      if (waiting()) requested.name = name;
      pane?.setName(name);
    },
    getName() {
      if (pane) return pane.getName();
      return waiting() ? (requested.name ?? options.source?.name) : undefined;
    },
    setReadOnly(value) {
      readOnly = Boolean(value);
      if (mounted) applyReadOnly();
    },
    setTheme(theme) {
      return themeController.update(theme);
    },
    setDensity,
    setExportMode,
    status: say,
    on,
    off,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      mounted = false;
      refreshToken++;
      emit("destroy", {});
      for (const stop of cleanups.splice(0).reverse()) {
        try {
          stop();
        } catch {
          /* already gone */
        }
      }
      studioCtl?.destroy();
      unbindKeys?.();
      checking?.disconnect();
      persistence?.destroy();
      persistenceUi?.destroy();
      find?.destroy();
      review?.destroy();
      design?.destroy();
      studio?.destroy();
      outline?.destroy();
      sorter?.destroy();
      slideManager?.destroy();
      presentButton?.destroy();
      presenter?.destroy();
      exportMenu?.destroy();
      strip?.destroy();
      slideNav?.destroy();
      pane?.destroy();
      canvas?.destroy();
      themeController.destroy();
      root.remove();
      releaseFonts?.();
      listeners.clear();
    },
  };

  // ---- start ------------------------------------------------------------------------------------------------------------------
  function mount(resolved) {
    if (studioLayout && !studioShell) buildStudio();
    fonts = resolved;
    // A density, an export mode or a view the host chose before the parts mounted wins over the option.
    density = densityFor("density" in requested ? requested.density : options.density);
    exportMode = exportModeFor("exportMode" in requested ? requested.exportMode : options.exportMode);
    root.setAttribute("data-density", density);
    partsReady = true;
    mountParts();
    mounted = true;
    if (readOnly) applyReadOnly();
    say(MESSAGES.ready);
    const wantedView = "view" in requested ? requested.view : options.view;
    activeView = "slide";
    if (wantedView && wantedView !== "slide") setView(wantedView);
    else markView("slide");
    syncChrome();
    flushQueued();
  }
  readyPromise = new Promise((resolve, reject) => {
    const start = (arrived) => {
      const lease = fontsRef.use(arrived);
      if (destroyed) {
        lease.release?.();
        resolve(handle);
        return;
      }
      releaseFonts = lease.release;
      mount(lease.fonts);
      emit("mounted", { editor: handle });
      // The first update runs a tick later, so a host that listens after `createOpfEditor` returns hears it. Ready once it is done: the document has
      // been checked against the fonts it needs.
      Promise.resolve()
        .then(() => refresh())
        .then(() => {
          if (!destroyed) emit("ready", { editor: handle });
          resolve(handle);
        })
        .catch(reject);
    };
    const fail = (error) => {
      report(error);
      if (!destroyed) say(error.message);
      reject(error);
    };
    try {
      fontsRef = fontsSource(options.fonts);
      const chunk = slideParts && !partsLoaded ? loadParts() : null;
      if (isThenable(fontsRef.value) || chunk) {
        if (isThenable(fontsRef.value)) say(MESSAGES.loadingFonts);
        Promise.all([fontsRef.value, chunk]).then(([resolved]) => {
          try {
            start(resolved);
          } catch (error) {
            fail(error);
          }
        }, (error) => {
          // The slide chunk did not load: fonts that did arrive are given back.
          Promise.resolve(fontsRef.value).then((resolved) => fontsRef.use(resolved).release?.(), () => {});
          fail(error);
        });
      } else start(fontsRef.value);
    } catch (error) {
      fail(error);
    }
  });
  // A host that never awaits `ready` must not get an unhandled rejection for a failure it can read from `error`.
  readyPromise.catch(() => {});
  return handle;
}
