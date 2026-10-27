// CE-20: the Studio's Design panel, bound to the selection (STUDIO-SPEC section 8). The existing `design-controls` sections are reused as
// they are, by name, in panels made once per arrangement and shown for the selection that needs them; the Studio adds a Layout row (with the
// layout's diagram, Change layout and Edit layout), the composition of a group, a promoted region or a slide (mode, columns, gap, padding and
// one weight per track, linked to the dividers), a region's read-only rules, the multiple-selection actions, speaker notes, and Advanced (the
// selection's path as a copyable chip, and the schema inspector, opened on demand). Every field commits one undoable change through the session.
// The panel shows options, not explanations: every option is a visible control with a short label, a hint is a tooltip, and an action that
// does not apply is shown disabled with its reason (and its shortcut when it has one) in its tooltip.
import { createDesignControls } from "./design-controls.js";
import { setActionState } from "./content-controls.js";
import { createChartOptionsPanel } from "./chart-options-panel.js";
import { createNumberingPanel } from "./numbering-panel.js";
import { buildLayoutDiagram } from "./layout-diagram.js";
import { listSwitchOptions } from "./switches.js";
import { dottedPath } from "./studio-canvas.js";

const MODES = [["auto", "Auto", "Layers"], ["grid", "Grid", "Table"], ["row", "Row", "Columns2"], ["column", "Column", "Rows2"]];
// Which existing sections each selection shows (STUDIO-SPEC 8), in order.
const ARRANGEMENTS = {
  deck: ["look", "variant", "background", "header-footer", "brand", "info"],
  slide: ["layout-options", "slide-content", "background"],
  block: ["selection"],
  image: ["selection", "image"],
  table: ["selection", "table"],
};
// The selected block's structural actions, around the panel's own Group with the next block and Ungroup: [command, label, icon, role].
const STRUCTURE_BEFORE = [["studio.move.earlier", "Move up", "ArrowUp", "move-up"], ["studio.move.later", "Move down", "ArrowDown", "move-down"]];
const STRUCTURE_AFTER = [["studio.duplicate", "Duplicate", "Copy", "duplicate"], ["studio.delete", "Delete", "Trash2", "delete"]];
// Modes whose selection section (the arrange toolbar and the content type) comes before the Studio's own sections.
const SHARED_FIRST = new Set(["block", "list", "chart", "group", "promoted", "image", "table"]);

/** The arrangement a selection gets: deck, slide, group, region, multi, or a block kind. */
export function designMode(nodes) {
  if (!nodes.length) return "deck";
  if (nodes.length > 1) return "multi";
  const node = nodes[0];
  if (node.kind === "slide") return "slide";
  if (node.kind === "group") return "group";
  if (node.kind === "region") return node.virtual ? "region" : "promoted";
  if (node.kind === "heading") return "heading";
  if (node.kind === "part") return "part";
  return ["image", "chart", "table", "list"].includes(node.type) ? node.type : "block";
}

