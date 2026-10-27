// CE-20: the Studio's canvas. The slide is drawn by the existing canvas (`createCanvasEditor`, with passive targets: it keeps its text editing,
// crop and properties, while selection is drawn here) inside the kit viewport (zoom steps, fit, fit width, pinch, Space and the hand tool).
// Over it, the kit overlay: the hover outline, the outline of the selection's container, one box per selected node with a label chip above the
// primary, findings badges, the dividers of the selected container, the drop line and "into" highlight while dragging, the ratio badge while
// resizing, and the (empty) marker layer. Every box of a selectable node is a real focusable element (`role="button"`, `aria-pressed`), so
// the slide works by keyboard and a screen reader hears what is selected; the SVG stays `aria-hidden`.
//
// Boxes come from the slide adapter's scene (CE-19) in slide units, so the overlay never measures the SVG. Slides are auto-layout (D2): a drag
// lands in a container at an index (the drop line), never at coordinates, and a divider changes track weights, never a box.
import { createViewport, stepZoom } from "./studio-kit/viewport.js";
import { createKeyedLayer, createOverlay, dividerKeyAction, paintBadge, paintDivider, paintSelectable, ratioLabel, setBox } from "./studio-kit/overlay.js";
import { createDragController, dragGhost, trackPointer } from "./studio-kit/drag.js";
import { isTypingTarget, pct } from "./studio-kit/dom.js";
import { drawnTracks } from "./slide-edits.js";

const STEPS = Object.freeze([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]);
const PAD = 24;
const CONTAINER_KINDS = new Set(["slide", "region", "group"]);
const TEXT_TYPES = new Set(["text", "list", "quote", "metric", "code", "timeline", "title", "subtitle", "tag"]);
const KIND_WORDS = { heading: "heading", region: "region", group: "group", block: "block", part: "part", implicit: "content written on the slide", slide: "slide" };
const DIRECTION_WORDS = { row: "row", column: "column" };

/** The dotted OPF path of a JSON Pointer (`/slides/0/blocks/1` → `slides.0.blocks.1`). */
export const dottedPath = (pointer) => String(pointer ?? "").split("/").slice(1).map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~")).join(".");

/**
 * Mount the canvas behavior over the Studio's elements. `elements` are `{ root, viewport, stage, frame, overlay }` (built by the shell);
 * `canvas` is the workspace's canvas editor; `adapter` the slide adapter; `studio` the controller (selection, commands, announcements).
 * Returns `{ paint, paintHover, zoom, setZoom, step, fit, setTool, focusPrimary, boxOf, textTargetOf, beginInsertDrag, setEnabled, destroy }`.
 */
