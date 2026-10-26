// CE-18: Layout Studio's document adapter for the studio kit. The kit works on keys, boxes, containers, trial moves and gestures; this file
// says what those are for a layout record: a key is a node's index path (`[]` is the layout itself, `[1, 0]` is `regions[1].regions[0]`),
// boxes and dividers come from `layoutBoxes`, a trial move is `moveNodes` run without applying it, and a gesture is the model's. The slide
// adapter (CE-19) answers the same questions for a slide of a deck. No DOM.
import { LayoutOperationError, isHeading, isPrefix, isSplit, layoutBoxes, listAt, moveNodes, nodeAt, pathKey, samePath } from "./layout-tree.js";
import { boxesAt } from "./studio-kit/overlay.js";
import { clickTarget } from "./studio-kit/selection.js";

/** The kit selection's adapter over the record `getRecord()` returns: keys are index paths, the layout itself is never selected. */
export function layoutSelectionAdapter(getRecord) {
  return {
    equals: samePath,
    copy: (path) => [...path],
    exists: (path) => path.length > 0 && Boolean(nodeAt(getRecord(), path)),
    parent: (path) => (path.length > 1 ? path.slice(0, -1) : null),
    firstChild(path) {
      const node = nodeAt(getRecord(), path);
      return node && isSplit(node) && node.regions?.length ? [...path, 0] : null;
    },
    sibling(path, delta) {
      const list = listAt(getRecord(), path.slice(0, -1));
      const at = path[path.length - 1] + delta;
      return !list || at < 0 || at >= list.length ? null : [...path.slice(0, -1), at];
    },
    first: () => (getRecord().regions.length ? [0] : null),
    siblings(path) {
      const list = listAt(getRecord(), path.slice(0, -1)) ?? [];
      return list.map((_, index) => [...path.slice(0, -1), index]);
    },
  };
}

/** Where moving `paths` to `index` of the list at `listPath` would go: `{ ok, reason, noop }` (a refusal's reason is the operation's message). */
export function trialMove(record, paths, listPath, index) {
  try {
    const moved = moveNodes(record, paths, listPath, index);
    return { ok: true, reason: "", noop: JSON.stringify(moved.record) === JSON.stringify(record) };
  } catch (error) {
    if (!(error instanceof LayoutOperationError)) throw error;
    return { ok: false, reason: error.message, noop: false };
  }
}

/**
 * The studio document adapter of a layout model (`createLayoutModel`). `geometry()` is `layoutBoxes` of the current record (computed once per
 * record); `nodes()` lists `{ key, path, kind, parent, depth, label, findings }`; `boxOf`, `containerOf`, `hitChain`, `target` and
 * `trialMove` answer the canvas and the layers; `begin`, `preview`, `commit` and `cancel` are the model's gesture; `run(name, ...args)` runs
 * one of the model's commands; `undo` and `redo` its history.
 */
export function createLayoutAdapter(model) {
  let cached = null, cachedFor = null;
  const geometry = () => {
    if (cachedFor !== model.record) { cached = layoutBoxes(model.record); cachedFor = model.record; }
    return cached;
  };
  const boxOf = (path) => geometry().nodes.find((box) => samePath(box.path, path));
  return {
    geometry,
    nodes() {
      return geometry().nodes.map((box) => ({
        key: pathKey(box.path),
        path: box.path,
        kind: isSplit(box.entry) ? "split" : isHeading(box.entry) ? "heading" : "region",
        parent: box.path.length > 1 ? pathKey(box.path.slice(0, -1)) : null,
        depth: box.depth,
        label: model.describe(box.path),
        findings: model.findingsFor(box.path),
      }));
    },
    boxOf,
    /** The direction and the tracks of the layout (`[]`) or of a split, for its dividers and drop lines. */
    containerOf(path) {
      const entry = path.length ? nodeAt(model.record, path) : model.record;
      if (!entry || (path.length && !isSplit(entry))) return undefined;
      const direction = entry.direction === "row" ? "row" : "column";
      const tracks = geometry().nodes.filter((box) => box.path.length === path.length + 1 && isPrefix(path, box.path)).map((box) => (direction === "row" ? { start: box.x, length: box.w } : { start: box.y, length: box.h }));
      return { direction, tracks };
    },
    /** The boxes under a unit point, from the layout's outermost split to the deepest region (`skip(box)` leaves boxes out). */
    hitChain: (point, skip) => boxesAt(geometry().nodes, point, { skip }),
    /** The box a click on `chain` selects: the deepest, or one level into a selected split. */
    target: (chain, { shift = false } = {}) => clickTarget(chain, model.primary, { shift, equals: samePath, keyOf: (box) => box.path, isContainer: (box) => isSplit(box.entry) }),
    trialMove: (paths, listPath, index) => trialMove(model.record, paths, listPath, index),
    begin: (label) => model.beginGesture(label),
    preview: (record, message) => model.updateGesture(record, message),
    commit: (message) => model.endGesture(message),
    cancel: () => model.cancelGesture(),
    run(name, ...args) {
      if (!COMMANDS.has(name)) throw new TypeError(`Unknown layout command ${name}.`);
      return model[name](...args);
    },
    undo: () => model.undo(),
    redo: () => model.redo(),
  };
}
const COMMANDS = new Set(["splitRegion", "insertRegion", "toggleHeading", "wrap", "unwrap", "duplicate", "remove", "move", "reorder", "moveInto", "setProperty", "setLayoutProperty", "removeDesignHint", "equalize", "nudge"]);