/** Mount the panel in `container`. Returns `{ element, refresh, showSection, destroy }`. */
export function createStudioDesign(container, { dom, ui, studio, catalogs, designOptions = {}, onAddAsset }) {
  const doc = container.ownerDocument;
  const { el } = dom;
  const p = dom.prefix;
  const head = el("div", `${p}-design-head`);
  const notice = el("p", `${p}-design-notice`, { role: "note" });
  notice.hidden = true;
  const own = el("div", `${p}-design-own`);
  const shared = el("div", `${p}-design-shared`);
  const advanced = el("details", `${p}-design-advanced`);
  const advancedSummary = el("summary", "", { text: "Advanced" });
  // The selection's path is internal: a chip under Advanced that copies it.
  const pathChip = el("button", `${p}-path`, { type: "button", title: "Copy path" });
  pathChip.addEventListener("click", () => {
    const path = pathChip.dataset.path;
    const clipboard = doc.defaultView?.navigator?.clipboard;
    if (!path || !clipboard?.writeText) { studio.status("Copying is not available here."); return; }
    clipboard.writeText(path).then(() => studio.status(`Copied ${path}`), () => studio.status("Could not copy the path."));
  });
  const advancedBody = el("div", `${p}-design-advanced-body`);
  advanced.append(advancedSummary, pathChip, advancedBody);
  const live = el("p", `${p}-design-live`, { role: "status", "aria-live": "polite" });
  container.append(head, notice, own, shared, advanced, live);
  const panels = new Map();
  let chartPanel = null, numberingPanel = null, inspector = null, inspectorPath = null;
  let mode = null;
  let lastKey = null;

  const selectedPath = () => {
    const node = studio.primaryNode();
    if (!node || node.kind === "slide" || node.kind === "region" && node.virtual) return undefined;
    return dottedPath(node.path);
  };
  // One design-controls panel per arrangement, made the first time it is needed and kept (hidden) afterwards.
  function panel(name) {
    if (panels.has(name)) return panels.get(name);
    const host = el("div", `${p}-design-panel`, { "data-arrangement": name });
    shared.append(host);
    const hostAction = ([id, label, icon, role]) => ({ role, label, icon, state: () => studio.commandState(id), run: () => studio.run(id) });
    const controls = createDesignControls(host, {
      ...designOptions,
      showPath: false,
      ...(name === "deck" || name === "slide" ? {} : { blockActions: { before: STRUCTURE_BEFORE.map(hostAction), after: STRUCTURE_AFTER.map(hostAction) } }),
      editor: ui,
      sections: ARRANGEMENTS[name],
      scope: name === "deck" ? "deck" : "slide",
      getSlideIndex: () => studio.slideIndex,
      getSelectedPath: selectedPath,
      catalogs,
      ...(onAddAsset ? { onAddAsset } : {}),
      onSelectPath: (path) => studio.revealPath(path),
      onStatus: (message) => studio.status(message),
    });
    const entry = { host, controls };
    panels.set(name, entry);
    return entry;
  }

  const plural = (count, one) => `${count} ${one}${count === 1 ? "" : "s"}`;
  // A hint is the field's tooltip and the control's accessible description, never a paragraph under it.
  const field = (label, control, help) => {
    const wrap = el("div", `${p}-field`, { title: help });
    const id = `${p}-f-${Math.random().toString(36).slice(2, 9)}`;
    control.id ||= id;
    if (help) control.title = help;
    wrap.append(el("label", `${p}-field-label`, { for: control.id, text: label }), control);
    return wrap;
  };
  /** An action of the Studio's command registry: an icon button (or a text button with `text`), disabled with its reason, with its shortcut in its tooltip. */
  const commandButton = (id, label, icon, { text = false, className = text ? `${p}-action` : "opf-dc-tool" } = {}) => {
    const button = dom.button(className, { ...(text ? { text: label } : { label }), iconName: icon, size: text ? 14 : 16, attributes: { "data-command": id } });
    setActionState(button, { label, ...studio.commandState(id) });
    button.addEventListener("click", () => { if (button.getAttribute("aria-disabled") !== "true") studio.run(id); });
    return button;
  };
  const toolbar = (label, buttons) => { const row = el("div", "opf-dc-toolbar", { role: "group", "aria-label": label }); row.append(...buttons); return row; };
  const section = (title) => { const node = el("section", `${p}-section`); node.append(el("h3", `${p}-section-title`, { text: title })); return node; };
  // A number field: the arrow keys step it (Shift for 10 steps), a drag on its label scrubs it (as in Figma), Enter or leaving commits it.
  function numberField(label, value, { min, max, step = 1, onCommit, help, name }) {
    const input = el("input", `${p}-number`, { type: "number", inputmode: "decimal", min, max, step, value: value ?? "", "data-field": name, placeholder: "auto" });
    let base = input.value;
    const commit = () => { if (input.value === base) return; base = input.value; onCommit(input.value === "" ? undefined : Number(input.value)); };
    input.addEventListener("change", commit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); commit(); }
      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && event.shiftKey) {
        event.preventDefault();
        const next = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, Number(input.value || 0) + (event.key === "ArrowUp" ? 10 : -10) * step));
        input.value = String(Math.round(next * 1000) / 1000);
      }
    });
    const wrap = field(label, input, help);
    const caption = wrap.querySelector("label");
    caption.classList.add(`${p}-scrub`);
    caption.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || studio.readOnly) return;
      event.preventDefault();
      const start = { x: event.clientX, value: Number(input.value || 0) };
      try { caption.setPointerCapture?.(event.pointerId); } catch { /* a pointer that cannot be captured (a synthetic one) */ }
      const move = (next) => {
        const delta = Math.round((next.clientX - start.x) / 4) * step;
        input.value = String(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, Math.round((start.value + delta) * 1000) / 1000)));
      };
      const up = () => { caption.removeEventListener("pointermove", move); caption.removeEventListener("pointerup", up); commit(); };
      caption.addEventListener("pointermove", move);
      caption.addEventListener("pointerup", up);
    });
    return wrap;
  }

  // --- the composition of a container ---------------------------------------------------------------------------------------------------------
  function compositionSection(node) {
    const body = section(node.kind === "slide" ? "Slide composition" : "Composition");
    const pointer = `${node.path}/composition`;
    const current = ui.get(pointer) ?? {};
    const container = node.container ?? {};
    const write = (next, label) => {
      const clean = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
      studio.writeComposition(node, Object.keys(clean).length ? clean : undefined, label);
    };
    const mode = current.mode ?? "auto";
    const segmented = el("div", `${p}-segmented`, { role: "group", "aria-label": "Arrangement" });
    for (const [value, text, icon] of MODES) {
      const button = dom.button(`${p}-segment`, { label: text, iconName: icon, size: 16, pressed: value === mode, attributes: { "data-field": `mode-${value}` } });
      button.addEventListener("click", () => {
        if (value === mode) return;
        const next = { ...current, mode: value };
        if (value !== "grid") delete next.columns;
        // Weights belong to the tracks of one arrangement; a new arrangement starts equal.
        delete next.weights;
        write(next, `Arrangement set to ${text}`);
      });
      segmented.append(button);
    }
    const modeWrap = el("div", `${p}-field`);
    modeWrap.append(el("span", `${p}-field-label`, { text: "Arrangement" }), segmented);
    body.append(modeWrap);
    if (mode === "grid") body.append(numberField("Columns", current.columns ?? container.columns, { min: 1, max: 6, name: "columns", onCommit: (value) => write({ ...current, columns: value, weights: undefined }, `Columns set to ${value ?? "auto"}`) }));
    body.append(
      numberField("Gap", current.gap, { min: 0, max: 0.5, step: 0.01, name: "gap", help: "Share of the container's shorter side (0 to 0.5)", onCommit: (value) => write({ ...current, gap: value }, `Gap set to ${value ?? "auto"}`) }),
      numberField("Padding", current.padding, { min: 0, max: 0.4, step: 0.01, name: "padding", help: "Share of the container's shorter side (0 to 0.4)", onCommit: (value) => write({ ...current, padding: value }, `Padding set to ${value ?? "none"}`) }),
    );
    // Track weights exist in Row, Column and Grid; Auto has none to set.
    if (mode !== "auto" && container.tracks?.length >= 2) {
      const weights = el("div", `${p}-weights`, { role: "group", "aria-label": "Track weights" });
      const tracks = container.tracks;
      const values = tracks.map((track, index) => current.weights?.[index] ?? track.weight ?? 1);
      tracks.forEach((_, index) => {
        weights.append(numberField(`${container.direction === "column" ? "Row" : "Column"} ${index + 1}`, values[index], {
          min: 0.1, max: 100, step: 0.5, name: `weight-${index}`,
          onCommit: (value) => { const next = [...values]; next[index] = value ?? 1; studio.setWeights(node.key, next); },
        }));
      });
      body.append(weights);
    }
    return body;
  }

  // --- the slide's layout row -------------------------------------------------------------------------------------------------------------
  function layoutSection(node) {
    const body = section("Layout");
    const slide = ui.get(node.path) ?? {};
    const id = typeof slide.layout === "string" ? slide.layout : undefined;
    const choice = id ? listSwitchOptions(ui.presentation, "layouts", { catalogs: studio.catalogs() }).find((entry) => entry.id === id) : undefined;
    const row = el("div", `${p}-layout-row`);
    if (choice?.record) row.append(buildLayoutDiagram(doc, choice.record));
    row.append(el("span", `${p}-layout-name`, { text: choice?.label ?? id ?? "Automatic (no layout)" }));
    body.append(row);
    const actions = el("div", `${p}-actions`);
    const change = dom.button(`${p}-action`, { text: "Change layout", iconName: "Columns2", size: 14, attributes: { "aria-haspopup": "menu" } });
    change.addEventListener("click", () => studio.openSlideMenu(change, { apply: true }));
    actions.append(change, commandButton("studio.layout.edit", "Edit layout", "Pencil", { text: true }));
    body.append(actions);
    return body;
  }
  function regionSection(node) {
    const body = section(node.label);
    const rules = el("dl", `${p}-rules`);
    const add = (term, value) => rules.append(el("dt", "", { text: term }), el("dd", "", { text: value }));
    add("Accepts", node.accepts?.length ? node.accepts.join(", ") : "Any content");
    add("Most blocks", node.max ? String(node.max) : "No limit");
    add("Holds now", plural(node.children.length, "block"));
    const edit = commandButton("studio.layout.edit", "Edit layout", "Pencil", { text: true });
    // A region's rules belong to the layout: the tooltip says where they change.
    if (edit.getAttribute("aria-disabled") !== "true") edit.title = "Edit layout: the region's rules come from it";
    body.append(rules, edit);
    return body;
  }
  function notesSection(node) {
    const body = section("Notes");
    const input = el("textarea", `${p}-notes`, { rows: 4, "data-field": "notes", placeholder: "Speaker notes" });
    const pointer = `${node.path}/notes`;
    const value = ui.get(pointer);
    input.value = typeof value === "string" ? value : "";
    let base = input.value;
    input.addEventListener("change", () => {
      if (input.value === base) return;
      base = input.value;
      studio.writeValue(pointer, input.value === "" ? undefined : input.value, "Notes changed");
    });
    body.append(field("Speaker notes", input));
    return body;
  }
  function multiSection(nodes) {
    const body = section(plural(nodes.length, "block"));
    body.append(toolbar("Arrange", [["studio.group", "Group", "Group"], ["studio.duplicate", "Duplicate", "Copy"], ["studio.delete", "Delete", "Trash2"]].map(([id, label, icon]) => commandButton(id, label, icon))));
    return body;
  }
  function dataSection(node) {
    const body = section("Data");
    const button = commandButton("studio.data.edit", "Edit data", "Table", { text: true });
    if (button.getAttribute("aria-disabled") !== "true") button.title = `Edit the ${node.type === "chart" ? "chart's" : "table's"} values under the slide`;
    body.append(button);
    return body;
  }

  /** Show the sections for the selection now. */
  function refresh() {
    const nodes = studio.selectedNodes();
    const next = designMode(nodes);
    const node = nodes[0];
    const key = nodes.map((entry) => entry.key).join("|");
    // Typing in one of the Studio's own fields keeps it: only a selection change rebuilds them while focus is inside.
    const typing = own.contains(doc.activeElement) && key === lastKey && next === mode;
    mode = next;
    lastKey = key;
    container.dataset.mode = next;
    head.replaceChildren(el("h2", `${p}-design-title`, { text: next === "deck" ? "Presentation" : next === "multi" ? plural(nodes.length, "block") : node.kind === "slide" ? studio.slideLabel(node) : node.label }));
    notice.hidden = !(studio.readOnly || !studio.inSync);
    notice.textContent = studio.readOnly ? "Read-only" : !studio.inSync ? "Source has errors: showing the last valid version" : "";
    container.toggleAttribute("inert", studio.readOnly || !studio.inSync);
    if (!typing) {
      own.replaceChildren();
      if (next === "slide") {
        own.append(layoutSection(node));
        if (!studio.slideUsesLayout() && node.container && !node.container.promoted) own.append(compositionSection(node));
      } else if (next === "group" || next === "promoted") own.append(compositionSection(node));
      else if (next === "region") own.append(regionSection(node));
      else if (next === "multi") own.append(multiSection(nodes));
      else if (next === "chart" || next === "table") own.append(dataSection(node));
      else if (next === "heading") own.append(toolbar("Heading", [commandButton("studio.text.edit", "Edit text", "Pencil", { text: true })]));
      else if (next === "part") own.append(toolbar("Part", [commandButton("studio.select.parent", "Select block", "MousePointer2", { text: true })]));
    }
    // The arrange toolbar and the content type come first for a block; a slide's layout and the deck's look come before the shared sections.
    const sharedFirst = SHARED_FIRST.has(next);
    // 4 is DOCUMENT_POSITION_FOLLOWING: `own` comes after `shared`.
    if (sharedFirst !== Boolean(shared.compareDocumentPosition(own) & 4)) {
      if (sharedFirst) container.insertBefore(shared, own);
      else container.insertBefore(own, shared);
    }
    const arrangement = next === "deck" ? "deck" : next === "slide" ? "slide" : next === "image" ? "image" : next === "table" ? "table" : ["block", "list", "chart", "group", "promoted"].includes(next) ? "block" : null;
    for (const [name, entry] of panels) entry.host.hidden = name !== arrangement;
    if (arrangement) { const entry = panel(arrangement); entry.host.hidden = false; entry.controls.refresh(); }
    // The chart's options and a list's numbering follow the selection in their own panels.
    if (next === "chart") {
      chartPanel ??= createChartOptionsPanel(el("div", `${p}-design-chart`), { editor: ui, getSelectedPath: selectedPath, onStatus: (message) => studio.status(message) });
      own.append(chartPanel.element.parentElement ?? chartPanel.element);
      chartPanel.refresh();
    }
    if (next === "list") {
      numberingPanel ??= createNumberingPanel(el("div", `${p}-design-numbering`), { editor: ui, getTarget: selectedPath, getSlideIndex: () => studio.slideIndex, onStatus: (message) => studio.status(message) });
      own.append(numberingPanel.element.parentElement ?? numberingPanel.element);
      numberingPanel.setTarget();
    }
    if (next === "slide" && !typing) own.append(notesSection(node));
    // Advanced: the node's other fields through the schema inspector, made when opened.
    const path = node && node.kind !== "region" ? dottedPath(node.path) : "";
    advanced.hidden = next === "multi" || next === "region";
    pathChip.hidden = !path;
    pathChip.dataset.path = path;
    pathChip.setAttribute("aria-label", `Copy path ${path}`);
    pathChip.replaceChildren(el("code", "", { text: path }), dom.icon("Copy", 14));
    if (advanced.open && path !== inspectorPath) mountInspector(path);
  }
  async function mountInspector(path) {
    inspectorPath = path;
    inspector?.destroy();
    inspector = null;
    advancedBody.replaceChildren();
    const { createSchemaInspector } = await import("./schema-inspector.js");
    if (!advanced.open || inspectorPath !== path) return;
    inspector = createSchemaInspector(advancedBody, { editor: ui, path: path || undefined, onError: (error) => studio.status(error.message) });
  }
  advanced.addEventListener("toggle", () => {
    if (advanced.open) {
      const node = studio.primaryNode();
      mountInspector(node && node.kind !== "region" ? dottedPath(node.path) : "");
    }
  });

  return {
    element: container,
    refresh,
    get mode() { return mode; },
    /** Scroll a section into view (the layers' Background row). */
    showSection(name) {
      const entry = panels.get(mode === "slide" ? "slide" : "deck");
      const target = entry?.host.querySelector(`[data-section="${name}"], details:has([data-section="${name}"])`) ?? entry?.host;
      target?.scrollIntoView?.({ block: "start" });
      if (target?.tagName === "DETAILS") target.open = true;
    },
    destroy() {
      for (const entry of panels.values()) entry.controls.destroy();
      chartPanel?.destroy();
      numberingPanel?.destroy();
      inspector?.destroy();
      container.replaceChildren();
    },
  };
}
