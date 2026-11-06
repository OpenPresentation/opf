// The canvas tools of overlay shapes and connectors (SH-06 Part B): move and resize a selected overlay shape, and draw a connector between two blocks or overlays.
//
// Frame. A selected overlay shape shows a frame with eight resize handles; dragging the shape's outline (not its text) moves it, the arrow keys on the focused
// frame move it (Shift resizes), Escape cancels a drag. A shape placed by fractions writes `x`, `y`, `width` and `height` (fractions of the slide, kept on it); a shape
// attached to a block keeps its `at`: moving it changes the `offset` from the block's edge (along the edge's normal), resizing changes `at.width` and `at.height` in
// reference pixels, and a shape centered on a block that is dragged is freed from it into fractions. A drag draws a draft and one undoable `setOverlayFrame` (or
// `detachOverlay`) writes it on release.
//
// Connect. `connect()` starts a mode in which the canvas picks two things (a block or an overlay shape: the first click is the start, the second the end, Escape
// cancels); the connector goes on top of the slide's overlays, its ends get ids where they had none, in one undoable `connectShapes`.
// Importing this module needs no DOM; mounting does.
import { getValueAtPath, splitOpfPath } from "./index.js";
import { connectShapes, detachOverlay, prepareOverlayDetach, prepareOverlayFrame, setOverlayFrame, slideIsRtl } from "./shape-overlays.js";

const OVERLAY_OF = /^(slides\.(?:0|[1-9][0-9]*)\.shapes\.(?:0|[1-9][0-9]*))(?:\.|$)/;
const LEAF_BLOCK = /^(slides\.(?:0|[1-9][0-9]*)(?:\.blocks\.(?:0|[1-9][0-9]*))+)/;
const HANDLES = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };
const CURSORS = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };
const MIN_FRACTION = 0.01;
const round4 = (value) => Math.round(value * 10000) / 10000;
const MOVE_THRESHOLD = 4;

/**
 * Mount the overlay tools on the canvas `root` (positioned) and return `{ sync, update, connect, commit, cancel, hide, destroy, editingPath, connecting }`.
 *
 * Options: `editor`, `render(presentation?)`, `beforeEdit()`, `isTextEditing()`, `select(path)` (the canvas selects an overlay), `onDraft`, `onCommit({ path, editor })`,
 * `onCancel`, `onError(error)`, `clearError()`. `sync(path)` is the canvas's selection; `update(presentation, geometry)` runs after every draw.
 */
