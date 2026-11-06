// The adjust handles on the canvas (SH-06): the yellow diamonds PowerPoint shows on a selected preset shape (a chevron's point, a callout's tail, a
// pie's two angles, a ring's width). A handle is where `presetGeometry(...).handles` says it is (turned and mirrored with the shape); dragging it
// searches for the adjust values that put it under the pointer (shape-handle-math.js), draws that as a draft, and one undoable `setShapeAdjust` writes
// the values on release, as fractions of the shape and degrees, each pinned to its handle's range. The arrow keys nudge a focused handle, one undo step
// a press; Escape cancels a drag. The geometry and the commands load the first time a preset shape is selected (shape-handle-tools.js). Importing this
// module needs no DOM; mounting does.
import { getValueAtPath, splitOpfPath } from "./index.js";

const BLOCK_OF = /\.(shape|path|text)$/;
const blockOf = (path) => String(path ?? "").replace(BLOCK_OF, "");

/**
 * Mount the handle layer on the canvas `root` (positioned) and return `{ sync, update, commit, cancel, hide, destroy, editingPath }`.
 *
 * Options: `editor`, `render(presentation?)` (draw a draft, or the document with no argument), `beforeEdit()` (finish an inline edit; false stops),
 * `isTextEditing()`, `onDraft({ presentation, path, value })`, `onCommit({ path, editor })`, `onCancel({ path })`, `onError(error)`, `clearError()`.
 * `sync(path)` is the canvas's selection; `update(presentation, geometry)` runs after every draw.
 */