export function createStudioCanvas({ dom, elements, canvas, adapter, studio }) {
  const { root, viewport, stage, frame, overlay } = elements;
  const doc = root.ownerDocument, win = doc.defaultView;
  const { el } = dom;
  const p = dom.prefix;
  const layer = el("div", `${p}-layer`);
  const dividers = el("div", `${p}-dividers`);
  const chip = el("div", `${p}-chip`, { "aria-hidden": "true" });
  chip.hidden = true;
  const parentOutline = el("div", `${p}-parent`, { "aria-hidden": "true" });
  parentOutline.hidden = true;
  const hoverBox = el("div", `${p}-hover`, { "aria-hidden": "true" });
  hoverBox.hidden = true;
  const empty = el("div", `${p}-empty`);
  empty.hidden = true;
  overlay.append(parentOutline, hoverBox, layer, dividers, chip, empty);
  const marks = createOverlay(dom, overlay, { markers: true });
  const keyed = createKeyedLayer(layer);
  const keyedDividers = createKeyedLayer(dividers);
  let tool = "select";
  let enabled = true;
  let hover = null;
  let resize = null;
  let longPress = null;
  let insertDrag = null;
  let destroyed = false;

  // --- the viewport (zoom and pan) -------------------------------------------------------------------------------------------------------
  const fitted = () => {
    const width = viewport.clientWidth - 2 * PAD, height = viewport.clientHeight - 2 * PAD;
    const aspect = Number.parseFloat(root.style.getPropertyValue("--opf-studio-aspect")) || 16 / 9;
    return { width: Math.max(1, Math.min(width, height * aspect)), height: Math.max(1, Math.min(height, width / aspect)), room: Math.max(1, width) };
  };
  const view = createViewport(viewport, {
    root, steps: STEPS, zoomVar: "--opf-studio-zoom", wheel: false, pinch: true,
    panEnabled: () => tool === "hand",
    fitZoom: (mode) => (mode === "width" ? Math.max(STEPS[0], Math.min(STEPS.at(-1), fitted().room / fitted().width)) : 1),
    onZoom: (value) => studio.onZoom?.(value),
  });
  // Ctrl or Cmd with a mouse wheel steps the zoom; a trackpad pinch (small ctrlKey wheel deltas) zooms smoothly around the pointer.
  const onWheel = (event) => {
    if (!(event.ctrlKey || event.metaKey) || !enabled) return;
    event.preventDefault();
    if (Math.abs(event.deltaY) < 40 && event.deltaMode === 0) view.setZoom(view.zoom * Math.exp(-event.deltaY * 0.01), { anchor: event });
    else view.setZoom(stepZoom(view.zoom, event.deltaY < 0 ? 1 : -1, STEPS), { anchor: event });
  };
  viewport.addEventListener("wheel", onWheel, { passive: false });

  // --- geometry ----------------------------------------------------------------------------------------------------------------------------
  const unit = (event) => view.toUnit(event, frame);
  const scene = () => adapter.scene();
  const boxEl = (key) => keyed.get(`n:${key}`);
  const isSelected = (key) => studio.selectedKeys().includes(key);

  // What a screen reader hears for a node: its label, kind and place ("Text: Start with…, block, 2 of 3 in a row"), and its findings.
  function describe(node) {
    if (node.kind === "slide") return `${node.label}${node.hidden ? ", hidden" : ""}`;
    const s = scene();
    const parent = s.node(node.parent);
    const list = parent ? s.children(parent.key).filter((child) => child.kind !== "part") : [];
    const place = parent ? `, ${list.findIndex((child) => child.key === node.key) + 1} of ${list.length} in ${parent.kind === "slide" ? "the slide" : `a ${DIRECTION_WORDS[parent.container?.direction] ?? "group"}`}` : "";
    const kind = node.kind === "block" ? "" : `, ${KIND_WORDS[node.kind] ?? node.kind}`;
    const issues = node.findings.length ? `. ${node.findings.length === 1 ? "1 finding" : `${node.findings.length} findings`}: ${node.findings[0].message}` : "";
    return `${node.label}${kind}${place}${issues}`;
  }
  const chipText = (node) => {
    if (node.kind === "group") return node.label;
    if (node.kind === "region") return node.label;
    if (node.kind === "heading" || node.kind === "slide") return node.label.split(" · ")[0];
    return node.label.split(":")[0];
  };

  // --- paint -------------------------------------------------------------------------------------------------------------------------------
  function makeBox() {
    const node = el("div", `${p}-box`);
    node.addEventListener("focus", () => {
      // Focus moved here by Tab (not by a selection change): select what has focus.
      if (node.dataset.key && !isSelected(node.dataset.key) && !studio.selecting) studio.select([node.dataset.key], { source: "keyboard" });
    });
    return node;
  }
  function makeDivider() {
    const node = el("div", `${p}-divider`);
    node.addEventListener("pointerdown", (event) => startResize(event, node));
    node.addEventListener("dblclick", (event) => { event.stopPropagation(); if (node._info?.draggable) studio.equalize(node._info.key, node._info.index); });
    node.addEventListener("keydown", (event) => dividerKey(event, node));
    return node;
  }

  /** Redraw the overlay from the scene and the selection. Cheap: elements are kept by key and only moved. */
  function paint() {
    if (destroyed) return;
    const s = scene();
    const selected = new Set(studio.selectedKeys());
    const primary = studio.primaryKey();
    const keepFocus = overlay.contains(doc.activeElement) || doc.activeElement === frame;
    const pass = keyed.begin();
    const tabStop = primary && s.node(primary)?.box ? primary : s.slideKey;
    for (const node of s.nodes) {
      if (!node.box || !(node.box.w > 0) || !(node.box.h > 0)) continue;
      if (node.kind === "part" && !selected.has(node.key)) continue;
      const box = pass.ensure(`n:${node.key}`, makeBox);
      box.dataset.key = node.key;
      box.dataset.kind = node.kind;
      box.dataset.type = node.type;
      box.dataset.depth = String(node.depth);
      box.dataset.finding = node.findings.length ? node.findings[0].severity ?? "error" : "";
      box.classList.toggle("is-primary", node.key === primary);
      paintSelectable(box, { box: node.box, selected: selected.has(node.key), pressable: true, label: describe(node), tabStop: node.key === tabStop });
      if (node.kind === "slide") box.setAttribute("aria-roledescription", "slide");
      paintBadge(dom, box, node.findings.map((finding) => finding.message));
    }
    pass.done();
    // The container outline of the primary's parent, and the label chip above the primary (outside its top edge).
    const node = primary ? s.node(primary) : null;
    const parent = node?.parent ? s.node(node.parent) : null;
    parentOutline.hidden = !(parent?.box && parent.kind !== "slide");
    if (!parentOutline.hidden) setBox(parentOutline, parent.box);
    chip.hidden = !(node?.box && node.kind !== "slide");
    if (!chip.hidden) {
      chip.textContent = chipText(node);
      chip.style.left = pct(node.box.x);
      chip.style.top = pct(node.box.y);
    }
    paintDividers(s);
    paintEmpty(s);
    paintHover();
    frame.setAttribute("aria-label", studio.frameLabel());
    if (keepFocus && !studio.editingText()) focusPrimary();
  }

  // The empty state: a slide with no content gets a prompt with Insert and Layout.
  function paintEmpty(s) {
    const content = s.nodes.filter((node) => node.kind !== "slide" && node.kind !== "heading" && node.kind !== "region" && node.kind !== "part");
    const regions = s.nodes.filter((node) => node.kind === "region");
    const show = !content.length && !regions.length && studio.layout === "studio";
    if (show === !empty.hidden) return;
    empty.hidden = !show;
    if (!show) { empty.replaceChildren(); return; }
    const insert = dom.button(`${p}-empty-button`, { text: "Insert a block", iconName: "Plus", size: 14 });
    insert.addEventListener("click", () => studio.openInsertMenu(insert));
    const layout = dom.button(`${p}-empty-button`, { text: "Choose a layout", iconName: "Columns2", size: 14 });
    layout.addEventListener("click", () => studio.openSlideMenu(layout, { apply: true }));
    empty.replaceChildren(el("p", `${p}-empty-text`, { text: "Insert a block or choose a layout" }), insert, layout);
  }

  // The dividers of the primary's container (or of the selected container): one between each pair of tracks, a grid's columns only.
  function dividerContainer(s) {
    const primary = studio.primaryKey();
    const node = primary ? s.node(primary) : null;
    if (!node) return null;
    const container = CONTAINER_KINDS.has(node.kind) && node.container?.tracks?.length >= 2 ? node : node.parent ? s.node(node.parent) : null;
    if (!container?.container || !["grid", "row", "column"].includes(container.container.mode)) return null;
    return container.container.tracks.length >= 2 ? container : null;
  }
  function paintDividers(s) {
    const pass = keyedDividers.begin();
    const owner = studio.layout === "studio" ? dividerContainer(s) : null;
    if (owner) {
      const { container, box } = owner;
      const flow = s.flowOf(owner.key);
      const drawn = flow ? drawnTracks(flow) : null;
      const row = container.direction !== "column";
      const draggable = container.resizable && !studio.readOnly && Boolean(flow);
      container.tracks.slice(0, -1).forEach((track, index) => {
        const next = container.tracks[index + 1];
        const at = (track.start + track.length + next.start) / 2;
        const node = pass.ensure(`d:${owner.key}:${index}`, makeDivider);
        const share = track.length / (track.length + next.length);
        const weights = drawn && !drawn.drawn ? [drawn.weights[index], drawn.weights[index + 1]] : null;
        node._info = { key: owner.key, index, draggable, row, pairStart: track.start, pairLength: next.start + next.length - track.start, box: row ? { x: at, y: box.y, w: 0, h: box.h } : { x: box.x, y: at, w: box.w, h: 0 } };
        node.dataset.active = resize?.node === node ? "true" : "false";
        paintDivider(node, {
          box: node._info.box, orientation: row ? "vertical" : "horizontal", draggable, tabbable: tool !== "text",
          label: `Resize ${row ? "columns" : "rows"} ${index + 1} and ${index + 2} of ${owner.label}`,
          valueNow: Math.round(share * 100), valueText: weights ? ratioLabel(weights[0], weights[1]) : `${Math.round(share * 100)}% : ${100 - Math.round(share * 100)}%`,
          title: "Drag to resize, Shift to resize freely. Double-click to make both sides equal.",
        });
      });
    }
    pass.done();
  }

  function paintHover() {
    const node = hover && !resize && !drag.active && enabled ? scene().node(hover) : null;
    hoverBox.hidden = !node?.box || isSelected(node.key) || node.kind === "slide";
    if (!hoverBox.hidden) setBox(hoverBox, node.box);
  }

  /** Put focus on the primary's box (or the slide's), after the selection or the structure changed. */
  function focusPrimary() {
    if (!enabled) return;
    const key = studio.primaryKey() ?? scene().slideKey;
    const node = boxEl(key) ?? boxEl(scene().slideKey);
    if (node && doc.activeElement !== node) {
      studio.selecting = true;
      try { node.focus({ preventScroll: true }); } finally { studio.selecting = false; }
    }
  }

  // --- pointer: select, drag, context menu, text, pan ---------------------------------------------------------------------------------------
  const drag = createDragController({
    doc, threshold: 4, holdMs: 150,
    onStart: (press) => startDrag(press),
    onStarted: () => { root.dataset.dragging = "true"; paintHover(); },
    onMove: (session, event) => moveDrag(session, event),
    onEnd: (session) => endDrag(session),
    onDrop: (session) => finishDrag(session),
    onEscape: () => studio.announce("Move cancelled."),
  });

  const chainAt = (point, deep) => adapter.hitChain(point, undefined, { parts: deep });
  const targetAt = (point, event) => {
    const deep = Boolean(event.metaKey || event.ctrlKey);
    return adapter.target(chainAt(point, deep), { primary: studio.primaryKey(), shift: event.shiftKey, deep });
  };
  const outside = (point) => point.x < 0 || point.y < 0 || point.x > 1 || point.y > 1;

  function onPointerDown(event) {
    if (!enabled || view.panMode || event.target.closest?.(`.${p}-divider, .${p}-empty, .${p}-menu`)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (studio.editingText()) return;
    const point = unit(event);
    clearLongPress();
    if (tool === "text") {
      event.preventDefault();
      studio.insertAtPoint("text", point);
      return;
    }
    const hit = targetAt(point, event);
    if (!hit) return;
    event.preventDefault();
    if (event.shiftKey) { studio.selectAdd(hit.key, { source: "canvas" }); focusPrimary(); return; }
    if (!isSelected(hit.key)) studio.select([hit.key], { source: "canvas" });
    focusPrimary();
    // A touch long-press (500 ms, no movement) opens the context menu.
    if (event.pointerType === "touch") {
      longPress = { id: event.pointerId, x: event.clientX, y: event.clientY, timer: win.setTimeout(() => { longPress = null; drag.cancel(); studio.openContextMenu({ x: event.clientX, y: event.clientY }); }, 500) };
    }
    const keys = studio.selectedKeys();
    const nodes = keys.map((key) => scene().node(key)).filter(Boolean);
    if (!studio.readOnly && nodes.length && nodes.every((node) => node.can.move)) {
      drag.press(event, { keys });
      frame.setPointerCapture?.(event.pointerId);
    }
  }
  function clearLongPress() { if (longPress) { win.clearTimeout(longPress.timer); longPress = null; } }
  function onPointerMove(event) {
    if (longPress && Math.hypot(event.clientX - longPress.x, event.clientY - longPress.y) > 8) clearLongPress();
    if (insertDrag) return;
    if (drag.move(event)) { clearLongPress(); return; }
    if (event.pointerType === "touch" || !enabled || view.panMode) return;
    const point = unit(event);
    const next = tool === "select" && !outside(point) ? targetAt(point, event)?.key ?? null : null;
    if (next !== hover) { hover = next; paintHover(); }
  }
  function onPointerUp(event) { clearLongPress(); drag.release(event); }
  function onPointerCancel() { clearLongPress(); drag.cancel(); }
  function onDoubleClick(event) {
    if (!enabled || tool !== "select" || event.target.closest?.(`.${p}-divider, .${p}-empty`)) return;
    const point = unit(event);
    const hit = targetAt(point, event);
    if (!hit) return;
    const node = hit.node;
    event.preventDefault();
    if (node.kind === "group" || node.kind === "region" || node.kind === "slide") {
      // One level in: the child under the pointer.
      const chain = chainAt(point, false);
      const at = chain.findIndex((entry) => entry.key === node.key);
      const child = chain[at + 1];
      if (child) { studio.select([child.key], { source: "canvas" }); focusPrimary(); }
      return;
    }
    if (studio.readOnly) { studio.announce("This editor is read-only."); return; }
    if (node.type === "image" && node.kind !== "part") { studio.select([node.key], { source: "canvas" }); studio.cropImage(); return; }
    if ((node.type === "chart" || node.type === "table") && node.kind !== "part") { studio.select([node.key], { source: "canvas" }); studio.editData(); return; }
    studio.beginTextEdit(node.key, { point: { clientX: event.clientX, clientY: event.clientY } });
  }
  function onContextMenu(event) {
    if (!enabled || event.target.closest?.(`.${p}-menu`)) return;
    const point = unit(event);
    const hit = outside(point) ? null : targetAt(point, event);
    event.preventDefault();
    if (hit && !isSelected(hit.key)) studio.select([hit.key], { source: "canvas" });
    focusPrimary();
    studio.openContextMenu({ x: event.clientX, y: event.clientY });
  }
  // A press on the viewport outside the slide selects nothing (the deck).
  function onViewportDown(event) {
    if (!enabled || view.panMode || frame.contains(event.target) || event.target.closest?.(`.${p}-actionbar, .${p}-menu`)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (studio.editingText()) return;
    studio.select([], { source: "canvas" });
    frame.focus({ preventScroll: true });
  }
  frame.addEventListener("pointerdown", onPointerDown);
  frame.addEventListener("pointermove", onPointerMove);
  frame.addEventListener("pointerup", onPointerUp);
  frame.addEventListener("pointercancel", onPointerCancel);
  frame.addEventListener("pointerleave", () => { if (!drag.active) { hover = null; paintHover(); } });
  frame.addEventListener("dblclick", onDoubleClick);
  frame.addEventListener("contextmenu", onContextMenu);
  viewport.addEventListener("pointerdown", onViewportDown);

  // --- drag to move (the kit's drag controller over the adapter's trial drops) ---------------------------------------------------------------
  function startDrag(press) {
    if (studio.readOnly) return null;
    const keys = press.payload.keys.filter((key) => scene().node(key)?.can.move);
    if (!keys.length) return null;
    const first = scene().node(keys[0]);
    const ghost = dragGhost(dom, root, keys.length > 1 ? `${keys.length} blocks` : chipText(first));
    for (const key of keys) boxEl(key)?.classList.add("is-dragging");
    return { keys, ghost, drop: null };
  }
  function autoScroll(event) {
    const box = viewport.getBoundingClientRect();
    const edge = 24, speed = 12;
    if (event.clientX < box.left + edge) viewport.scrollLeft -= speed; else if (event.clientX > box.right - edge) viewport.scrollLeft += speed;
    if (event.clientY < box.top + edge) viewport.scrollTop -= speed; else if (event.clientY > box.bottom - edge) viewport.scrollTop += speed;
  }
  function showDrop(found) {
    marks.into(layer, null);
    if (!found) { marks.hideDrop(); return; }
    marks.showDrop(found.line, { orientation: found.line.orientation, state: found.ok ? (found.noop ? "same" : "ok") : "refused", reason: found.reason });
    if (found.into && found.ok) marks.into(layer, boxEl(found.into));
  }
  function moveDrag(session, event) {
    session.ghost.moveTo(event);
    autoScroll(event);
    const found = adapter.dropAt(unit(event), session.keys);
    session.drop = found;
    showDrop(found);
    if (found && !found.ok) studio.status(found.reason);
  }
  function endDrag(session) {
    session.ghost.remove();
    marks.hideDrop();
    marks.into(layer, null);
    delete root.dataset.dragging;
    for (const node of layer.querySelectorAll(".is-dragging")) node.classList.remove("is-dragging");
  }
  function finishDrag(session) {
    const found = session.drop;
    if (!found) return;
    if (!found.ok) { studio.announce(found.reason); return; }
    if (found.noop) return;
    studio.move(session.keys, found.target, found.index);
  }

  // Dragging a new block from Insert onto the slide: the same drop lines, a region that does not accept the kind refuses.
  function beginInsertDrag(kind, event, { onEnd } = {}) {
    if (studio.readOnly || insertDrag) return false;
    const ghost = dragGhost(dom, root, `New ${kind}`);
    insertDrag = { kind, ghost, drop: null, id: event.pointerId };
    root.dataset.dragging = "true";
    const move = (next) => {
      if (next.pointerId !== insertDrag?.id) return;
      ghost.moveTo(next);
      const point = unit(next);
      const found = outside(point) ? null : adapter.dropAt(point, []);
      const verdict = found ? studio.insertVerdict(kind, found.target) : null;
      insertDrag.drop = found ? { ...found, ok: verdict === true, noop: false, reason: verdict === true ? "" : verdict } : null;
      showDrop(insertDrag.drop);
      if (insertDrag.drop && !insertDrag.drop.ok) studio.status(insertDrag.drop.reason);
    };
    const finish = (commit) => {
      const session = insertDrag;
      if (!session) return;
      insertDrag = null;
      doc.removeEventListener("pointermove", move, true);
      doc.removeEventListener("pointerup", up, true);
      doc.removeEventListener("pointercancel", cancel, true);
      doc.removeEventListener("keydown", key, true);
      ghost.remove();
      marks.hideDrop();
      marks.into(layer, null);
      delete root.dataset.dragging;
      onEnd?.();
      if (!commit) { studio.announce("Insert cancelled."); return; }
      const found = session.drop;
      if (!found) return;
      if (!found.ok) { studio.announce(found.reason); return; }
      studio.insert(session.kind, { target: found.target, index: found.index });
    };
    const up = (next) => { if (next.pointerId === insertDrag?.id) finish(true); };
    const cancel = (next) => { if (next.pointerId === insertDrag?.id) finish(false); };
    const key = (next) => { if (next.key === "Escape") { next.preventDefault(); next.stopPropagation(); finish(false); } };
    doc.addEventListener("pointermove", move, true);
    doc.addEventListener("pointerup", up, true);
    doc.addEventListener("pointercancel", cancel, true);
    doc.addEventListener("keydown", key, true);
    return true;
  }

  // --- dividers (track resize through the adapter's gesture: drafts, then one change) ---------------------------------------------------------
  function startResize(event, node) {
    const info = node._info;
    if (!info?.draggable || studio.readOnly || view.panMode || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!adapter.begin("Resize")) return;
    resize = { node, info, label: null, id: event.pointerId };
    node.setPointerCapture?.(event.pointerId);
    node.focus({ preventScroll: true });
    node.dataset.active = "true";
    trackPointer(node, {
      doc,
      onMove(move) {
        const point = unit(move);
        const along = info.row ? point.x : point.y;
        const fraction = Math.max(0, Math.min(1, (along - info.pairStart) / info.pairLength));
        try {
          const prepared = adapter.prepare("resizeTracks", info.key, info.index, fraction, { free: move.shiftKey });
          const label = ratioLabel(prepared.weights[info.index], prepared.weights[info.index + 1]);
          resize.label = label;
          adapter.preview(prepared, `Resize ${label}`);
          marks.showRatio(label, { x: info.box.x + info.box.w / 2, y: info.box.y + info.box.h / 2 });
        } catch (error) {
          studio.status(error.message);
        }
      },
      onEnd(commit) {
        marks.hideRatio();
        const label = resize?.label;
        resize = null;
        node.dataset.active = "false";
        if (commit && label) {
          if (adapter.commit(`Resized to ${label}`)) studio.announce(`Resized to ${label}`);
        } else {
          adapter.cancel();
          if (!commit) studio.announce("Resize cancelled.");
        }
        studio.afterGesture();
      },
    });
  }
  function dividerKey(event, node) {
    const info = node._info;
    if (!info?.draggable) return;
    const action = dividerKeyAction(event, info.row ? "vertical" : "horizontal");
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if (action.type === "equalize") studio.equalize(info.key, info.index);
    else studio.nudgeDivider(info.key, info.index, action.step, action.big);
  }

  // --- keyboard on the slide ---------------------------------------------------------------------------------------------------------------------
  function onKeyDown(event) {
    if (!enabled || isTypingTarget(event.target)) return;
    if (event.key === " " && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      view.holdSpace(true);
      return;
    }
    // Tab and Shift+Tab: the next or previous sibling; past either end, focus leaves the slide as usual.
    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const delta = event.shiftKey ? -1 : 1;
      const key = studio.primaryKey();
      if (key && scene().node(key) && scene().node(key).kind !== "slide" && studio.hasSibling(delta) === true) {
        event.preventDefault();
        studio.selectSibling(delta);
      }
      return;
    }
    // Typing a character on a selected text node replaces its text (Figma); a shortcut other than a tool's letter ("?", Shift+1) keeps its command.
    if (event.key.length === 1 && event.key !== "?" && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing && studio.textTarget() && !studio.readOnly && studio.inSync && !studio.isShortcut(event)) {
      event.preventDefault();
      studio.beginTextEdit(studio.primaryKey(), { replace: event.key });
    }
  }
  function onKeyUp(event) { if (event.key === " ") view.holdSpace(false); }
  frame.addEventListener("keydown", onKeyDown);
  frame.addEventListener("keyup", onKeyUp);
  frame.addEventListener("focusout", () => view.holdSpace(false));
  // A text field of the canvas: Tab commits and selects the next sibling.
  frame.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !studio.editingText() || !event.target.closest?.(".opf-inline-input, .opf-rich-input, textarea")) return;
    if (event.target.closest?.("textarea")?.style.tabSize === "4") return;
    event.preventDefault();
    event.stopPropagation();
    if (canvas.commit()) studio.selectSibling(event.shiftKey ? -1 : 1);
  }, true);

  return {
    paint,
    paintHover,
    get zoom() { return view.zoom; },
    get panMode() { return view.panMode; },
    setZoom: (value, options) => view.setZoom(value, options),
    step: (direction) => view.step(direction),
    fit: (mode = "slide") => view.fit(mode),
    get tool() { return tool; },
    setTool(next) {
      tool = next;
      root.dataset.tool = next;
      paintDividers(scene());
    },
    focusPrimary,
    boxOf: boxEl,
    describe,
    beginInsertDrag,
    get dragging() { return Boolean(drag.active || insertDrag || resize); },
    cancelDrag() { drag.cancel(); },
    /** Overlay on (the Studio) or off (the Playground preset: the canvas takes the pointer). */
    setEnabled(on) {
      enabled = Boolean(on);
      root.dataset.overlay = enabled ? "on" : "off";
      if (!enabled) { drag.cancel(); hover = null; paintHover(); }
    },
    destroy() {
      destroyed = true;
      clearLongPress();
      drag.cancel();
      view.destroy();
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("pointerdown", onViewportDown);
    },
    stage,
  };
}

/** Whether a scene node holds text the canvas edits in place. */
export const isTextNode = (node) => Boolean(node) && (node.kind === "heading" || TEXT_TYPES.has(node.type)) && node.kind !== "region" && node.kind !== "group" && node.kind !== "slide";
