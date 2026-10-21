// The state shared by the parts of the layout editor (RR-99): the record being edited, the selection, the active tool, live validation
// by core, and the editor's own undo history. The palette, canvas, layers and inspector are views of one model, so a host that lays
// them out differently only passes the same model to each. Every change goes through a command here, which runs a pure operation of
// `layout-tree.js`, validates the result and records one history step. No DOM, no network.
import { validateCatalogRecord } from "@openpresentation/opf";
import { layoutTemplateIssues } from "@openpresentation/opf/composition";
import {
  LayoutOperationError, clone, deleteNodes, duplicateNodes, equalizePair, insertRegion, isSplit, listAt, moveIntoSibling, moveNodes, nodeAt, nodes, nudgePair,
  parentDirection, removeDesignHint, reorderNode, samePath, setLayoutProperty, setProperty, splitRegion, toggleHeading, unwrapNode, wrapNodes,
} from "./layout-tree.js";

/** The `$schema` of a layout record; core's catalog validation expects it. */
export const LAYOUT_SCHEMA = "https://openpresentation.org/schema/opf-layout/v2";
export const LAYOUT_TOOLS = Object.freeze(["select", "split-row", "split-column", "insert", "heading", "hand"]);
const COALESCE_MS = 1500;
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** A blank layout: a title and one content region. */
export const blankLayoutRecord = () => ({ id: "my-layout", name: "My layout", direction: "column", regions: [{ name: "title" }, { name: "content" }] });

const unescape = (segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~");
/**
 * Where a finding points: `node` is the path of the region or split (`[]` for the layout itself) and `field` the property
 * (`size`, `name`, `direction`, `regions`...), read from the finding's JSON Pointer (`/regions/1/regions/0/size`).
 */
export function findingLocation(pointer) {
  const parts = String(pointer ?? "").split("/").slice(1).map(unescape);
  const node = [];
  let at = 0;
  while (parts[at] === "regions" && /^\d+$/.test(parts[at + 1] ?? "")) { node.push(Number(parts[at + 1])); at += 2; }
  return { node, field: parts[at] ?? null };
}

/** Core's validation of a layout record: schema, `opf/layout-template` and `opf/layout-region`, as `{ ruleId, severity, message, path, node, field }`. */
export function validateLayoutRecord(record) {
  let raw;
  try {
    raw = validateCatalogRecord("layouts", { ...record, $schema: LAYOUT_SCHEMA }).findings.map((finding) => ({ ruleId: finding.ruleId, severity: finding.severity, message: finding.message, path: finding.path ?? "" }));
  } catch {
    raw = layoutTemplateIssues(record).map((issue) => ({ ruleId: `opf/${issue.code}`, severity: "error", message: issue.message, path: issue.path }));
  }
  return raw.map((finding) => {
    const located = { ...finding, ...findingLocation(finding.path) };
    // A name used twice is reported on the later region; the earlier one is part of the problem, so it is marked too (`also`).
    const twice = located.field === "name" ? /'([^']+)' is used twice/.exec(located.message) : null;
    if (twice) located.also = nodes(record).filter(({ entry, path }) => entry.name === twice[1] && !samePath(path, located.node)).map(({ path }) => path);
    return located;
  });
}

/** The record as a catalog entry for `saveCustomLayout`: `{ id, record }` without `$schema` and `id` inside the record. */
export function layoutForCatalog(record) {
  const { $schema, id, ...rest } = clone(record);
  void $schema;
  return { id, record: rest };
}

function describe(record, path) {
  const node = nodeAt(record, path);
  if (!node) return "the layout";
  return isSplit(node) ? `the ${node.direction === "row" ? "row" : "column"} split` : node.name;
}

/**
 * Create the shared state. Options: `record` (default a blank layout), `density` ("comfortable" | "touch"), `readOnly`, `onChange(record)`
 * (called after each edit, undo and redo, not after `setRecord`) and `historyLimit` (default 200 steps).
 */