export function createOverlayTools(root, options) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const editor = options.editor;
  const layer = doc.createElement("div");
  layer.className = "opf-overlay-tools";
  layer.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:3";
  root.append(layer);

  let selected = null;
  let lastGeometry;
  let lastPresentation;
  let active = null;
  let frameRequest = 0;
  let committing = false;
  let pending = null;
  let suppressClick = false;
  let connecting = null;
  let destroyed = false;

  const signature = (path) => JSON.stringify(getValueAtPath(editor.presentation, splitOpfPath(path)));
  const coarse = () => win.matchMedia?.("(pointer: coarse)")?.matches;
  const svg = () => root.querySelector(".opf-canvas-preview svg");
  const toSlide = (event) => {
    const box = svg().getBoundingClientRect();
    return { x: ((event.clientX - box.left) * lastGeometry.width) / box.width, y: ((event.clientY - box.top) * lastGeometry.height) / box.height };
  };
  const overlayOf = (path) => OVERLAY_OF.exec(path ?? "")?.[1];
  const shapeEntry = (geometry, path) => geometry?.overlayShapes?.find((entry) => entry.kind === "shape" && entry.path === path);
  const pct = (value, of) => `${(value / of) * 100}%`;

  // --- the frame of a selected overlay shape -----------------------------------------------------------------------------------------

  /** What a drag needs from the composed shape: its box, how it is placed and the scale between slide pixels and reference pixels. */
  function describe(entry, path) {
    const raw = getValueAtPath(editor.presentation, splitOpfPath(path));
    const W = lastGeometry.width;
    const H = lastGeometry.height;
    const box = entry.shape.box;
    // The deck's direction: x counts from the right edge in a right-to-left deck (the entry's x tells which way it is drawn).
    const rtl = raw.x !== undefined ? Math.abs(box.x - raw.x * W) > 1 && Math.abs(box.x - (W - (raw.x + (raw.width ?? 0)) * W)) < 1 : slideIsRtl(editor.presentation, Number(path.split(".")[1]));
    return { path, box: { ...box }, W, H, scale: Math.min(W, H) / 720, rtl, placement: raw.at ? "at" : "fractions", at: raw.at, edge: entry.attachedTo?.edge, base: signature(path) };
  }

  /** The change a drag makes: from the pointer's travel in slide pixels, for a move or a resize by `handle`. */
  function changeFor(drag, dx, dy) {
    const { box, W, H, scale } = drag;
    if (drag.placement === "at") {
      if (drag.handle === "move") {
        if (drag.edge === "center") return { detach: true, frame: framed(drag, { x: box.x + dx, y: box.y + dy, width: box.width, height: box.height }) };
        const sign = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[drag.edge] ?? [0, 0];
        const travel = (sign[0] * dx + sign[1] * dy) / scale;
        return { frame: { offset: Math.round(Math.max(-720, Math.min(720, (drag.at.offset ?? 0) + travel)) * 100) / 100 } };
      }
      const sized = resized(box, drag.handle, dx, dy);
      return { frame: { width: Math.max(2, Math.round((sized.width / scale) * 10) / 10), height: Math.max(2, Math.round((sized.height / scale) * 10) / 10) } };
    }
    const next = drag.handle === "move" ? { x: box.x + dx, y: box.y + dy, width: box.width, height: box.height } : resized(box, drag.handle, dx, dy, W * MIN_FRACTION, H * MIN_FRACTION);
    return { frame: framed(drag, next) };
  }

  /** A box in slide pixels as fractions of the slide (mirrored in a right-to-left deck). */
  function framed(drag, box) {
    const { W, H } = drag;
    const width = Math.min(1, Math.max(MIN_FRACTION, box.width / W));
    const height = Math.min(1, Math.max(MIN_FRACTION, box.height / H));
    const left = drag.rtl ? (W - (box.x + box.width)) / W : box.x / W;
    return { x: round4(left), y: round4(box.y / H), width: round4(width), height: round4(height) };
  }

  /** `box` resized by dragging `handle` by (dx, dy): the opposite edges stay put. */
  function resized(box, handle, dx, dy, minWidth = 2, minHeight = 2) {
    let { x, y, width, height } = box;
    if (handle.includes("e")) width = Math.max(minWidth, width + dx);
    if (handle.includes("w")) {
      const next = Math.max(minWidth, width - dx);
      x += width - next;
      width = next;
    }
    if (handle.includes("s")) height = Math.max(minHeight, height + dy);
    if (handle.includes("n")) {
      const next = Math.max(minHeight, height - dy);
      y += height - next;
      height = next;
    }
    return { x, y, width, height };
  }

  function preview(dx, dy) {
    const drag = active;
    if (!drag) return false;
    try {
      const change = changeFor(drag, dx, dy);
      drag.change = change;
      // A shape that will be freed from its block draws as it will stand: a draft with its fractions.
      const draft = change.detach ? prepareOverlayDetach(editor.presentation, drag.path, change.frame) : prepareOverlayFrame(editor.presentation, drag.path, change.frame);
      options.render(draft.presentation);
      if (active !== drag) return false;
      drag.valid = true;
      options.onDraft?.({ presentation: draft.presentation, path: drag.path, value: change.frame });
      options.clearError?.();
      return true;
    } catch (error) {
      if (active === drag) drag.valid = false;
      options.onError?.(error);
      return false;
    }
  }

  function release(drag) {
    if (drag?.pointerId !== undefined && layer.hasPointerCapture?.(drag.pointerId)) layer.releasePointerCapture(drag.pointerId);
  }

  function cancel(clear = true) {
    if (!active) return;
    const drag = active;
    active = null;
    if (frameRequest) win.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    release(drag);
    options.render();
    if (clear) options.onCancel?.({ path: drag.path });
  }

  function commit() {
    if (!active) return true;
    if (frameRequest) {
      win.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      preview(active.dx, active.dy);
    }
    const drag = active;
    if (!drag) return false;
    if (signature(drag.path) !== drag.base) {
      cancel(false);
      options.onError?.(new Error("The shape changed elsewhere. The move was cancelled."));
      return false;
    }
    if (!drag.moved || !drag.valid || !drag.change) {
      cancel(false);
      return !drag.moved;
    }
    active = null;
    release(drag);
    committing = true;
    try {
      if (drag.change.detach) detachOverlay(editor, drag.path, drag.change.frame, { source: "canvas-overlay-frame" });
      else setOverlayFrame(editor, drag.path, drag.change.frame, { source: "canvas-overlay-frame" });
      options.onCommit?.({ path: drag.path, editor });
      return true;
    } catch (error) {
      options.render();
      options.onError?.(error);
      return false;
    } finally {
      committing = false;
    }
  }

  function begin(entry, path, handle, event) {
    if (options.beforeEdit && !options.beforeEdit()) return false;
    if (active && !commit()) return false;
    suppressClick = false;
    const start = event ? toSlide(event) : { x: 0, y: 0 };
    active = { ...describe(entry, path), handle, startX: start.x, startY: start.y, pointerId: event?.pointerId, moved: false, valid: false, dx: 0, dy: 0 };
    if (event) layer.setPointerCapture(event.pointerId);
    return true;
  }

  /** Arrow keys on the focused frame: move by 1% of the slide (Shift: resize), as one undoable step each. */
  function nudge(entry, path, event) {
    const step = event.shiftKey ? 5 : 1;
    const dx = { ArrowLeft: -1, ArrowRight: 1 }[event.key] ?? 0;
    const dy = { ArrowUp: -1, ArrowDown: 1 }[event.key] ?? 0;
    if (!dx && !dy) return false;
    if (!begin(entry, path, event.shiftKey ? "se" : "move", undefined)) return true;
    const shift = (lastGeometry.width * step) / 100;
    active.moved = true;
    active.dx = dx * shift;
    active.dy = dy * ((lastGeometry.height * step) / 100);
    if (preview(active.dx, active.dy)) commit();
    else cancel(false);
    layer.querySelector("[data-overlay-frame]")?.focus();
    return true;
  }

  function drawFrame() {
    layer.replaceChildren();
    if (destroyed || connecting || !selected || options.isTextEditing?.()) return;
    const path = overlayOf(selected);
    const entry = path ? shapeEntry(lastGeometry, path) : undefined;
    if (!entry) return;
    const box = entry.shape.box;
    const { width: W, height: H } = lastGeometry;
    const frame = doc.createElement("div");
    frame.dataset.overlayFrame = path;
    frame.tabIndex = 0;
    frame.setAttribute("role", "group");
    frame.setAttribute("aria-label", `Overlay shape frame ${path}`);
    frame.title = "Arrow keys move the shape (Shift resizes) · drag its outline to move it · drag a handle to resize · Esc cancels";
    frame.style.cssText = `position:absolute;box-sizing:border-box;pointer-events:none;left:${pct(box.x, W)};top:${pct(box.y, H)};width:${pct(box.width, W)};height:${pct(box.height, H)};outline:0`;
    frame.addEventListener("focus", () => (frame.style.outline = "2px dashed #7765d0"));
    frame.addEventListener("blur", () => (frame.style.outline = "0"));
    frame.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && active) {
        event.preventDefault();
        cancel();
      } else if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        event.stopPropagation();
        try {
          nudge(entry, path, event);
        } catch (error) {
          options.onError?.(error);
        }
      }
    });
    const size = coarse() ? 22 : 11;
    for (const [handle, [fx, fy]] of Object.entries(HANDLES)) {
      const node = doc.createElement("div");
      node.dataset.overlayHandle = handle;
      node.setAttribute("aria-hidden", "true");
      node.style.cssText = `position:absolute;pointer-events:auto;touch-action:none;box-sizing:border-box;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;left:${fx * 100}%;top:${fy * 100}%;background:#fff;border:2px solid #7765d0;border-radius:3px;cursor:${CURSORS[handle]}`;
      node.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        try {
          if (begin(entry, path, handle, event)) active.moved = false;
        } catch (error) {
          options.onError?.(error);
        }
      });
      frame.append(node);
    }
    // A grip above the frame moves the shape (its outline moves it too, but a small shape is mostly its text, which a press edits).
    const grip = doc.createElement("div");
    grip.dataset.overlayHandle = "move";
    grip.setAttribute("aria-hidden", "true");
    grip.title = "Drag to move the shape";
    grip.textContent = "✥";
    grip.style.cssText = `position:absolute;pointer-events:auto;touch-action:none;box-sizing:border-box;width:${size + 9}px;height:${size + 9}px;margin:0 0 0 ${-(size + 9) / 2}px;left:50%;top:${-(size + 24)}px;display:flex;align-items:center;justify-content:center;font:${size + 2}px/1 system-ui;color:#fff;background:#7765d0;border-radius:50%;cursor:move;user-select:none`;
    grip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        begin(entry, path, "move", event);
      } catch (error) {
        options.onError?.(error);
      }
    });
    frame.append(grip);
    layer.append(frame);
  }

  layer.addEventListener("pointermove", (event) => {
    if (!active || event.pointerId !== active.pointerId) return;
    const at = toSlide(event);
    active.dx = at.x - active.startX;
    active.dy = at.y - active.startY;
    if (!active.moved && Math.hypot(active.dx, active.dy) < 2) return;
    active.moved = true;
    if (frameRequest) win.cancelAnimationFrame(frameRequest);
    frameRequest = win.requestAnimationFrame(() => {
      frameRequest = 0;
      if (active) preview(active.dx, active.dy);
    });
  });
  layer.addEventListener("pointerup", (event) => {
    if (active?.pointerId === event.pointerId) commit();
  });
  layer.addEventListener("pointercancel", (event) => {
    if (active?.pointerId === event.pointerId) cancel();
  });
  layer.addEventListener("lostpointercapture", (event) => {
    if (active?.pointerId === event.pointerId && !committing) cancel();
  });

  // --- moving by the shape's outline ---------------------------------------------------------------------------------------------------
  // A press on the selected (or any) overlay shape's own outline, not on its text, starts a move once the pointer travels a few pixels; a press that does not travel is
  // a click, which selects as before. The press is not cancelled, so the canvas still selects on it.
  const onPress = (event) => {
    suppressClick = false;
    if (event.button !== 0 || connecting || destroyed || options.isTextEditing?.()) return;
    const target = event.target?.closest?.("[data-canvas-target]");
    const path = target ? overlayOf(target.getAttribute("data-opf-path")) : undefined;
    // Only the shape's own outline target (its path is the entry), never its text, a connector or another block.
    if (!path || target.getAttribute("data-opf-path") !== path || !shapeEntry(lastGeometry, path)) return;
    pending = { path, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  };
  const onMove = (event) => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < MOVE_THRESHOLD) return;
    const press = pending;
    pending = null;
    const entry = shapeEntry(lastGeometry, press.path);
    if (!entry) return;
    if (selected !== press.path && !selected?.startsWith(`${press.path}.`)) options.select?.(press.path);
    const found = shapeEntry(lastGeometry, press.path) ?? entry;
    if (begin(found, press.path, "move", { pointerId: press.pointerId, clientX: press.x, clientY: press.y })) {
      suppressClick = true; // begin() clears it: set it again for the click this press ends with
      const at = toSlide(event);
      active.dx = at.x - active.startX;
      active.dy = at.y - active.startY;
      active.moved = true;
      preview(active.dx, active.dy);
    }
  };
  const onRelease = () => {
    pending = null;
  };
  const onClick = (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.stopPropagation();
    event.preventDefault();
  };
  root.addEventListener("pointerdown", onPress, true);
  doc.addEventListener("pointermove", onMove, true);
  doc.addEventListener("pointerup", onRelease, true);
  doc.addEventListener("click", onClick, true);

  const onEscape = (event) => {
    if (event.key !== "Escape") return;
    if (active) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (connecting) {
      event.preventDefault();
      event.stopPropagation();
      connecting.cancel();
    }
  };
  doc.addEventListener("keydown", onEscape, true);
  const unsubscribe = editor.subscribe(() => {
    if (committing || !active) return;
    if (signature(active.path) !== active.base) {
      cancel(false);
      options.onError?.(new Error("The shape changed elsewhere. The move was cancelled."));
    }
  });

  // --- connect: pick two things ---------------------------------------------------------------------------------------------------------

  /** What a connector can end on at a point of the slide: the topmost overlay shape, else the smallest block (its leaf block) that holds it. */
  function candidates(geometry) {
    const out = [];
    const blocks = new Map();
    for (const item of geometry.items ?? []) {
      const leaf = LEAF_BLOCK.exec(item.path)?.[1];
      if (!leaf) continue;
      const box = item.shape?.box ?? item.frameBox ?? item.image?.box ?? item.box;
      if (!box) continue;
      const known = blocks.get(leaf);
      if (!known) blocks.set(leaf, { ...box });
      else {
        const x = Math.min(known.x, box.x);
        const y = Math.min(known.y, box.y);
        known.width = Math.max(known.x + known.width, box.x + box.width) - x;
        known.height = Math.max(known.y + known.height, box.y + box.height) - y;
        known.x = x;
        known.y = y;
      }
    }
    for (const [path, box] of blocks) out.push({ path, box, kind: "block" });
    for (const entry of geometry.overlayShapes ?? []) if (entry.kind === "shape") out.push({ path: entry.path, box: { ...entry.shape.box }, kind: "shape", over: entry.index + 1 });
    return out;
  }
  function pick(geometry, point) {
    const inside = candidates(geometry).filter(({ box }) => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height);
    inside.sort((a, b) => (b.over ?? 0) - (a.over ?? 0) || a.box.width * a.box.height - b.box.width * b.box.height);
    return inside[0];
  }

  function connect(connectOptions = {}) {
    if (connecting) connecting.cancel();
    if (options.beforeEdit && !options.beforeEdit()) return { cancel() {}, done: Promise.resolve(null) };
    layer.replaceChildren();
    const hover = doc.createElement("div");
    hover.dataset.connectHover = "";
    hover.style.cssText = "position:absolute;pointer-events:none;box-sizing:border-box;border:2px dashed #7765d0;background:#7765d014;display:none";
    const start = doc.createElement("div");
    start.dataset.connectStart = "";
    start.style.cssText = "position:absolute;pointer-events:none;box-sizing:border-box;border:2px solid #7765d0;background:#7765d026;display:none";
    layer.append(start, hover);
    const cover = doc.createElement("div");
    cover.dataset.connectCover = "";
    cover.style.cssText = "position:absolute;inset:0;pointer-events:auto;cursor:crosshair;z-index:5";
    cover.setAttribute("aria-hidden", "true");
    layer.append(cover);
    const say = (message) => connectOptions.onStatus?.(message, { error: false });
    let from;
    let resolve;
    const done = new Promise((r) => (resolve = r));
    const place = (node, box) => {
      node.style.display = box ? "block" : "none";
      if (!box) return;
      node.style.left = pct(box.x, lastGeometry.width);
      node.style.top = pct(box.y, lastGeometry.height);
      node.style.width = pct(box.width, lastGeometry.width);
      node.style.height = pct(box.height, lastGeometry.height);
    };
    const finish = (result) => {
      cover.removeEventListener("pointermove", onHover);
      cover.removeEventListener("pointerdown", onPick);
      connecting = null;
      layer.replaceChildren();
      resolve(result);
      drawFrame();
    };
    const onHover = (event) => {
      const found = pick(lastGeometry, toSlide(event));
      place(hover, found && found.path !== from?.path ? found.box : undefined);
    };
    const onPick = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const found = pick(lastGeometry, toSlide(event));
      if (!found) return say("Click a block or a shape to start the connector. Esc cancels.");
      if (!from) {
        from = found;
        place(start, found.box);
        return say("Now click the block or shape it ends on. Esc cancels.");
      }
      if (found.path === from.path) return say("A connector joins two different things. Click another.");
      try {
        const slideIndex = Number(/^slides\.(\d+)/.exec(found.path)?.[1]);
        const change = connectShapes(editor, { slideIndex, from: from.path, to: found.path, route: connectOptions.route ?? "straight", ...(connectOptions.stroke ? { stroke: connectOptions.stroke } : {}) }, { source: "canvas-connector" });
        say(`Connector added from ${change.from} to ${change.to}.`);
        finish(change);
        options.onCommit?.({ path: change.path, editor });
      } catch (error) {
        options.onError?.(error);
        finish(null);
      }
    };
    cover.addEventListener("pointermove", onHover);
    cover.addEventListener("pointerdown", onPick);
    connecting = {
      cancel() {
        say("Connector cancelled.");
        finish(null);
      },
    };
    say("Click the block or shape the connector starts on. Esc cancels.");
    return { cancel: () => connecting?.cancel(), done };
  }

  return {
    /** The canvas's selection changed: show the frame when it is an overlay shape. */
    sync(path) {
      selected = path ?? null;
      if (active) cancel(false);
      if (lastGeometry) drawFrame();
    },
    update(presentation, geometry) {
      lastPresentation = presentation;
      lastGeometry = geometry;
      if (connecting) return;
      drawFrame();
    },
    connect,
    commit,
    cancel,
    hide() {
      if (!connecting) layer.replaceChildren();
    },
    get editingPath() {
      return active?.path ?? null;
    },
    get connecting() {
      return connecting !== null;
    },
    destroy() {
      destroyed = true;
      connecting?.cancel();
      if (frameRequest) win.cancelAnimationFrame(frameRequest);
      root.removeEventListener("pointerdown", onPress, true);
      doc.removeEventListener("pointermove", onMove, true);
      doc.removeEventListener("pointerup", onRelease, true);
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("keydown", onEscape, true);
      unsubscribe?.();
      layer.remove();
      void lastPresentation;
    },
  };
}
