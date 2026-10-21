// The canvas of the layout editor (RR-99): a 16:9 slide frame that draws the region tree as labeled boxes and edits it directly. Select,
// split, insert, add the heading regions, pan, and preview with sample content; drag a divider to resize, drag a region to reorder or move
// it into another split; a context menu and the keyboard do the same. The boxes are positioned from `layoutBoxes` (layout-tree.js), so
// the canvas keeps no tree of its own: every edit is a command on the shared model, and every pointer gesture is one history step.
import { createLayoutModel } from "./layout-model.js";
import { LAYOUT_TOOL_DEFS } from "./layout-palette.js";
import { sampleDeck } from "./layout-samples.js";
import { whenFontsReady } from "./font-gate.js";
import {
  LayoutOperationError, effectiveSize, isHeading, isPrefix, isSplit, layoutBoxes, listAt, moveNodes, nodeAt, pathKey, resizeSizes, samePath, setPairSizes,
} from "./layout-tree.js";
import {
  SIZE_LABEL, buildWireframe, createDom, handleGlobalShortcut, handleSelectionShortcut, isTypingTarget, nextId, nodeMenuItems, openMenu, pct,
} from "./layout-editor-ui.js";

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const DRAG_DISTANCE = 4;
const HEADING_ITEMS = [{ name: "title", label: "Title region" }, { name: "subtitle", label: "Subtitle region" }];
const inside = (box, p, slack = 0) => p.x >= box.x - slack && p.x <= box.x + box.w + slack && p.y >= box.y - slack && p.y <= box.y + box.h + slack;

/**
 * Mount the canvas in `container`. Options: `model` (shared state; one is created from the other options when omitted), `toSvg` and `fonts`
 * (the host's renderer and fonts handle, for Preview; a wireframe is drawn without them), `renderOptions`, `label`. Returns `{ element,
 * model, refresh, setZoom, getZoom, focus, destroy }`.
 */