export function createLayoutModel(options = {}) {
  const listeners = new Set();
  const state = {
    record: normalize(options.record ?? blankLayoutRecord()),
    selection: [],
    tool: "select",
    preview: false,
    density: options.density === "touch" ? "touch" : "comfortable",
    readOnly: Boolean(options.readOnly),
    findings: [],
    notice: null,
    renaming: null,
  };
  const history = { entries: [], index: 0 };
  const limit = options.historyLimit ?? 200;
  let gesture = null;
  let destroyed = false;
  let onChange = options.onChange;
  state.findings = validateLayoutRecord(state.record);
  history.entries.push({ record: clone(state.record), selection: [] });

  const emit = (event) => { if (!destroyed) for (const listener of [...listeners]) listener({ ...event, model }); };
  const notice = (message, kind = "info") => { state.notice = message ? { message, kind, at: Date.now() } : null; emit({ type: "notice" }); };
  const validate = () => { state.findings = validateLayoutRecord(state.record); };
  const existing = (paths) => (paths ?? []).filter((path) => path.length && nodeAt(state.record, path));
  const snapshot = () => ({ record: clone(state.record), selection: state.selection.map((path) => [...path]) });
  const fire = () => { try { onChange?.(clone(state.record)); } catch (error) { console.error(error); } };

  function push(snap, coalesce) {
    const head = history.entries[history.index];
    const now = Date.now();
    if (coalesce && head?.coalesce === coalesce && now - head.time < COALESCE_MS && history.index === history.entries.length - 1 && history.index > 0) {
      history.entries[history.index] = { ...snap, coalesce, time: now };
      return;
    }
    history.entries.length = history.index + 1;
    history.entries.push({ ...snap, coalesce, time: now });
    if (history.entries.length > limit) history.entries.shift(); else history.index++;
  }

  /** Run `operation(record)` -> `{ record, selection }`; a refusal is a notice, and nothing changes. */
  function run(message, operation, { coalesce } = {}) {
    if (state.readOnly) { notice("This layout is read only.", "error"); return false; }
    if (gesture) return false;
    let outcome;
    try { outcome = operation(state.record); } catch (error) {
      if (error instanceof LayoutOperationError) { notice(error.message, "error"); return false; }
      throw error;
    }
    if (JSON.stringify(outcome.record) === JSON.stringify(state.record)) { if (outcome.selection) select(outcome.selection); return false; }
    state.record = outcome.record;
    if (outcome.selection) state.selection = outcome.selection.filter((path) => nodeAt(state.record, path));
    else state.selection = existing(state.selection);
    validate();
    push(snapshot(), coalesce);
    state.notice = message ? { message: typeof message === "function" ? message(outcome) : message, kind: "info", at: Date.now() } : null;
    emit({ type: "record", message: state.notice?.message });
    fire();
    return true;
  }

  function select(paths, { source } = {}) {
    const next = existing(paths).map((path) => [...path]);
    if (next.length === state.selection.length && next.every((path, index) => samePath(path, state.selection[index]))) return false;
    state.selection = next;
    emit({ type: "selection", source });
    return true;
  }

  const model = {
    get record() { return state.record; },
    get selection() { return state.selection; },
    get primary() { return state.selection[state.selection.length - 1] ?? null; },
    get tool() { return state.tool; },
    get preview() { return state.preview; },
    get density() { return state.density; },
    get readOnly() { return state.readOnly; },
    get findings() { return state.findings; },
    get notice() { return state.notice; },
    get renaming() { return state.renaming; },
    get gesturing() { return gesture !== null; },

    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setOnChange(callback) { onChange = callback; },
    getRecord: () => clone(state.record),
    /** Replace the record (a layout the host loaded). Resets the selection and, by default, the history; does not call `onChange`. */
    setRecord(record, { keepHistory = false } = {}) {
      state.record = normalize(record);
      state.selection = [];
      gesture = null;
      state.renaming = null;
      validate();
      if (keepHistory) { history.entries.length = history.index + 1; history.entries.push({ ...snapshot(), time: Date.now() }); history.index++; }
      else { history.entries = [{ ...snapshot() }]; history.index = 0; }
      emit({ type: "load" });
    },

    select,
    /** Shift-click: add a sibling of the selection, else replace it. */
    selectAdd(path) {
      const current = state.selection;
      if (!current.length || !existing([path]).length) return select([path]);
      const parent = path.slice(0, -1);
      if (!samePath(current[0].slice(0, -1), parent)) return select([path]);
      const has = current.some((entry) => samePath(entry, path));
      return select(has ? current.filter((entry) => !samePath(entry, path)) : [...current, path]);
    },
    selectParent() {
      const path = model.primary;
      if (!path) return false;
      return select(path.length > 1 ? [path.slice(0, -1)] : []);
    },
    selectChild() {
      const path = model.primary;
      const node = path && nodeAt(state.record, path);
      if (!node || !isSplit(node) || !node.regions?.length) return false;
      return select([[...path, 0]]);
    },
    /** Move the selection to a sibling (`delta` -1 or 1), or to the first entry when nothing is selected. */
    selectSibling(delta) {
      const path = model.primary;
      if (!path) return select(state.record.regions.length ? [[0]] : []);
      const list = listAt(state.record, path.slice(0, -1));
      const at = path[path.length - 1] + delta;
      if (!list || at < 0 || at >= list.length) return false;
      return select([[...path.slice(0, -1), at]]);
    },
    setTool(tool) {
      if (!LAYOUT_TOOLS.includes(tool) || state.tool === tool) return false;
      state.tool = tool;
      emit({ type: "tool" });
      return true;
    },
    setPreview(on) { if (state.preview === Boolean(on)) return false; state.preview = Boolean(on); emit({ type: "view" }); return true; },
    setDensity(density) { const next = density === "touch" ? "touch" : "comfortable"; if (state.density === next) return; state.density = next; emit({ type: "view" }); },
    setReadOnly(on) { state.readOnly = Boolean(on); emit({ type: "view" }); },
    notify: notice,
    /** Ask one surface (`"canvas"` or `"layers"`) to edit the name of the region at `path`; `null` ends it. */
    requestRename(path, surface = "canvas") { state.renaming = path ? { path: [...path], surface } : null; emit({ type: "rename" }); },

    // --- commands: each is one history step ---
    splitRegion: (path, axis) => run((o) => `Split ${describe(o.record, path)} into a ${axis}`, (record) => splitRegion(record, path, axis)),
    insertRegion: (listPath, index, entry) => run((o) => `Inserted ${describe(o.record, o.selection[0])}`, (record) => insertRegion(record, listPath, index, entry)),
    toggleHeading: (name) => run((o) => (nodes(o.record).some(({ entry }) => entry.name === name) ? `Added the ${name} region` : `Removed the ${name} region`), (record) => toggleHeading(record, name)),
    wrap: (paths, axis) => run(`Wrapped in a ${axis}`, (record) => wrapNodes(record, paths, axis)),
    unwrap: (path) => run("Unwrapped the split", (record) => unwrapNode(record, path)),
    duplicate: (paths) => run((o) => `Duplicated as ${o.selection.map((path) => describe(o.record, path)).join(", ")}`, (record) => duplicateNodes(record, paths)),
    remove: (paths) => run(paths.length > 1 ? `Deleted ${paths.length} nodes` : `Deleted ${describe(state.record, paths[0])}`, (record) => deleteNodes(record, paths)),
    move: (paths, listPath, index) => run((o) => `Moved ${o.selection.map((path) => describe(o.record, path)).join(", ")}`, (record) => moveNodes(record, paths, listPath, index)),
    reorder: (path, delta) => run((o) => `Moved ${describe(o.record, o.selection[0])} ${delta < 0 ? "earlier" : "later"}`, (record) => reorderNode(record, path, delta)),
    moveInto: (path, delta) => run((o) => `Moved ${describe(o.record, o.selection[0])} into the ${delta < 0 ? "previous" : "next"} split`, (record) => moveIntoSibling(record, path, delta)),
    setProperty: (path, key, value, opts) => run(null, (record) => setProperty(record, path, key, value), { coalesce: opts?.coalesce ?? `p:${path.join(".")}:${key}` }),
    setLayoutProperty: (key, value, opts) => run(null, (record) => setLayoutProperty(record, key, value), { coalesce: opts?.coalesce ?? `l:${key}` }),
    removeDesignHint: (key) => run(`Removed the ${key} design hint`, (record) => removeDesignHint(record, key)),
    equalize: (listPath, index) => run("Made the two sides equal", (record) => equalizePair(record, listPath, index)),
    nudge: (listPath, index, steps, big) => run(null, (record) => nudgePair(record, listPath, index, steps, big), { coalesce: `n:${listPath.join(".")}:${index}` }),

    // --- gestures: a drag is one step ---
    beginGesture(label) {
      if (state.readOnly || gesture) return false;
      gesture = { label, record: state.record, selection: state.selection };
      return true;
    },
    /** Show a record while the gesture runs (no history, no `onChange`). */
    updateGesture(record, message) {
      if (!gesture) return;
      state.record = record;
      validate();
      state.notice = message ? { message, kind: "info", at: Date.now(), live: true } : state.notice;
      emit({ type: "record", source: "gesture" });
    },
    endGesture(message) {
      if (!gesture) return false;
      const { record, label } = gesture;
      gesture = null;
      if (JSON.stringify(record) === JSON.stringify(state.record)) { emit({ type: "record", source: "gesture-end" }); return false; }
      state.selection = existing(state.selection);
      push(snapshot());
      state.notice = { message: message ?? label, kind: "info", at: Date.now() };
      emit({ type: "record", source: "gesture-end", message: state.notice.message });
      fire();
      return true;
    },
    cancelGesture() {
      if (!gesture) return;
      state.record = gesture.record;
      state.selection = gesture.selection;
      gesture = null;
      validate();
      emit({ type: "record", source: "gesture-cancel" });
    },

    // --- history ---
    canUndo: () => history.index > 0 && !gesture,
    canRedo: () => history.index < history.entries.length - 1 && !gesture,
    undo() { return jump(-1); },
    redo() { return jump(1); },

    // --- findings ---
    /** The findings that point at the node at `path` (`[]` is the layout), optionally of one `field`. */
    findingsFor(path, field) {
      return state.findings.filter((finding) => (samePath(finding.node, path) || finding.also?.some((other) => samePath(other, path))) && (field === undefined || finding.field === field));
    },
    /** The findings at or below the node at `path` (every finding for `[]`). */
    findingsWithin(path) { return state.findings.filter((finding) => [finding.node, ...(finding.also ?? [])].some((node) => path.every((part, index) => node[index] === part))); },
    nodeAt: (path) => nodeAt(state.record, path),
    parentDirection: (path) => parentDirection(state.record, path),
    describe: (path) => describe(state.record, path),
    destroy() { destroyed = true; listeners.clear(); },
  };

  function jump(step) {
    const target = history.index + step;
    if (gesture || target < 0 || target >= history.entries.length) return false;
    history.index = target;
    const entry = history.entries[target];
    state.record = clone(entry.record);
    state.selection = existing(entry.selection);
    validate();
    state.notice = { message: step < 0 ? "Undid the last change" : "Redid the change", kind: "info", at: Date.now() };
    emit({ type: "record", source: "history", message: state.notice.message });
    fire();
    return true;
  }

  return model;
}

function normalize(record) {
  if (!isObject(record) || !Array.isArray(record.regions)) throw new TypeError("A layout record needs a regions list.");
  return clone(record);
}
