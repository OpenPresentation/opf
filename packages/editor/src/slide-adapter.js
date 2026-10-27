// CE-19: the studio kit's document adapter for the slides of a deck, over an editor session. Layout Studio has `layout-adapter.js` over its
// record model; this is the same contract over `createEditorSession`: keys are id paths (`/slides/@intro/blocks/@kpi`, see
// `slide-scene.js`), boxes and containers come from the composed layout geometry of the current slide, a trial move runs the edit
// without applying it, and every edit is ONE validated `applyPatch` guarded by `expectHash` (the document must still be the one the edit
// was computed from). A gesture (a drag, a divider) previews drafts without writing to the document and lands as one undo step. No DOM:
// the Studio (CE-20) draws, this answers.
import { resolveSlideContext } from "@openpresentation/opf";
import { composeSlide } from "@openpresentation/opf/composition";
import { documentHash, resolveIdPointer, toIdPointer } from "@openpresentation/opf/ids";
import { parsePointer } from "@openpresentation/opf/patch";
import { createGesture } from "./studio-kit/gesture.js";
import { dropTarget, slideScene } from "./slide-scene.js";
import {
  copyScene,
  prepareSceneDelete,
  prepareSceneDuplicate,
  prepareSceneEqualize,
  prepareSceneGroup,
  prepareSceneMove,
  prepareSceneMoveBy,
  prepareSceneMoveInto,
  prepareSceneMoveSlides,
  prepareScenePaste,
  prepareSceneTrackResize,
  prepareSceneUngroup,
  prepareSceneWeights,
} from "./slide-edits.js";

const COMMANDS = {
  move: prepareSceneMove,
  moveBy: prepareSceneMoveBy,
  moveInto: prepareSceneMoveInto,
  group: prepareSceneGroup,
  ungroup: prepareSceneUngroup,
  duplicate: prepareSceneDuplicate,
  delete: prepareSceneDelete,
  resizeTracks: prepareSceneTrackResize,
  equalize: prepareSceneEqualize,
  setWeights: prepareSceneWeights,
  paste: prepareScenePaste,
  moveSlides: prepareSceneMoveSlides,
};
/** The command names `prepare`, `apply` and `run` take. */
export const SLIDE_COMMANDS = Object.freeze(Object.keys(COMMANDS));

/** Core composition of slide `slideIndex` (portable text estimate unless `fonts` measure), as the session's `composeSlide` does. */
export function composeSlideGeometry(presentation, slideIndex, { catalogs, fonts } = {}) {
  const { slide, options } = resolveSlideContext(presentation, slideIndex, { catalogs, fonts });
  return composeSlide(slide, options);
}

/**
 * The studio document adapter of the slides of `session`. Options:
 * - `slideIndex` (default 0): the slide the scene shows; `setSlide` changes it;
 * - `geometry(presentation, slideIndex)`: the `SlideComposition` of a slide as it is drawn (the canvas's `onRender` geometry, or the
 *   renderer's `resolvePresentation(...).slides[i].geometry` with the canvas fonts); default core composition with the session's catalogs;
 * - `selection()`: the keys selected now, recorded with each change (`meta.selection`) so undo and redo can restore them;
 * - `onPreview({ presentation, message })`: draw a gesture's draft (`presentation` is null when the gesture ends or is cancelled);
 * - `onSelection(keys, { source })`: the keys to select after an edit, an undo or a redo;
 * - `onRefuse({ reason, command })`: a command was refused (the Studio's status line and live region).
 */