export function createLayoutCanvas(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument, win = doc.defaultView;
  const dom = createDom(doc);
  const { el } = dom;
  const ownModel = !options.model;
  const model = options.model ?? createLayoutModel(options);
  const id = nextId("opf-lx-canvas");

  const root = el("div", "opf-lx-canvas opf-ui", { "data-density": model.density, "data-tool": model.tool });
  const viewport = el("div", "opf-lx-viewport");
  const stage = el("div", "opf-lx-stage");
  const frame = el("div", "opf-lx-frame", { role: "group", "aria-label": options.label ?? "Layout canvas, a 16 by 9 slide", tabindex: "-1" });
  const rendered = el("div", "opf-lx-render", { "aria-hidden": "true" });
  const content = el("div", "opf-lx-content");
  const implicit = el("div", "opf-lx-implicit", { "aria-hidden": "true" });
  implicit.append(el("span", "opf-lx-implicit-label", { text: "title · implicit" }));
  const layer = el("div", "opf-lx-layer");
  const overlay = el("div", "opf-lx-overlay");
  const cut = el("div", "opf-lx-cut", { "aria-hidden": "true" });
  const drop = el("div", "opf-lx-drop", { "aria-hidden": "true" });
  const ratio = el("div", "opf-lx-ratio", { "aria-hidden": "true" });
  cut.hidden = true;
  drop.hidden = true;
  ratio.hidden = true;
  overlay.append(cut, drop, ratio);
  content.append(implicit, layer, overlay);
  frame.append(rendered, content);
  stage.append(frame);
  viewport.append(stage);
  const banner = el("p", "opf-lx-banner", { role: "alert" });
  banner.hidden = true;
  const footer = el("div", "opf-lx-footer");
  const status = el("p", "opf-lx-status", { role: "status", "aria-live": "polite" });
  const alert = el("p", "opf-lx-alert", { role: "alert" });
  const zoombar = el("div", "opf-lx-zoombar", { role: "group", "aria-label": "Zoom" });
  const zoomOut = dom.button("opf-lx-zoom-button", { label: "Zoom out", iconName: "ZoomOut", size: 16 });
  const zoomLabel = el("span", "opf-lx-zoom-label", { "aria-live": "off" });
  const zoomIn = dom.button("opf-lx-zoom-button", { label: "Zoom in", iconName: "ZoomIn", size: 16 });
  const zoomFit = dom.button("opf-lx-zoom-button", { label: "Fit to screen", iconName: "Maximize", size: 16 });
  zoombar.append(zoomOut, zoomLabel, zoomIn, zoomFit);
  footer.append(status, alert, zoombar);
  root.append(banner, viewport, footer);
  container.append(root);

  const keyed = new Map();
  let geo = layoutBoxes(model.record);
  let hover = null;
  let zoom = 1;
  let spaceHeld = false;
  let drag = null;
  let pending = null;
  let pan = null;
  let divider = null;
  let menu = null;
  let renameInput = null;
  let headingMenu = null;
  let previewToken = 0;
  let previewTimer = 0;
  let lastPreview = "";

  // --- geometry helpers -------------------------------------------------------------------------------------------------------
  const unit = (event) => {
    const box = content.getBoundingClientRect();
    return { x: (event.clientX - box.left) / (box.width || 1), y: (event.clientY - box.top) / (box.height || 1) };
  };
  const boxOf = (path) => geo.nodes.find((box) => samePath(box.path, path));
  const chainAt = (point, skip) => geo.nodes.filter((box) => inside(box, point, 0.0005) && !(skip && skip(box))).sort((a, b) => a.depth - b.depth);
  const nodeElement = (path) => keyed.get(`n:${pathKey(path)}`);
  const isSelected = (path) => model.selection.some((entry) => samePath(entry, path));

  function setBox(node, box, pad = 0) {
    node.style.left = pct(box.x - pad);
    node.style.top = pct(box.y - pad);
    node.style.width = pct(box.w + 2 * pad);
    node.style.height = pct(box.h + 2 * pad);
  }

  // --- the descriptions a screen reader hears ---------------------------------------------------------------------------------
  function describeNode(box) {
    const { entry, path, direction } = box;
    const list = listAt(model.record, path.slice(0, -1)) ?? [];
    const place = `${path[path.length - 1] + 1} of ${list.length} in a ${direction}`;
    const issues = model.findingsFor(path);
    const problem = issues.length ? `. ${issues.length === 1 ? "1 finding" : `${issues.length} findings`}: ${issues[0].message}` : "";
    if (isSplit(entry)) return `${entry.direction === "row" ? "Row" : "Column"} split of ${(entry.regions ?? []).length}, ${place}${problem}`;
    return `${entry.name}, ${isHeading(entry) ? "heading region" : "region"}, size ${SIZE_LABEL(entry, direction)}, ${place}${problem}`;
  }

  // --- render ---------------------------------------------------------------------------------------------------------------
  function ensure(key, create, seen) {
    let node = keyed.get(key);
    if (!node) { node = create(); keyed.set(key, node); }
    seen.add(key);
    return node;
  }
  function makeNode() {
    const node = el("div", "opf-lx-node");
    node.append(el("span", "opf-lx-label", { "aria-hidden": "true" }));
    node.addEventListener("click", (event) => { if (event.detail === 0 && node.dataset.path !== undefined) model.select([node.dataset.path.split(".").map(Number)]); });
    return node;
  }
  function makeDivider(key) {
    const node = el("div", "opf-lx-divider");
    node.dataset.key = key;
    node.addEventListener("pointerdown", (event) => startResize(event, node));
    node.addEventListener("dblclick", () => { if (node._info?.draggable) model.equalize(node._info.listPath, node._info.index); });
    node.addEventListener("keydown", (event) => dividerKey(event, node));
    return node;
  }
  function makeSlot() {
    const node = dom.button("opf-lx-slot", {});
    node.append(dom.icon("Plus", 14));
    node.addEventListener("click", () => {
      const info = node._info;
      if (!info) return;
      if (model.insertRegion(info.listPath, info.index)) model.setTool("select");
    });
    return node;
  }

  function render() {
    // Focus that is on a box (or the frame) follows the selection afterwards; a divider, slot, menu or field keeps its own.
    const keepFocus = doc.activeElement === frame || Boolean(doc.activeElement?.classList?.contains("opf-lx-node"));
    geo = layoutBoxes(model.record);
    const seen = new Set();
    const order = [];
    const primary = model.primary;
    const tabStop = primary && boxOf(primary) ? pathKey(primary) : geo.nodes[0] ? pathKey(geo.nodes[0].path) : null;
    for (const box of geo.nodes) {
      const key = `n:${pathKey(box.path)}`;
      const node = ensure(key, makeNode, seen);
      const split = isSplit(box.entry);
      const issues = model.findingsFor(box.path);
      node.dataset.path = pathKey(box.path);
      node.dataset.kind = split ? "split" : "region";
      node.dataset.depth = String(box.depth);
      if (split) { delete node.dataset.name; node.dataset.direction = box.entry.direction === "row" ? "row" : "column"; }
      else { node.dataset.name = box.entry.name; delete node.dataset.direction; }
      node.dataset.heading = !split && isHeading(box.entry) ? "true" : "false";
      node.dataset.finding = issues.length ? issues[0].severity : model.findingsWithin(box.path).length ? "within" : "";
      node.classList.toggle("is-selected", isSelected(box.path));
      node.classList.toggle("is-dragging", Boolean(drag?.valid?.some((path) => isPrefix(path, box.path))));
      node.setAttribute("role", split ? "group" : "button");
      node.setAttribute("aria-label", describeNode(box));
      if (split) node.removeAttribute("aria-pressed"); else node.setAttribute("aria-pressed", String(isSelected(box.path)));
      node.tabIndex = pathKey(box.path) === tabStop ? 0 : -1;
      setBox(node, box);
      // The name and size are a chip outside the box's top edge (a split's tag sits at the top right), so they never cover the content drawn
      // inside. The words come from data attributes (CSS content), so the box's own accessible name is the one description a screen reader hears.
      const label = node.firstElementChild;
      label.dataset.text = split ? (box.entry.direction === "row" ? "row" : "column") : box.entry.name;
      label.dataset.size = SIZE_LABEL(box.entry, box.direction);
      let badge = node.querySelector(":scope > .opf-lx-badge");
      if (issues.length && !badge) { badge = el("span", "opf-lx-badge", { "aria-hidden": "true" }); badge.append(dom.icon("CircleX", 14)); node.append(badge); }
      if (badge) { if (issues.length) badge.title = issues.map((issue) => issue.message).join("\n"); else badge.remove(); }
      let wire = node.querySelector(":scope > .opf-lx-wire");
      const wanted = model.preview && !split;
      const wireKey = wanted ? JSON.stringify([isHeading(box.entry), box.entry.accepts, box.entry.flow, box.entry.max]) : "";
      if (wire && (!wanted || wire.dataset.key !== wireKey)) { wire.remove(); wire = null; }
      if (wanted && !wire) {
        if (isHeading(box.entry)) { wire = el("div", "opf-lx-wire opf-lx-wire-heading", { "aria-hidden": "true" }); wire.append(el("span", "opf-lx-bar"), el("span", "opf-lx-bar opf-lx-bar-short")); }
        else wire = buildWireframe(dom, box.entry.accepts, { count: box.entry.flow === "none" ? 1 : Math.min(3, box.entry.max ?? 3), flow: box.entry.flow ?? "auto" });
        wire.dataset.key = wireKey;
        node.append(wire);
      }
      order.push(node);
    }
    // Dividers: the gap between two siblings.
    for (const info of geo.dividers) {
      const key = `d:${pathKey(info.listPath)}:${info.index}`;
      const node = ensure(key, () => makeDivider(key), seen);
      node._info = info;
      node.dataset.orientation = info.direction === "row" ? "vertical" : "horizontal";
      node.dataset.depth = String(info.depth);
      node.dataset.fixed = info.draggable ? "false" : "true";
      node.dataset.active = divider?.key === key ? "true" : "false";
      setBox(node, info);
      node.setAttribute("role", "separator");
      node.setAttribute("aria-orientation", info.direction === "row" ? "vertical" : "horizontal");
      const first = [...info.listPath, info.index], second = [...info.listPath, info.index + 1];
      if (info.draggable) {
        const total = info.a + info.b;
        node.tabIndex = model.tool === "select" || model.tool === "hand" ? 0 : -1;
        node.setAttribute("aria-label", `Resize ${model.describe(first)} and ${model.describe(second)}`);
        node.setAttribute("aria-valuemin", "0");
        node.setAttribute("aria-valuemax", "100");
        node.setAttribute("aria-valuenow", String(Math.round(info.a / total * 100)));
        node.setAttribute("aria-valuetext", `${trim(info.a)} : ${trim(info.b)}`);
        node.removeAttribute("aria-disabled");
        node.title = "Drag to resize. Double-click to make both sides equal.";
      } else {
        node.removeAttribute("tabindex");
        for (const name of ["aria-label", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext", "title"]) node.removeAttribute(name);
        node.setAttribute("aria-disabled", "true");
      }
      order.push(node);
    }
    // Insert slots, only for the Insert tool.
    if (model.tool === "insert" && !model.readOnly) {
      geo.slots.forEach((slot) => {
        const key = `s:${pathKey(slot.listPath)}:${slot.index}`;
        const node = ensure(key, makeSlot, seen);
        node._info = slot;
        node.dataset.orientation = slot.direction === "row" ? "vertical" : "horizontal";
        node.dataset.depth = String(slot.depth);
        const list = listAt(model.record, slot.listPath) ?? [];
        node.disabled = list.length >= 12;
        const before = list[slot.index - 1], after = list[slot.index];
        const names = (entry) => (isSplit(entry) ? `the ${entry.direction} split` : entry.name);
        node.setAttribute("aria-label", before && after ? `Insert a region between ${names(before)} and ${names(after)}` : after ? `Insert a region before ${names(after)}` : before ? `Insert a region after ${names(before)}` : "Insert a region");
        const thick = slot.direction === "row" ? { x: slot.x, y: slot.y, w: 0, h: slot.h } : { x: slot.x, y: slot.y, w: slot.w, h: 0 };
        node.style.left = slot.direction === "row" ? `calc(${pct(thick.x)} - var(--opf-lx-slot) / 2)` : pct(thick.x);
        node.style.top = slot.direction === "row" ? pct(thick.y) : `calc(${pct(thick.y)} - var(--opf-lx-slot) / 2)`;
        node.style.width = slot.direction === "row" ? "var(--opf-lx-slot)" : pct(thick.w);
        node.style.height = slot.direction === "row" ? pct(thick.h) : "var(--opf-lx-slot)";
        order.push(node);
      });
    }
    for (const [key, node] of keyed) if (!seen.has(key)) { node.remove(); keyed.delete(key); }
    let cursor = null;
    for (const node of order) {
      const expected = cursor ? cursor.nextSibling : layer.firstChild;
      if (node.parentNode !== layer || expected !== node) layer.insertBefore(node, expected);
      cursor = node;
    }
    // The implicit title band and the layout-level findings.
    implicit.hidden = !geo.implicitTitle;
    if (geo.implicitTitle) setBox(implicit, geo.implicitTitle);
    const layoutIssues = model.findingsFor([]);
    banner.hidden = !layoutIssues.length;
    banner.replaceChildren();
    if (layoutIssues.length) { banner.append(dom.icon("CircleX", 14), el("span", "", { text: layoutIssues.map((issue) => issue.message).join(" ") })); }
    root.dataset.tool = model.tool;
    root.dataset.density = model.density;
    root.dataset.preview = String(model.preview);
    root.dataset.readonly = String(model.readOnly);
    paintHover();
    paintStatus();
    syncRename();
    syncHeadingMenu();
    schedulePreview();
    if (keepFocus) syncFocus();
  }
  const trim = (value) => String(Math.round(value * 1000) / 1000);

  function paintHover() {
    for (const node of layer.querySelectorAll(".opf-lx-node[data-hover]")) node.removeAttribute("data-hover");
    if (hover && !drag && !divider) nodeElement(hover)?.setAttribute("data-hover", "true");
  }
  function paintStatus() {
    const notice = model.notice;
    const def = LAYOUT_TOOL_DEFS.find((tool) => tool.id === model.tool);
    status.textContent = notice && notice.kind !== "error" ? notice.message : def?.help ?? "";
    status.dataset.live = notice && notice.kind !== "error" ? "true" : "false";
    alert.textContent = notice?.kind === "error" ? notice.message : "";
    alert.hidden = !alert.textContent;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }
  /** Put DOM focus on the selected box (or the frame, when nothing is selected), after the structure changed under it. */
  function syncFocus() {
    if (renameInput || menu || headingMenu) return;
    const primary = model.primary;
    const next = primary ? nodeElement(primary) : null;
    if (next) { if (doc.activeElement !== next) next.focus({ preventScroll: true }); }
    else if (doc.activeElement !== frame) frame.focus({ preventScroll: true });
  }

  // --- pointer: select, split, drag, resize, pan -----------------------------------------------------------------------------------
  function target(chain, event) {
    if (!chain.length) return null;
    const deepest = chain[chain.length - 1];
    const primary = model.primary;
    // A split is selected: the next click goes one level in, to the box of the chain under the pointer.
    if (primary && !event.shiftKey) {
      const at = chain.findIndex((box) => samePath(box.path, primary));
      if (at >= 0 && isSplit(chain[at].entry) && at < chain.length - 1) return chain[at + 1];
    }
    return deepest;
  }
  const panMode = () => model.tool === "hand" || spaceHeld;

  viewport.addEventListener("pointerdown", (event) => {
    if (!panMode() || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    pan = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    root.dataset.panning = "true";
    viewport.setPointerCapture?.(event.pointerId);
  }, true);
  viewport.addEventListener("pointermove", (event) => {
    if (!pan) return;
    viewport.scrollLeft = pan.left - (event.clientX - pan.x);
    viewport.scrollTop = pan.top - (event.clientY - pan.y);
  });
  const endPan = () => { pan = null; delete root.dataset.panning; };
  viewport.addEventListener("pointerup", endPan);
  viewport.addEventListener("pointercancel", endPan);

  content.addEventListener("pointerdown", (event) => {
    if (event.target.closest?.(".opf-lx-divider, .opf-lx-slot, .opf-lx-menu, .opf-lx-rename") || panMode()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = unit(event);
    const chain = chainAt(point);
    menu?.close({ restore: false });
    if (model.tool === "split-row" || model.tool === "split-column") {
      const region = [...chain].reverse().find((box) => !isSplit(box.entry));
      if (!region) { model.notify("Click inside a region to split it.", "error"); return; }
      event.preventDefault();
      const axis = model.tool === "split-row" ? "row" : "column";
      if (model.splitRegion(region.path, axis)) model.setTool("select");
      focusPrimary();
      return;
    }
    if (model.tool !== "select") return;
    const hit = target(chain, event);
    if (!hit) { model.select([]); frame.focus({ preventScroll: true }); return; }
    if (event.shiftKey) { model.selectAdd(hit.path); focusPrimary(); return; }
    if (!isSelected(hit.path)) model.select([hit.path]);
    focusPrimary();
    if (model.readOnly) return;
    const paths = isSelected(hit.path) ? model.selection.map((path) => [...path]) : [hit.path];
    pending = { x: event.clientX, y: event.clientY, id: event.pointerId, paths, type: event.pointerType };
    content.setPointerCapture?.(event.pointerId);
  });
  // The margin of the slide, outside the content box: a click there selects the layout.
  frame.addEventListener("pointerdown", (event) => {
    if (event.target !== frame || panMode() || model.tool !== "select" || (event.pointerType === "mouse" && event.button !== 0)) return;
    menu?.close({ restore: false });
    model.select([]);
    frame.focus({ preventScroll: true });
  });
  content.addEventListener("pointermove", (event) => {
    if (pending && !drag && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > DRAG_DISTANCE) startDrag();
    if (drag) { moveDrag(event); return; }
    if (event.pointerType === "touch") return;
    // Hover: the node a click would select, and the guide of the split tools.
    const point = unit(event);
    const chain = chainAt(point);
    let next = null;
    if (model.tool === "select") next = target(chain, event)?.path ?? null;
    else if (model.tool === "split-row" || model.tool === "split-column") next = [...chain].reverse().find((box) => !isSplit(box.entry))?.path ?? null;
    if (!(next === hover || (next && hover && samePath(next, hover)))) { hover = next; paintHover(); }
    paintCut();
  });
  content.addEventListener("pointerleave", () => { hover = null; paintHover(); paintCut(); });
  content.addEventListener("pointerup", (event) => {
    if (drag) { finishDrag(event); return; }
    pending = null;
  });
  content.addEventListener("pointercancel", () => { cancelDrag(); pending = null; });
  content.addEventListener("dblclick", (event) => {
    if (model.tool !== "select" || event.target.closest?.(".opf-lx-divider, .opf-lx-slot, .opf-lx-rename") || model.readOnly) return;
    const region = [...chainAt(unit(event))].reverse().find((box) => !isSplit(box.entry));
    if (region) { model.select([region.path]); model.requestRename(region.path, "canvas"); }
  });
  function paintCut() {
    const tool = model.tool;
    const box = (tool === "split-row" || tool === "split-column") && hover ? boxOf(hover) : null;
    cut.hidden = !box;
    if (!box) return;
    if (tool === "split-row") Object.assign(cut.style, { left: pct(box.x + box.w / 2), top: pct(box.y), width: "0", height: pct(box.h) });
    else Object.assign(cut.style, { left: pct(box.x), top: pct(box.y + box.h / 2), width: pct(box.w), height: "0" });
    cut.dataset.axis = tool === "split-row" ? "row" : "column";
  }
  function focusPrimary() {
    const primary = model.primary;
    const node = primary && nodeElement(primary);
    (node ?? frame).focus({ preventScroll: true });
  }

  // --- drag a region to reorder it or move it into a split ----------------------------------------------------------------------
  function startDrag() {
    if (!pending || model.readOnly) { pending = null; return; }
    const paths = pending.paths.filter((path) => nodeAt(model.record, path));
    if (!paths.length) { pending = null; return; }
    const ghost = el("div", "opf-lx-ghost", { "aria-hidden": "true", text: paths.length > 1 ? `${paths.length} regions` : model.describe(paths[0]) });
    root.append(ghost);
    drag = { paths, valid: paths, ghost, drop: null };
    root.dataset.dragging = "true";
    doc.addEventListener("keydown", dragKey, true);
    paintHover();
    render();
  }
  function dropAt(point) {
    const skip = (box) => drag.paths.some((path) => isPrefix(path, box.path));
    const chain = chainAt(point, skip);
    const hit = chain[chain.length - 1];
    if (!hit) return null;
    let listPath, index, into = null;
    if (isSplit(hit.entry)) {
      listPath = hit.path;
      const row = hit.entry.direction === "row";
      const kids = geo.nodes.filter((box) => box.path.length === hit.path.length + 1 && isPrefix(hit.path, box.path) && !skip(box));
      index = (hit.entry.regions ?? []).length;
      for (const box of kids) if ((row ? point.x : point.y) < (row ? box.x + box.w / 2 : box.y + box.h / 2)) { index = box.path[box.path.length - 1]; break; }
      into = hit.path;
    } else {
      listPath = hit.path.slice(0, -1);
      const row = hit.direction === "row";
      const after = (row ? point.x : point.y) > (row ? hit.x + hit.w / 2 : hit.y + hit.h / 2);
      index = hit.path[hit.path.length - 1] + (after ? 1 : 0);
    }
    const slot = geo.slots.find((entry) => samePath(entry.listPath, listPath) && entry.index === index);
    let reason = "";
    let noop = false;
    try {
      const moved = moveNodes(model.record, drag.paths, listPath, index);
      noop = JSON.stringify(moved.record) === JSON.stringify(model.record);
    } catch (error) {
      if (!(error instanceof LayoutOperationError)) throw error;
      reason = error.message;
    }
    return { listPath, index, slot, into, reason, noop };
  }
  function moveDrag(event) {
    drag.ghost.style.left = `${event.clientX - root.getBoundingClientRect().left + 12}px`;
    drag.ghost.style.top = `${event.clientY - root.getBoundingClientRect().top + 12}px`;
    const found = dropAt(unit(event));
    drag.drop = found;
    for (const node of layer.querySelectorAll("[data-into]")) node.removeAttribute("data-into");
    if (!found?.slot) { drop.hidden = true; return; }
    drop.hidden = false;
    drop.dataset.orientation = found.slot.direction === "row" ? "vertical" : "horizontal";
    drop.dataset.state = found.reason ? "refused" : found.noop ? "same" : "ok";
    drop.title = found.reason;
    const slot = found.slot;
    if (slot.direction === "row") Object.assign(drop.style, { left: pct(slot.x), top: pct(slot.y), width: "0", height: pct(slot.h) });
    else Object.assign(drop.style, { left: pct(slot.x), top: pct(slot.y), width: pct(slot.w), height: "0" });
    if (found.into && !found.reason) nodeElement(found.into)?.setAttribute("data-into", "true");
  }
  function finishDrag() {
    const outcome = drag?.drop;
    const paths = drag?.paths;
    endDrag();
    if (!outcome || !paths) return;
    if (outcome.reason) { model.notify(outcome.reason, "error"); return; }
    if (outcome.noop) return;
    model.move(paths, outcome.listPath, outcome.index);
    focusPrimary();
  }
  function endDrag() {
    doc.removeEventListener("keydown", dragKey, true);
    drag?.ghost.remove();
    drag = null;
    pending = null;
    drop.hidden = true;
    delete root.dataset.dragging;
    for (const node of layer.querySelectorAll("[data-into]")) node.removeAttribute("data-into");
    render();
  }
  function cancelDrag() { if (drag) endDrag(); }
  function dragKey(event) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelDrag(); model.notify("Move cancelled."); } }

  // --- dividers ------------------------------------------------------------------------------------------------------------------
  function startResize(event, node) {
    const info = node._info;
    if (!info?.draggable || model.readOnly || panMode() || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!model.beginGesture("Resized")) return;
    const startRecord = model.record;
    divider = { key: node.dataset.key, info, startRecord, node, id: event.pointerId };
    node.setPointerCapture?.(event.pointerId);
    node.focus({ preventScroll: true });
    node.dataset.active = "true";
    const onMove = (move) => {
      const p = unit(move);
      const along = info.direction === "row" ? p.x : p.y;
      const fraction = (along - info.pairStart) / info.pairLength;
      const sizes = resizeSizes(startRecord, info.listPath, info.index, fraction, { free: move.shiftKey });
      if (!sizes) return;
      const next = setPairSizes(startRecord, info.listPath, info.index, sizes.a, sizes.b).record;
      model.updateGesture(next, `Resize ${sizes.label}`);
      ratio.hidden = false;
      ratio.textContent = sizes.label;
      ratio.style.left = pct(info.x + info.w / 2);
      ratio.style.top = pct(info.y + info.h / 2);
      divider.label = sizes.label;
    };
    const finish = (commit) => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.removeEventListener("pointercancel", onCancel);
      doc.removeEventListener("keydown", onKey, true);
      ratio.hidden = true;
      const label = divider?.label;
      divider = null;
      if (commit) model.endGesture(label ? `Resized to ${label}` : "Resized"); else model.cancelGesture();
      node.dataset.active = "false";
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (key) => { if (key.key === "Escape") { key.preventDefault(); key.stopPropagation(); finish(false); } };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", onCancel);
    doc.addEventListener("keydown", onKey, true);
  }
  function dividerKey(event, node) {
    const info = node._info;
    if (!info?.draggable || event.altKey || event.metaKey || event.ctrlKey) return;
    const keys = info.direction === "row" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    const step = event.key === keys[0] ? -1 : event.key === keys[1] ? 1 : 0;
    if (step) { event.preventDefault(); event.stopPropagation(); model.nudge(info.listPath, info.index, step, event.shiftKey); return; }
    if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); model.equalize(info.listPath, info.index); }
  }

  // --- context menu ----------------------------------------------------------------------------------------------------------------
  function openContextMenu(point, returnFocus) {
    menu?.close({ restore: false });
    const paths = model.selection;
    if (!paths.length) return;
    menu = openMenu(dom, root, { x: point.x, y: point.y, label: "Region actions", returnFocus, onClose: () => { menu = null; }, items: nodeMenuItems(model, paths, "canvas", win) });
  }
  content.addEventListener("contextmenu", (event) => {
    if (model.tool !== "select" || event.target.closest?.(".opf-lx-menu, .opf-lx-rename")) return;
    const chain = chainAt(unit(event));
    const hit = chain[chain.length - 1];
    if (!hit) return;
    event.preventDefault();
    if (!isSelected(hit.path)) model.select([hit.path]);
    openContextMenu({ x: event.clientX, y: event.clientY }, nodeElement(hit.path) ?? frame);
  });

  // --- rename in place -----------------------------------------------------------------------------------------------------------
  function syncRename() {
    const request = model.renaming;
    const wanted = request?.surface === "canvas" ? request.path : null;
    if (renameInput && (!wanted || renameInput._path !== pathKey(wanted))) { const input = renameInput; renameInput = null; input.remove(); if (!wanted) syncFocusSoon(); }
    if (!wanted || renameInput) return;
    const box = boxOf(wanted);
    const node = nodeElement(wanted);
    if (!box || !node || isSplit(box.entry)) { model.requestRename(null); return; }
    const input = el("input", "opf-lx-rename", { type: "text", value: box.entry.name, "aria-label": `Rename ${box.entry.name}`, spellcheck: "false", autocomplete: "off" });
    input._path = pathKey(wanted);
    input.style.left = pct(box.x);
    input.style.top = pct(box.y);
    input.style.width = pct(box.w);
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      model.requestRename(null);
      if (commit && value && value !== box.entry.name) model.setProperty(wanted, "name", value, { coalesce: null });
      focusPrimary();
    };
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") { event.preventDefault(); finish(true); }
      else if (event.key === "Escape") { event.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", () => finish(true));
    renameInput = input;
    overlay.append(input);
    input.focus();
    input.select();
  }
  const syncFocusSoon = () => win.requestAnimationFrame?.(() => { if (!renameInput) focusPrimary(); });

  // --- the heading tool's menu -----------------------------------------------------------------------------------------------------
  function syncHeadingMenu() {
    if (model.tool !== "heading") { if (headingMenu) { const open = headingMenu; headingMenu = null; open.close({ restore: false }); } return; }
    if (headingMenu) return;
    const names = new Set(geo.nodes.filter(({ entry }) => isHeading(entry)).map(({ entry }) => entry.name));
    const frameBox = frame.getBoundingClientRect();
    headingMenu = openMenu(dom, root, {
      x: frameBox.left + 12, y: frameBox.top + 12, label: "Heading regions", returnFocus: frame, className: "opf-lx-heading-menu",
      onClose: () => { headingMenu = null; if (model.tool === "heading") model.setTool("select"); },
      items: HEADING_ITEMS.map((item) => ({
        label: item.label, role: "menuitemcheckbox", checked: names.has(item.name), hint: item.name === "title" ? "adds a row on top" : "needs a title",
        onSelect: () => { model.toggleHeading(item.name); },
      })),
    });
  }

  // --- zoom ------------------------------------------------------------------------------------------------------------------------
  function setZoom(value) {
    const next = Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], value));
    zoom = next;
    root.style.setProperty("--opf-lx-zoom", String(zoom));
    root.dataset.zoomed = String(zoom !== 1);
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }
  const stepZoom = (direction) => {
    const at = ZOOMS.findIndex((value) => value >= zoom - 1e-9);
    const index = direction > 0 ? (ZOOMS[at] > zoom + 1e-9 ? at : at + 1) : at - 1;
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, index))]);
  };
  zoomOut.addEventListener("click", () => stepZoom(-1));
  zoomIn.addEventListener("click", () => stepZoom(1));
  zoomFit.addEventListener("click", () => setZoom(1));
  viewport.addEventListener("wheel", (event) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); stepZoom(event.deltaY < 0 ? 1 : -1); } }, { passive: false });
  setZoom(1);

  // --- preview with the host's renderer ---------------------------------------------------------------------------------------------
  function schedulePreview() {
    if (!model.preview || typeof options.toSvg !== "function") {
      win.clearTimeout(previewTimer);
      if (rendered.firstChild) rendered.replaceChildren();
      root.dataset.rendered = "false";
      previewToken++;
      lastPreview = "";
      return;
    }
    const key = JSON.stringify(model.record);
    if (key === lastPreview) return;
    lastPreview = key;
    win.clearTimeout(previewTimer);
    const token = ++previewToken;
    previewTimer = win.setTimeout(() => drawPreview(token), 120);
  }
  function drawPreview(token) {
    if (token !== previewToken || !model.preview) return;
    if (model.findings.some((finding) => finding.severity === "error")) { rendered.replaceChildren(); root.dataset.rendered = "false"; return; }
    const deck = sampleDeck(model.record);
    const renderOptions = (typeof options.renderOptions === "function" ? options.renderOptions() : options.renderOptions) ?? {};
    const show = (text) => {
      if (token !== previewToken) return;
      const parsed = new win.DOMParser().parseFromString(String(text), "image/svg+xml");
      const svg = parsed.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) { root.dataset.rendered = "false"; return; }
      for (const script of svg.querySelectorAll("script, foreignObject")) script.remove();
      svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      rendered.replaceChildren(doc.importNode(svg, true));
      root.dataset.rendered = "true";
    };
    const fail = (error) => { if (token !== previewToken) return; rendered.replaceChildren(); root.dataset.rendered = "false"; model.notify(`Preview: ${error?.message ?? error}`, "error"); };
    whenFontsReady(options.fonts, deck, {
      renderOptions, isCurrent: () => token === previewToken,
      loading: () => { root.dataset.rendered = "loading"; },
      ready: async () => { show(await options.toSvg(deck, 1, { ...renderOptions, fonts: options.fonts, text: "system", trace: false })); },
      failed: fail,
    });
  }

  // --- keyboard ---------------------------------------------------------------------------------------------------------------------
  // Focus moves by script (to the selected box), so a press must not move it to the frame first.
  content.addEventListener("mousedown", (event) => { if (!event.target.closest?.(".opf-lx-rename")) event.preventDefault(); });
  content.addEventListener("focusin", (event) => {
    const node = event.target.closest?.(".opf-lx-node");
    if (node && node.dataset.path !== undefined && !pending && !drag) {
      const path = node.dataset.path.split(".").map(Number);
      if (!isSelected(path)) model.select([path]);
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.target === renameInput || event.opfLayoutHandled) return;
    if (event.key === " " && !isTypingTarget(event.target) && (event.target === frame || event.target.closest?.(".opf-lx-node, .opf-lx-viewport")) && !event.repeat) {
      event.preventDefault();
      spaceHeld = true;
      root.dataset.space = "true";
      return;
    }
    if (handleGlobalShortcut(event, model)) return;
    if (isTypingTarget(event.target)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.opfLayoutHandled = true;
      if (menu) { menu.close(); return; }
      if (drag) { cancelDrag(); return; }
      if (model.tool !== "select") { model.setTool("select"); return; }
      model.selectParent();
      focusPrimary();
      return;
    }
    const onNode = event.target === frame || event.target.closest?.(".opf-lx-node");
    if (!onNode) return;
    if (handleSelectionShortcut(event, model, "canvas")) return;
    const arrows = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (arrows[event.key] && !event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault();
      model.selectSibling(arrows[event.key]);
      focusPrimary();
    } else if (event.key === "Enter" && !event.shiftKey) {
      const primary = model.primary;
      if (!primary) return;
      event.preventDefault();
      if (model.tool === "split-row" || model.tool === "split-column") {
        const node = nodeAt(model.record, primary);
        if (node && !isSplit(node) && model.splitRegion(primary, model.tool === "split-row" ? "row" : "column")) model.setTool("select");
        focusPrimary();
      } else if (model.selectChild()) focusPrimary();
    } else if ((event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) && model.primary) {
      event.preventDefault();
      const box = frame.getBoundingClientRect();
      const at = boxOf(model.primary);
      const node = nodeElement(model.primary);
      openContextMenu({ x: box.left + (at ? (at.x + at.w / 2) * box.width : 40), y: box.top + (at ? (at.y + at.h / 2) * box.height : 40) }, node ?? frame);
    }
  });
  root.addEventListener("keyup", (event) => { if (event.key === " " && spaceHeld) { spaceHeld = false; delete root.dataset.space; } });
  root.addEventListener("focusout", () => { spaceHeld = false; delete root.dataset.space; });

  const unsubscribe = model.subscribe((event) => {
    if (event.type === "notice") { paintStatus(); return; }
    if (event.type === "load") { hover = null; }
    render();
  });
  render();

  return {
    element: root,
    model,
    refresh: render,
    setZoom,
    getZoom: () => zoom,
    focus() { focusPrimary(); },
    destroy() {
      unsubscribe();
      win.clearTimeout(previewTimer);
      previewToken++;
      cancelDrag();
      menu?.close({ restore: false });
      headingMenu?.close({ restore: false });
      root.remove();
      if (ownModel) model.destroy();
    },
  };
}
