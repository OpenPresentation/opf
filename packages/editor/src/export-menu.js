// RR-98: the Export menu. A trigger button ("Download Export v") that opens the editor's one panel (src/panel.js, shared with Design and Find)
// holding a grouped `role="menu"`: Slides (PowerPoint, PDF, SVG slides, PNG images), OPF source (JSON, YAML, Markdown) and For an agent (the
// handoff dialog). `mode: "sheet"` draws the same panel as the mobile bottom sheet.
//
// Slides go through this package's headless `convert` (`export.js`) with the host's fonts, catalogs and render options; PowerPoint lives in
// @openpresentation/opf-pptx, which the editor does not import, so the host injects `exportPptx(deck, { signal, onProgress })`. The source
// formats are core's `toYaml` and `toMarkdown` (`@openpresentation/opf/yaml`, `/markdown`, loaded on first use); JSON is the document as
// "Save OPF" writes it (catalog records embedded). Choosing a format keeps the panel open: progress, Cancel (an AbortController), the file
// made or the failure, and the converter's notes show in a card at the top of the panel and are announced through an `aria-live` region.
// Downloads go to a Blob link unless the host takes them with `onDownload`. Plain DOM; styles in src/styles/panel.css and export-menu.css
// (classes `opf-export-*`).
import { createAgentHandoffDialog } from "./agent-handoff-dialog.js";
import { prepareSave } from "./catalogs.js";
import { el, icon, saveBlob } from "./export-dom.js";
import { convert, exportFileName, slidesToConvert } from "./export.js";
import { claimPanel, createPanelFrame, panelLabel, placePanel, releasePanel, shown, tabWithin } from "./panel.js";
import { measureDeck } from "./picture-luminance.js";

const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const EXPORT_DISABLED_REASON = "Showing the last valid slides. Fix the JSON to resume editing and downloads.";
const BUSY_REASON = "Another export is running. Cancel it first.";
const AUTO_HIDE_MS = 4000;
const MAX_NOTES = 6;

// Each row: the name, and at the right the file type and a hint.
const SLIDE_FORMATS = {
  pptx: { label: "PowerPoint", icon: "Presentation", meta: () => ".pptx · editable" },
  pdf: { label: "PDF", icon: "FileText", meta: () => ".pdf · all slides" },
  svg: { label: "SVG slides", icon: "Image", meta: (count) => (count > 1 ? ".zip" : ".svg") },
  png: { label: "PNG images", icon: "Images", meta: (count) => (count > 1 ? ".zip" : ".png") },
};
const SOURCE_FORMATS = {
  json: { label: "JSON", icon: "FileJson", meta: ".opf.json", extension: "opf.json", type: "application/json" },
  yaml: { label: "YAML", icon: "FileCode", meta: ".opf.yaml", extension: "opf.yaml", type: "application/yaml" },
  markdown: { label: "Markdown", icon: "FileType", meta: ".opf.md", extension: "opf.md", type: "text/markdown" },
};
const GROUP_LABELS = { slides: "Slides", source: "OPF source", agent: "For an agent" };
let counter = 0;

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const sizeText = (bytes) => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);
const isAbort = (error, signal) => Boolean(signal?.aborted) || error?.code === "export-aborted" || error?.name === "AbortError";
const abortError = () => Object.assign(new Error("The export was canceled."), { code: "export-aborted", name: "OPFEditorError" });
// A converter note: core's finding shape (`slide` is zero-based there) or a plain string from the host's exporter.
const noteText = (note) => (typeof note === "string" ? note : `${Number.isInteger(note.slide) ? `Slide ${note.slide + 1}: ` : note.path ? `${note.path}: ` : ""}${note.message ?? note.ruleId ?? ""}`);

// The promise, or the abort, whichever comes first: a host exporter that ignores the signal still stops being waited for.
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const stop = () => reject(abortError());
    signal.addEventListener("abort", stop, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", stop); resolve(value); },
      (error) => { signal.removeEventListener("abort", stop); reject(error); },
    );
  });
}