export function createSlideAdapter(session, options = {}) {
  if (!session || typeof session.applyPatch !== "function") throw new TypeError("createSlideAdapter needs an editor session.");
  let slideIndex = options.slideIndex ?? 0;
  let draft = null; // the prepared change a gesture shows
  let lastResult = null;
  const geometryOf = options.geometry ?? ((presentation, index) => composeSlideGeometry(presentation, index, { catalogs: session.catalogs }));
  const document = () => session.snapshot().presentation;
  const catalogs = () => session.catalogs;

  // One scene per (document, slide); the draft's while a gesture previews one.
  let cache = { doc: null, index: -1, scene: null };
  function sceneFor(doc, index) {
    if (cache.doc === doc && cache.index === index) return cache.scene;
    const findings = doc === document() ? session.validation?.findings ?? [] : [];
    const scene = slideScene(doc, index, { geometry: geometryOf(doc, index), findings });
    cache = { doc, index, scene };
    return scene;
  }
  const clampSlide = () => { const count = document().slides?.length ?? 0; slideIndex = Math.max(0, Math.min(slideIndex, count - 1)); return slideIndex; };
  const committedScene = () => sceneFor(document(), clampSlide());
  const scene = () => (draft ? sceneFor(draft.presentation, Math.min(slideIndex, draft.presentation.slides.length - 1)) : committedScene());

  // Trial moves are asked on every pointer move of a drag: one answer per (document, keys, target, index).
  let trials = { doc: null, map: new Map() };
  function trialMove(keys, target, index) {
    const doc = document();
    if (trials.doc !== doc) trials = { doc, map: new Map() };
    const id = JSON.stringify([keys, target, index]);
    if (!trials.map.has(id)) {
      let answer;
      try {
        const prepared = prepareSceneMove(doc, committedScene(), keys, target, index, { catalogs: catalogs() });
        answer = { ok: true, reason: "", noop: !prepared.changed };
      } catch (error) {
        answer = { ok: false, reason: error?.message ?? String(error), noop: false };
      }
      trials.map.set(id, answer);
    }
    return trials.map.get(id);
  }

  /** Prepare `command` against the session's document without applying it (a refusal throws, with the reason as its message). */
  function prepare(command, ...args) {
    const run = COMMANDS[command];
    if (!run) throw new TypeError(`Unknown slide command ${command}.`);
    const doc = document();
    const last = args.length && args.at(-1) && typeof args.at(-1) === "object" && !Array.isArray(args.at(-1)) && !args.at(-1).kind ? args.pop() : {};
    const prepared = run(doc, committedScene(), ...args, { ...last, catalogs: catalogs() });
    // CE-20: a caller may name the step itself (`{ label }` as the last argument: "Inserted chart" for a paste of a new block).
    return { ...prepared, ...(typeof last.label === "string" ? { label: last.label } : {}), base: doc, command };
  }

  // Selections recorded per undo depth, so undo and redo restore the selection of the edit they cross.
  const selections = new Map();
  let applying = false;
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "patch" && !applying) selections.delete(event.snapshot.undoDepth);
    if (event.type === "restore") selections.clear();
  });
  const keysFor = (doc, paths) => (paths ?? []).map((path) => { try { return toIdPointer(doc, path); } catch { return path; } });

  /** Apply a prepared change as one undo step, guarded by the hash of the document it was prepared from. */
  function commitPrepared(prepared, message) {
    if (!prepared?.changed) return result({ ok: true, changed: false, keys: keysFor(document(), prepared?.paths), label: prepared?.label ?? message });
    const before = options.selection?.() ?? [];
    const label = message ?? prepared.label;
    applying = true;
    try {
      session.applyPatch(prepared.patches, { source: "studio", label, command: prepared.command, selection: before, rejectInvalid: true }, { expectHash: documentHash(prepared.base) });
    } catch (error) {
      const reason = error?.code === "patch-hash-mismatch" ? "The document changed while this edit was prepared. Nothing was changed; try again." : error?.message ?? String(error);
      return refused(reason, prepared.command);
    } finally {
      applying = false;
    }
    const doc = document();
    const keys = keysFor(doc, prepared.paths);
    selections.set(session.snapshot().undoDepth, { before, after: keys });
    if (prepared.paths?.[0]) {
      const slide = parsePointer(prepared.paths[0]);
      if (slide[0] === "slides" && /^\d+$/.test(slide[1] ?? "")) slideIndex = Number(slide[1]);
    }
    options.onSelection?.(keys, { source: prepared.command ?? "studio" });
    return result({ ok: true, changed: true, keys, label });
  }
  function result(value) { lastResult = value; return value; }
  function refused(reason, command) {
    options.onRefuse?.({ reason, command });
    return result({ ok: false, changed: false, keys: [], reason });
  }

  /** Prepare and apply `command` as one undo step. Returns `{ ok, changed, keys, label, reason }`; a refusal changes nothing. */
  function apply(command, ...args) {
    let prepared;
    try {
      prepared = prepare(command, ...args);
    } catch (error) {
      if (error instanceof TypeError && /^Unknown slide command/.test(error.message)) throw error;
      return refused(error?.message ?? String(error), command);
    }
    return commitPrepared(prepared);
  }

  // A gesture over the kit's gesture history: drafts are prepared changes, shown through `onPreview`; the end applies the last one.
  const gesture = createGesture({
    snapshot: () => document(),
    preview(prepared, message) {
      draft = prepared?.changed ? prepared : null;
      options.onPreview?.({ presentation: draft?.presentation ?? null, message });
    },
    commit(start, { message }) {
      const last = draft;
      draft = null;
      options.onPreview?.({ presentation: null, message });
      if (!last) return false;
      if (last.base !== start) { refused("The document changed during the gesture. Nothing was changed.", last.command); return false; }
      return commitPrepared(last, message).changed;
    },
    restore() {
      draft = null;
      options.onPreview?.({ presentation: null });
    },
  });

  const historyStep = (direction) => {
    const depth = session.snapshot().undoDepth;
    const change = direction < 0 ? session.undo({ source: "studio" }) : session.redo({ source: "studio" });
    if (!change) return false;
    const entry = selections.get(direction < 0 ? depth : session.snapshot().undoDepth);
    if (entry) options.onSelection?.(direction < 0 ? entry.before : entry.after, { source: direction < 0 ? "undo" : "redo" });
    return true;
  };

  const slideKeyAt = (doc, index) => toIdPointer(doc, `/slides/${index}`);
  const isSlideKey = (key) => typeof key === "string" && !key.includes("#") && parsePointer(key).length === 2 && parsePointer(key)[0] === "slides";
  const slideOf = (key) => { try { return Number(parsePointer(resolveIdPointer(document(), key))[1]); } catch { return -1; } };

  /** The kit selection's adapter: slide keys at the top (nothing selected is the deck), then the current slide's tree. */
  function selectionAdapter() {
    return {
      exists: (key) => (isSlideKey(key) ? slideOf(key) >= 0 : Boolean(scene().node(key))),
      parent: (key) => (isSlideKey(key) ? null : scene().node(key)?.parent ?? null),
      firstChild(key) {
        const s = scene();
        if (isSlideKey(key) && slideOf(key) !== slideIndex) return null;
        const first = s.children(isSlideKey(key) ? s.slideKey : key).find((node) => node.kind !== "part");
        return first?.key ?? null;
      },
      sibling(key, delta) {
        if (isSlideKey(key)) { const doc = document(); const at = slideOf(key) + delta; return at >= 0 && at < doc.slides.length ? slideKeyAt(doc, at) : null; }
        const s = scene(), node = s.node(key);
        if (!node?.parent) return null;
        const list = s.children(node.parent).filter((child) => child.kind !== "part");
        return list[list.findIndex((child) => child.key === key) + delta]?.key ?? null;
      },
      first: () => scene().slideKey,
      siblings(key) {
        if (isSlideKey(key)) { const doc = document(); return doc.slides.map((_, at) => slideKeyAt(doc, at)); }
        const s = scene(), node = s.node(key);
        return node?.parent ? s.children(node.parent).filter((child) => child.kind !== "part").map((child) => child.key) : [key];
      },
    };
  }

  return {
    session,
    get slideIndex() { return clampSlide(); },
    /** Show slide `indexOrKey` (an index or a slide key). Returns false when there is no such slide. */
    setSlide(indexOrKey) {
      const index = typeof indexOrKey === "number" ? indexOrKey : slideOf(indexOrKey);
      if (!Number.isInteger(index) || index < 0 || index >= (document().slides?.length ?? 0)) return false;
      slideIndex = index;
      return true;
    },
    /** The scene of the current slide (of the gesture's draft while one previews). */
    scene,
    /** The slides of the deck, for the filmstrip: `{ key, path, index, label, hidden }`. */
    slides() {
      const doc = document();
      return (doc.slides ?? []).map((slide, index) => ({ key: slideKeyAt(doc, index), path: `/slides/${index}`, index, label: `Slide ${index + 1}${typeof slide.layout === "string" && slide.layout !== "auto" ? ` · ${slide.layout}` : ""}`, hidden: slide.hidden === true }));
    },
    /** The current slide's nodes as the kit's layers and overlay read them. */
    nodes: () => scene().nodes.map(({ key, path, kind, parent, depth, label, findings }) => ({ key, path, kind, parent, depth, label, findings })),
    boxOf: (key) => scene().boxOf(key),
    containerOf: (key) => scene().containerOf(key),
    /** The boxes under a unit point, outermost first (the kit's signature; `skip(box)` leaves boxes out, `box.node` is the scene node). */
    hitChain: (point, skip, hitOptions = {}) => scene().hitChain(point, { ...hitOptions, skip }),
    /** The node a click on `chain` selects (see `SlideScene.target`). */
    target: (chain, targetOptions = {}) => scene().target(chain, { primary: options.selection?.().at(-1) ?? null, ...targetOptions }),
    trialMove,
    /** Where the dragged `keys` would land at `point`, with the trial's answer: `{ target, index, line, into, ok, reason, noop }`, or null. */
    dropAt(point, keys) {
      const found = dropTarget(committedScene(), point, keys);
      if (!found) return null;
      return { ...found, ...trialMove(keys, found.target, found.index) };
    },
    selectionAdapter,
    /** The key of an index pointer in the current document (its id path), or the pointer when it does not resolve. */
    keyOf: (path) => keysFor(document(), [path])[0],
    /** The index pointer a key names now, or null when it is gone (a virtual region key gives its slide's pointer). */
    pathOf(key) {
      try { return resolveIdPointer(document(), key.split("#")[0]); } catch { return null; }
    },
    /** The nearest existing node at or above `key` on the current slide (selection after an edit by someone else). */
    survivor: (key) => scene().survivor(key),
    /** Give every slide and block an id (one undoable change named "Add ids"), so keys survive reorders. Returns whether ids were added. */
    ensureIds() {
      const change = session.assignIds({}, { source: "assign-ids", label: "Add ids" });
      return Boolean(change);
    },
    prepare,
    apply,
    /** `apply(command, ...args).changed`, for the kit's `run`. */
    run: (command, ...args) => apply(command, ...args).changed,
    get lastResult() { return lastResult; },
    /** What the clipboard holds for `keys` (`copyScene`); paste it with `apply("paste", clip, { target, index })`. */
    copy: (keys) => copyScene(document(), committedScene(), keys, { catalogs: catalogs() }),
    begin: (label) => gesture.begin(label),
    /** Show a draft: a change from `prepare` (or null to show the document). Nothing is written until `commit`. */
    preview: (prepared, message) => { gesture.update(prepared, message); },
    commit: (message) => gesture.end(message),
    cancel: () => { gesture.cancel(); },
    get gestureActive() { return gesture.active; },
    undo: () => historyStep(-1),
    redo: () => historyStep(1),
    destroy() { gesture.reset(); draft = null; unsubscribe(); },
  };
}