export function createShapeHandles(root, options) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const editor = options.editor;
  const layer = doc.createElement("div");
  layer.className = "opf-shape-handles";
  layer.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:3";
  root.append(layer);

  let selected = null;
  let tools;
  let loading = false;
  let lastPresentation;
  let lastGeometry;
  let active = null;
  let frame = 0;
  let committing = false;
  let destroyed = false;

  const coarse = () => win.matchMedia?.("(pointer: coarse)")?.matches;
  const signature = (path) => JSON.stringify(getValueAtPath(editor.presentation, splitOpfPath(path)));

  function load() {
    if (tools || loading) return;
    loading = true;
    import("./shape-handle-tools.js").then(
      async (module) => {
        await module.loadShapeEngine();
        tools = module;
        loading = false;
        if (!destroyed && !active) update(lastPresentation, lastGeometry);
      },
      (error) => {
        loading = false;
        options.onError?.(error);
      },
    );
  }

  /** The composed preset shape of the selection: the geometry item whose block the selection is in. */
  function selectedItem(geometry) {
    if (!selected || !geometry) return undefined;
    const block = blockOf(selected);
    // A shape block's item, or an overlay shape of the slide's `shapes` (SH-04): both are composed shapes.
    const shapes = [...(geometry.items ?? []), ...(geometry.overlayShapes ?? []).filter((entry) => entry.kind === "shape")];
    return shapes.find((item) => item.field === "shape" && item.shape?.preset && item.shape.paths?.length && blockOf(item.path) === block);
  }

  function release(edit) {
    if (edit?.pointerId !== undefined && layer.hasPointerCapture?.(edit.pointerId)) layer.releasePointerCapture(edit.pointerId);
  }

  function cancel(clear = true) {
    if (!active) return;
    const edit = active;
    active = null;
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    release(edit);
    options.render();
    if (clear) options.onCancel?.({ path: edit.path });
  }

  /** Solve the handle for a point of the geometry (frame-local) and draw the result as a draft. */
  function preview(local) {
    const edit = active;
    if (!edit || !tools) return false;
    try {
      const solved = tools.solveHandle(tools.shapeEngine(), edit.preset, edit.size, edit.adjust, edit.index, local);
      if (!solved) return false;
      edit.values = solved.values;
      const prepared = tools.prepareShapeProperties(editor.presentation, edit.path, { adjust: solved.values }, { size: edit.size });
      options.render(prepared.presentation);
      if (active !== edit) return false;
      edit.valid = true;
      options.onDraft?.({ presentation: prepared.presentation, path: `${edit.path}.adjust`, value: solved.values });
      options.clearError?.();
      return true;
    } catch (error) {
      if (active === edit) edit.valid = false;
      options.onError?.(error);
      return false;
    }
  }

  function commit() {
    if (!active) return true;
    if (frame) {
      win.cancelAnimationFrame(frame);
      frame = 0;
      if (active.local) preview(active.local);
    }
    const edit = active;
    if (!edit) return false;
    if (signature(edit.path) !== edit.base) {
      cancel(false);
      options.onError?.(new Error("The shape changed elsewhere. The adjustment was cancelled."));
      return false;
    }
    if (!edit.moved || !edit.valid || !edit.values) {
      cancel(false);
      return edit.moved ? false : true;
    }
    active = null;
    release(edit);
    committing = true;
    try {
      tools.setShapeAdjust(editor, edit.path, edit.values, { size: edit.size, source: "canvas-shape-handle" });
      options.onCommit?.({ path: `${edit.path}.adjust`, editor });
      return true;
    } catch (error) {
      options.render();
      options.onError?.(error);
      return false;
    } finally {
      committing = false;
    }
  }

  const slidePoint = (event) => {
    const svg = root.querySelector(".opf-canvas-preview svg");
    const box = svg.getBoundingClientRect();
    return { x: ((event.clientX - box.left) * lastGeometry.width) / box.width, y: ((event.clientY - box.top) * lastGeometry.height) / box.height };
  };

  function begin(entry, item, event) {
    if (options.beforeEdit && !options.beforeEdit()) return false;
    if (active && !commit()) return false;
    const shape = item.shape;
    active = {
      index: entry.index,
      path: blockOf(item.path),
      preset: shape.preset,
      size: { width: shape.box.width, height: shape.box.height },
      frame: { x: shape.box.x, y: shape.box.y, width: shape.box.width, height: shape.box.height, rotate: shape.rotate ?? 0, flipH: shape.flipH === true, flipV: shape.flipV === true },
      adjust: { ...shape.adjust },
      base: signature(blockOf(item.path)),
      pointerId: event?.pointerId,
      moved: false,
      valid: false,
    };
    if (event) layer.setPointerCapture(event.pointerId);
    return true;
  }

  /** Nudge a focused handle one step along an arrow key: one undoable step. */
  function nudge(entry, item, event) {
    const shape = item.shape;
    const step = (event.shiftKey ? 0.05 : 0.01) * Math.max(shape.box.width, shape.box.height);
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta || !begin(entry, item, undefined)) return;
    const slide = { x: entry.slide.x + delta[0], y: entry.slide.y + delta[1] };
    active.moved = true;
    active.local = tools.toLocal(slide, active.frame);
    const index = entry.index;
    if (preview(active.local)) commit();
    else cancel(false);
    const node = [...layer.children].find((child) => child.dataset.shapeHandle === String(index));
    node?.focus();
  }

  function update(presentation, geometry) {
    lastPresentation = presentation;
    lastGeometry = geometry;
    layer.replaceChildren();
    if (destroyed || !selected || options.isTextEditing?.()) return;
    const item = selectedItem(geometry);
    if (!item) return;
    if (!tools) {
      load();
      return;
    }
    const shape = item.shape;
    const preset = shape.preset;
    const box = shape.box;
    const turned = { x: box.x, y: box.y, width: box.width, height: box.height, rotate: shape.rotate ?? 0, flipH: shape.flipH === true, flipV: shape.flipV === true };
    let layout;
    try {
      layout = tools.handleLayout(tools.shapeEngine(), preset, turned, shape.adjust);
    } catch {
      return;
    }
    const size = coarse() ? 24 : 16;
    for (const entry of layout) {
      const node = doc.createElement("div");
      const names = entry.axes.map((axis) => axis.adjust).join(", ");
      node.dataset.shapeHandle = String(entry.index);
      node.dataset.adjust = names;
      node.tabIndex = 0;
      node.setAttribute("role", "button");
      node.setAttribute("aria-roledescription", "adjust handle");
      node.setAttribute("aria-label", `Adjust ${preset} (${names}), handle ${entry.index + 1} of ${layout.length}`);
      node.title = `Drag to adjust ${names} · Arrow keys nudge (Shift for more) · Esc cancels`;
      node.style.cssText = `position:absolute;pointer-events:auto;touch-action:none;box-sizing:border-box;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;left:${(entry.slide.x / geometry.width) * 100}%;top:${(entry.slide.y / geometry.height) * 100}%;background:#ffc000;border:2px solid #4a3b00;transform:rotate(45deg);border-radius:2px;cursor:${entry.kind === "polar" ? "grab" : "pointer"};box-shadow:0 0 0 1px #fff9`;
      node.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        try {
          begin(entry, item, event);
        } catch (error) {
          options.onError?.(error);
        }
      });
      node.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && active) {
          event.preventDefault();
          cancel();
        } else if (event.key.startsWith("Arrow")) {
          event.preventDefault();
          event.stopPropagation();
          try {
            nudge(entry, item, event);
          } catch (error) {
            options.onError?.(error);
          }
        }
      });
      node.addEventListener("focus", () => node.setAttribute("data-focused", ""));
      node.addEventListener("blur", () => node.removeAttribute("data-focused"));
      layer.append(node);
    }
  }

  layer.addEventListener("pointermove", (event) => {
    if (!active || event.pointerId !== active.pointerId || !tools) return;
    const local = tools.toLocal(slidePoint(event), active.frame);
    active.local = local;
    active.moved = true;
    if (frame) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      if (active) preview(active.local);
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
  const onEscape = (event) => {
    if (event.key === "Escape" && active) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  };
  doc.addEventListener("keydown", onEscape, true);
  const unsubscribe = editor.subscribe(() => {
    if (committing || !active) return;
    if (signature(active.path) !== active.base) {
      cancel(false);
      options.onError?.(new Error("The shape changed elsewhere. The adjustment was cancelled."));
    }
  });

  return {
    /** The canvas's selection changed: show the handles when it is in a preset shape. */
    sync(path) {
      selected = path ?? null;
      if (active) cancel(false);
      update(lastPresentation, lastGeometry);
    },
    update,
    commit,
    cancel,
    hide() {
      layer.replaceChildren();
    },
    get editingPath() {
      return active?.path ?? null;
    },
    destroy() {
      destroyed = true;
      if (frame) win.cancelAnimationFrame(frame);
      doc.removeEventListener("keydown", onEscape, true);
      unsubscribe?.();
      layer.remove();
    },
  };
}