function normalizeItems(items, hasPptx) {
  const known = (list, table) => list.filter((name) => name in table);
  const slides = items?.slides === false ? [] : known(items?.slides ?? Object.keys(SLIDE_FORMATS).filter((name) => name !== "pptx" || hasPptx), SLIDE_FORMATS);
  const source = items?.source === false ? [] : known(items?.source ?? Object.keys(SOURCE_FORMATS), SOURCE_FORMATS);
  return { slides, source, agent: items?.agent !== false };
}

/**
 * Mount the Export menu in `container`. See `export-menu.d.ts` for every option. Returns
 * `{ element, trigger, refresh, open, close, setDisabled, setMode, cancel, destroy }`.
 */
export function createExportMenu(container, options = {}) {
  const doc = container.ownerDocument ?? document;
  const id = `opf-export-${++counter}`;
  const getDeck = options.getDeck;
  if (typeof getDeck !== "function") throw new TypeError("createExportMenu needs getDeck(): the document to export.");
  let mode = options.mode === "sheet" ? "sheet" : "menu";
  let density = options.density === "touch" ? "touch" : "comfortable";
  let disabledReason = options.disabled === true ? EXPORT_DISABLED_REASON : typeof options.disabled === "string" && options.disabled ? options.disabled : undefined;
  let items = normalizeItems(options.items, typeof options.exportPptx === "function");
  let isOpen = false, busy, handoffDialog, destroyed = false;
  let hideTimer, liveTimer;

  const catalogsNow = () => (typeof options.catalogs === "function" ? options.catalogs() : options.catalogs);
  const peekDeck = () => { try { return getDeck(); } catch { return undefined; } };

  // ---- the DOM ----------------------------------------------------------------------------------------------------------------------------
  const trigger = el(doc, "button", { type: "button", class: "opf-export-trigger", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": `${id}-panel` },
    icon(doc, "Download"), el(doc, "span", { class: "opf-export-trigger-label", text: options.label ?? "Export" }), icon(doc, "ChevronDown"));
  const frame = createPanelFrame(doc, { id: `${id}-panel`, title: "Export", className: "opf-export-panel" });
  const { element: panel, close: closeButton } = frame;
  const menu = el(doc, "div", { class: "opf-export-menu", role: "menu", id: `${id}-menu`, "aria-label": "Export formats" });
  const scrim = el(doc, "div", { class: "opf-panel-scrim opf-export-scrim", hidden: true });
  const live = el(doc, "div", { class: "opf-export-live", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  // The card at the top of the panel: what is being made (with Cancel and its progress), the file made or the failure (with Dismiss), and the notes.
  const statusIcon = el(doc, "span", { class: "opf-export-status-icon" });
  const statusText = el(doc, "p", { class: "opf-export-status-text" });
  const statusAction = el(doc, "button", { type: "button", class: "opf-panel-button opf-export-status-action" });
  const statusDetail = el(doc, "p", { class: "opf-export-status-detail", hidden: true });
  const statusBar = el(doc, "progress", { class: "opf-export-progress", max: "1", hidden: true, "aria-label": "Export progress" });
  const statusNotes = el(doc, "ul", { class: "opf-export-notes", "aria-label": "Export notes" });
  const notesBox = el(doc, "div", { class: "opf-export-notes-box", hidden: true }, icon(doc, "Info"), statusNotes);
  const statusPanel = el(doc, "div", { class: "opf-export-status", role: "group", "aria-label": "Export status", hidden: true },
    el(doc, "div", { class: "opf-export-status-row" }, statusIcon, statusText, statusAction), statusDetail, statusBar, notesBox);
  frame.body.append(statusPanel, menu);
  const root = el(doc, "div", { class: "opf-export opf-ui", "data-mode": mode, "data-density": density }, trigger, panel, scrim, live);

  // ---- the menu ---------------------------------------------------------------------------------------------------------------------------
  function buildMenu() {
    const deck = peekDeck();
    const count = deck ? slidesToConvertSafe(deck) : 0;
    const groups = [];
    const row = (kind, format, label, iconName, meta) => el(doc, "button", { type: "button", class: "opf-panel-row opf-export-item", role: "menuitem", tabindex: "-1", "data-kind": kind, "data-format": format },
      icon(doc, iconName, 16), el(doc, "span", { class: "opf-panel-name opf-export-item-label", text: label }), el(doc, "span", { class: "opf-panel-meta opf-export-item-meta", text: meta }));
    const group = (key, rows, extra) => {
      const label = panelLabel(doc, GROUP_LABELS[key], { class: "opf-export-group-label", id: `${id}-${key}` });
      if (extra) label.append(el(doc, "span", { "aria-hidden": "true", text: ` · ${extra}` }));
      return el(doc, "div", { class: "opf-export-group", role: "group", "aria-labelledby": label.id, "data-group": key }, label, el(doc, "div", { class: "opf-panel-list" }, ...rows));
    };
    if (items.slides.length) groups.push(group("slides", items.slides.map((name) => row("slides", name, SLIDE_FORMATS[name].label, SLIDE_FORMATS[name].icon, SLIDE_FORMATS[name].meta(count))), count || undefined));
    if (items.source.length) groups.push(group("source", items.source.map((name) => row("source", name, SOURCE_FORMATS[name].label, SOURCE_FORMATS[name].icon, SOURCE_FORMATS[name].meta))));
    if (items.agent) groups.push(group("agent", [row("agent", "handoff", "Agent handoff", "Bot", ".md")]));
    menu.replaceChildren(...groups);
    syncItems();
  }
  const slidesToConvertSafe = (deck) => { try { return slidesToConvert(deck, options.convertOptions).length; } catch { return 0; } };
  const menuItems = () => [...menu.querySelectorAll(".opf-export-item")];
  function reasonFor(item) {
    if (item.dataset.kind === "agent") return undefined;
    if (busy) return BUSY_REASON;
    if (item.dataset.kind === "slides") {
      if (disabledReason) return disabledReason;
      if (item.dataset.format === "pptx" && typeof options.exportPptx !== "function") return "PowerPoint export is not set up in this editor.";
    }
    return undefined;
  }
  function syncItems() {
    for (const item of menuItems()) {
      const reason = reasonFor(item);
      if (reason) { item.setAttribute("aria-disabled", "true"); item.title = reason; }
      else { item.removeAttribute("aria-disabled"); item.removeAttribute("title"); }
    }
    if (busy) trigger.setAttribute("aria-busy", "true"); else trigger.removeAttribute("aria-busy");
    root.toggleAttribute("data-busy", Boolean(busy));
  }

  // ---- open and close ---------------------------------------------------------------------------------------------------------------------
  // The panel opens under the anchor (the host's bar, else the trigger) or, as `mode: "sheet"` or with nothing on screen to open under, as the bottom sheet.
  const anchorNow = () => {
    const given = typeof options.anchor === "function" ? options.anchor() : options.anchor;
    return shown(given) ? given : shown(trigger) ? trigger : null;
  };
  function layout() {
    const anchor = anchorNow();
    const sheeted = mode === "sheet" || !anchor;
    root.dataset.mode = sheeted ? "sheet" : "menu";
    panel.hidden = !isOpen;
    scrim.hidden = !sheeted || !isOpen;
    panel.setAttribute("aria-modal", String(sheeted));
    trigger.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) placePanel(panel, anchor, sheeted);
  }
  // One item is in the Tab order (roving): the focused one.
  function focusItem(which = "first") {
    const list = menuItems();
    const enabled = list.filter((item) => item.getAttribute("aria-disabled") !== "true");
    const pool = enabled.length ? enabled : list;
    const target = typeof which === "object" ? which : which === "last" ? pool[pool.length - 1] : pool[0];
    for (const item of list) item.tabIndex = item === target ? 0 : -1;
    target?.focus();
  }
  const swapClose = () => close({ restoreFocus: false });
  function onDocumentPointerdown(event) { if (!root.contains(event.target)) close({ restoreFocus: false }); }
  function onDocumentKeydown(event) {
    if (event.key === "Escape" && isOpen) { event.preventDefault(); event.stopPropagation(); close(); }
  }
  const onReflow = () => layout();
  function open(which = "first") {
    if (destroyed || isOpen) return;
    claimPanel(doc, swapClose);
    buildMenu();
    if (!busy) hideStatus();
    isOpen = true;
    layout();
    doc.addEventListener("pointerdown", onDocumentPointerdown, true);
    doc.addEventListener("keydown", onDocumentKeydown, true);
    doc.defaultView?.addEventListener("resize", onReflow);
    focusItem(which);
  }
  function close({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    releasePanel(doc, swapClose);
    layout();
    doc.removeEventListener("pointerdown", onDocumentPointerdown, true);
    doc.removeEventListener("keydown", onDocumentKeydown, true);
    doc.defaultView?.removeEventListener("resize", onReflow);
    if (restoreFocus) trigger.focus();
  }
  function onPanelKeydown(event) {
    const list = menuItems();
    const at = list.indexOf(doc.activeElement);
    if (event.key === "Tab") {
      // Tab moves through the panel (the card's button, the menu, Close); from the last stop the focus leaves and the popover closes. The sheet keeps it.
      if (!tabWithin(panel, event, root.dataset.mode === "sheet")) close({ restoreFocus: false });
      return;
    }
    if (at < 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      focusItem(list[(at + step + list.length) % list.length]);
    } else if (event.key === "Home") { event.preventDefault(); focusItem(list[0]); }
    else if (event.key === "End") { event.preventDefault(); focusItem(list[list.length - 1]); }
  }

  // ---- status -----------------------------------------------------------------------------------------------------------------------------
  function announce(message) {
    globalThis.clearTimeout(liveTimer);
    live.textContent = "";
    liveTimer = globalThis.setTimeout(() => { live.textContent = message; }, 20);
  }
  function hideStatus() {
    globalThis.clearTimeout(hideTimer);
    const was = statusPanel.hidden;
    statusPanel.hidden = true;
    if (isOpen && !was) layout();
  }
  // state: "busy" | "success" | "error" | "canceled". `progress`: { value, indeterminate }. Notes keep the card up until dismissed. A file
  // made shows its name on the card's first line and the rest of the message (slides, size, notes) under it.
  function showStatus(state, message, { notes = [], progress, announceIt = true, title } = {}) {
    globalThis.clearTimeout(hideTimer);
    const fresh = statusPanel.hidden || statusPanel.dataset.state !== state;
    statusPanel.dataset.state = state;
    statusText.textContent = title ?? message;
    statusDetail.textContent = title ? message.slice(title.length).replace(/^ · /, "") : "";
    statusDetail.hidden = !statusDetail.textContent;
    statusIcon.replaceChildren(...(state === "success" ? [icon(doc, "Check", 16)] : state === "error" ? [icon(doc, "X", 16)] : []));
    statusBar.hidden = state !== "busy";
    if (state === "busy" && progress) { if (progress.indeterminate) statusBar.removeAttribute("value"); else statusBar.value = progress.value; }
    statusAction.textContent = state === "busy" ? "Cancel" : "Dismiss";
    statusAction.setAttribute("aria-label", state === "busy" ? "Cancel export" : "Dismiss export status");
    const listed = notes.slice(0, MAX_NOTES).map((note) => el(doc, "li", { text: noteText(note) }));
    if (notes.length > MAX_NOTES) listed.push(el(doc, "li", { text: `…and ${notes.length - MAX_NOTES} more` }));
    statusNotes.replaceChildren(...listed);
    notesBox.hidden = !listed.length;
    statusPanel.hidden = false;
    // The card is at the top of the panel: a new state scrolls it into view.
    if (isOpen && fresh) {
      frame.body.scrollTop = 0;
      layout();
    }
    if (announceIt) announce(state === "success" && notes.length ? `${message}. ${plural(notes.length, "note")} to review.` : message);
    if ((state === "success" || state === "canceled") && !notes.length) hideTimer = globalThis.setTimeout(hideStatus, AUTO_HIDE_MS);
    options.onStatus?.({ state, message, notes: notes.map(noteText) });
  }

  // ---- exporting --------------------------------------------------------------------------------------------------------------------------
  function progressOf(update) {
    if (!update) return { indeterminate: true };
    const counted = Number(update.total) > 1 && (update.stage === "convert" || update.stage === "render" || update.stage === undefined);
    return counted ? { value: Math.min(1, Math.max(0, update.done / update.total)) } : { indeterminate: true };
  }
  function reporter(label, signal) {
    return (update) => {
      if (destroyed || signal.aborted || busy?.signal !== signal) return;
      showStatus("busy", update?.message || `Exporting ${label}…`, { progress: progressOf(update), announceIt: false });
    };
  }
  async function exportSlides(deck, format, signal, label) {
    const progress = reporter(label, signal);
    if (format === "pptx") {
      // LH-145: the same picture measurements the preview and the other exports use, so the PPTX draws the same scrim (pass it to `toPptx` as `pictureLuminance`).
      const pictureLuminance = await abortable(measureDeck(deck, { ...(options.renderOptions ?? {}), catalogs: catalogsNow() }), signal);
      const out = await abortable(Promise.resolve().then(() => options.exportPptx(deck, { signal, onProgress: progress, ...(pictureLuminance ? { pictureLuminance } : {}) })), signal);
      const raw = out instanceof Blob || out instanceof ArrayBuffer || ArrayBuffer.isView(out) ? { bytes: out } : out;
      if (!raw || raw.bytes === undefined) throw new Error("The PowerPoint export returned no data.");
      const blob = raw.bytes instanceof Blob ? raw.bytes : new Blob([raw.bytes], { type: PPTX_TYPE });
      if (!blob.size) throw new Error("The PowerPoint export returned no data.");
      return { blob, fileName: raw.fileName ?? exportFileName(deck, "pptx"), count: deck.slides?.length ?? 0, notes: raw.warnings ?? [] };
    }
    const convertOptions = options.convertOptions ?? {};
    const zip = format !== "pdf" && slidesToConvert(deck, convertOptions).length > 1;
    const made = await convert(deck, {
      ...convertOptions, format, ...(zip ? { zip: true } : {}),
      fonts: options.fonts, catalogs: catalogsNow(), renderOptions: options.renderOptions,
      signal, onProgress: progress,
    });
    const [file] = made.files;
    return {
      blob: new Blob([file.bytes], { type: file.type }), fileName: file.name,
      count: file.slides?.length ?? file.entries?.length ?? 1,
      // Fonts the file embeds are information; everything else is a note for the author.
      notes: made.findings.filter((finding) => finding.severity !== "info"),
    };
  }
  async function exportSource(deck, format) {
    const spec = SOURCE_FORMATS[format];
    const fileName = exportFileName(deck, spec.extension);
    let text, notes = [];
    if (format === "json") {
      // As "Save OPF" writes it: every catalog record the deck uses is embedded, so the file renders the same where no catalog is registered.
      const saved = prepareSave(deck, { catalogs: catalogsNow() });
      text = JSON.stringify(saved.document, null, 2);
      if (saved.unresolved.length) notes = [`${plural(saved.unresolved.length, "catalog reference")} did not resolve, so no record was embedded for ${saved.unresolved.length === 1 ? "it" : "them"}.`];
    } else if (format === "yaml") {
      const { toYaml } = await import("@openpresentation/opf/yaml");
      text = toYaml(deck).yaml;
    } else {
      const { toMarkdown } = await import("@openpresentation/opf/markdown");
      const made = toMarkdown(deck);
      text = made.markdown;
      notes = [...(made.report.embedded ?? []).map((part) => `Written as YAML inside the Markdown, which has no syntax for it: ${part.path || "(document)"}, ${part.reason}`), ...(made.report.loss ?? []).map((loss) => `Left out: ${loss}`)];
    }
    return { blob: new Blob([text], { type: spec.type }), fileName, notes };
  }

  async function run(kind, format) {
    if (destroyed || busy) return;
    if (options.beforeExport?.(kind, format) === false) return;
    const label = kind === "slides" ? SLIDE_FORMATS[format].label : SOURCE_FORMATS[format].label;
    const controller = new AbortController();
    const { signal } = controller;
    busy = { kind, format, signal, controller };
    syncItems();
    showStatus("busy", `Exporting ${label}…`, { progress: { indeterminate: true } });
    try {
      // This committed snapshot is what is exported, even if the host edits the document meanwhile.
      const deck = structuredClone(getDeck());
      const made = kind === "slides" ? await exportSlides(deck, format, signal, label) : await exportSource(deck, format);
      if (signal.aborted) throw abortError();
      const download = { blob: made.blob, fileName: made.fileName, format };
      if (options.onDownload) await options.onDownload(download);
      else saveBlob(doc, made.blob, made.fileName);
      if (destroyed) return;
      const notes = made.notes ?? [];
      const parts = [made.fileName, ...(made.count !== undefined ? [plural(made.count, "slide")] : []), sizeText(made.blob.size), ...(notes.length ? [`${plural(notes.length, "note")} to review`] : [])];
      showStatus("success", parts.join(" · "), { notes, title: made.fileName });
      options.onExport?.({ ...download, notes: notes.map(noteText) });
    } catch (error) {
      if (destroyed) return;
      if (isAbort(error, signal)) showStatus("canceled", "Export canceled.");
      else showStatus("error", `${label} export failed. ${error?.message ?? error}`);
    } finally {
      if (busy?.controller === controller) busy = undefined;
      if (!destroyed) syncItems();
    }
  }

  function handoff() {
    if (options.beforeExport?.("agent", "handoff") === false) return;
    const document = getDeck();
    const target = options.handoffTarget ?? "pptx";
    if (options.onAgentHandoff) { options.onAgentHandoff({ document, target }); return; }
    handoffDialog?.destroy();
    handoffDialog = createAgentHandoffDialog(options.handoffContainer ?? doc.body, {
      document, target, density, fileName: options.handoffFileName, specUrl: options.specUrl, agentGuideUrl: options.agentGuideUrl,
      onDownload: options.onDownload ? (download) => options.onDownload(download) : undefined,
      onClose: () => { handoffDialog = undefined; },
    });
  }

  function activate(item) {
    if (item.getAttribute("aria-disabled") === "true") return;
    const { kind, format } = item.dataset;
    // The handoff is a dialog of its own; a file is made with the panel open, its card at the top.
    if (kind === "agent") {
      close();
      handoff();
    } else run(kind, format);
  }

  // ---- wiring -----------------------------------------------------------------------------------------------------------------------------
  trigger.addEventListener("click", () => (isOpen ? close() : open()));
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!isOpen) open(event.key === "ArrowUp" ? "last" : "first"); else focusItem(event.key === "ArrowUp" ? "last" : "first"); }
  });
  menu.addEventListener("click", (event) => { const item = event.target.closest?.(".opf-export-item"); if (item && menu.contains(item)) activate(item); });
  panel.addEventListener("keydown", onPanelKeydown);
  closeButton.addEventListener("click", () => close());
  scrim.addEventListener("click", () => close());
  statusAction.addEventListener("click", () => {
    if (busy) busy.controller.abort();
    else { hideStatus(); focusItem("first"); }
  });

  buildMenu();
  layout();
  container.append(root);

  return {
    element: root,
    trigger,
    /** Re-read the document for the menu's hints (ZIP or one file) and the disabled state. */
    refresh() { buildMenu(); },
    open,
    close,
    /** Disable the slide exports: `true` for the default reason, a string for your own (it is the items' title), `false` to enable. */
    setDisabled(reason) {
      disabledReason = reason === true ? EXPORT_DISABLED_REASON : typeof reason === "string" && reason ? reason : undefined;
      syncItems();
    },
    /** Switch between the popover and the bottom sheet (for example at a media query). */
    setMode(next) {
      const wanted = next === "sheet" ? "sheet" : "menu";
      if (wanted === mode) return;
      if (isOpen) close({ restoreFocus: false });
      mode = wanted;
      layout();
    },
    setDensity(next) { density = next === "touch" ? "touch" : "comfortable"; root.dataset.density = density; },
    /** Stop the export that is running, if any. */
    cancel() { busy?.controller.abort(); },
    destroy() {
      if (destroyed) return;
      busy?.controller.abort();
      close({ restoreFocus: false });
      destroyed = true;
      globalThis.clearTimeout(hideTimer);
      globalThis.clearTimeout(liveTimer);
      handoffDialog?.destroy();
      root.remove();
    },
  };
}
