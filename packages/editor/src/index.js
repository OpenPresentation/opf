import { commitCatalogControl } from "./catalog-control.js";
import { paginateSlide } from "@openpresentation/opf/pagination";
import { OPFPatchError, applyPatch as applyCorePatch, applyPatchWithInverse, formatPointer, invertPatch, jsonEqual, parsePointer, readPointer } from "@openpresentation/opf/patch";
import { collectReservedPresentationIds } from "./presentation-ids.js";
import { composeSlide } from "@openpresentation/opf/composition";
import { catalogKinds, resolveSlideContext, stats } from "@openpresentation/opf";
import { checkFormat, errorFindings } from "./checks.js";
import { forkEditedRecords, forkNotice, listCatalogRecords, mergeCatalogs } from "./catalogs.js";

export {
  REFERENCE_FINDING_CODES,
  applyCatalogUpdate,
  catalogRecordAt,
  catalogRecordLabel,
  catalogsFor,
  checkCatalogUpdates,
  editedCatalogRecords,
  FORKED_RECORD_KINDS,
  forkEditedRecords,
  forkNotice,
  listCatalogRecords,
  mergeCatalogs,
  moveToCustom,
  prepareMoveToCustom,
  prepareSave,
  referenceFindings,
  saveDocument,
} from "./catalogs.js";

// The options `composeSlide` and `paginateSlide` take for one slide of the open deck. Core's `resolveSlideContext` resolves the
// slide's canvas, layout, theme, colour scheme and font families the one way every engine does (slide design, deck design,
// theme, engine default), with the session's registered catalogs, so the editor measures and composes what the renderer draws
// and the exporter writes. `options.fonts` is the renderer's fonts handle (its `textMeasurement` measures); `options.catalogs`
// adds catalogs for this call; `options.onDiagnostic` hears each diagnostic (`unresolved-reference`);
// any other option overrides the resolved one (`layout`, ...).
function slideContext(presentation, slideIndex, catalogs, { fonts, catalogs: _extra, onDiagnostic, ...overrides } = {}) {
  if (!Number.isInteger(slideIndex) || !presentation.slides?.[slideIndex]) throw new OPFEditorError("slide-index-out-of-range", "Slide index is out of range.");
  const { options, diagnostics } = resolveSlideContext(presentation, slideIndex, { fonts, catalogs });
  for (const diagnostic of diagnostics) onDiagnostic?.(diagnostic);
  return { ...options, ...overrides };
}

export const packageName = "@openpresentation/opf-editor";

export const releaseLane = Object.freeze({
  githubRepository: "OpenPresentation/opf-editor",
  npmPackage: "@openpresentation/opf-editor",
  compatibilityPackage: "@openpresentation/opf",
  rendererPackage: "@openpresentation/opf-render"
});

export const runtimePolicy = Object.freeze({
  hostedServiceInCriticalPath: false,
  telemetry: false,
  commercialSdkInCriticalPath: false,
  requiredNetworkCalls: false,
  deterministicLocalExecution: true
});

const DATA_OPF_PATH = "data-opf-path";
const COMPONENT_ATTR = "data-opf-component";
const SELECT_EVENT = "opfselect";

export class OPFEditorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OPFEditorError";
    this.code = code;
    this.details = details;
    if (details.path) this.path = details.path;
    if (details.issues) this.issues = details.issues;
  }
}

export function splitOpfPath(path) {
  if (Array.isArray(path)) return path.map((segment) => String(segment));
  if (typeof path !== "string") {
    throw new OPFEditorError("invalid-path", "OPF path must be a string or segment array.", { path });
  }
  if (path === "") return [];
  if (path.startsWith("/")) return parseJsonPointer(path);
  return path.split(".").filter(Boolean);
}

export function opfPathToJsonPointer(path) {
  return formatPointer(splitOpfPath(path));
}

export function jsonPointerToOpfPath(pointer) {
  return parseJsonPointer(pointer).join(".");
}

export function getValueAtPath(presentation, path, fallback) {
  const found = readPointer(presentation, splitOpfPath(path));
  return found.found ? found.value : fallback;
}

export function hasValueAtPath(presentation, path) {
  return readPointer(presentation, splitOpfPath(path)).found;
}

export function createValuePatch(presentation, path, value) {
  const pointer = normalizePatchPath(path);
  return [
    {
      op: hasValueAtPath(presentation, pointer) ? "replace" : "add",
      path: pointer,
      value: clone(value)
    }
  ];
}

// Patch semantics (RFC 6902, pointers, inverse patches) live in core's
// "@openpresentation/opf/patch"; the editor adds its path spellings (dotted OPF
// paths), its error type and its clone policy on top.
export function applyJsonPatch(presentation, operations) {
  assertPatchOperations(operations);
  const patch = operations.map(normalizeOperation);
  try {
    return applyCorePatch(presentation, patch);
  } catch (error) {
    throw editorPatchError(error);
  }
}

export function invertJsonPatch(presentation, operations) {
  assertPatchOperations(operations);
  const patch = operations.map(normalizeOperation);
  try {
    return invertPatch(presentation, patch);
  } catch (error) {
    throw editorPatchError(error);
  }
}

/**
 * Facts about the open presentation, from core's `stats`: slide, layout and section counts, payload kinds, words and notes coverage,
 * images and their alt text, charts, tables, citations, fonts and an estimated speaking time (`options`: `perSlide`, `values`,
 * `wordsPerMinute`). They are facts, never findings: no severities and no judgment about whether a number is too high, so a deck-info
 * view can show them next to the Review panel. It reads the JSON only, so it also works on a document that fails validation.
 */
export function deckStats(editor, options) {
  assertEditorSession(editor);
  return stats(editor.presentation, options);
}

export function createEditorSession(input, options = {}) {
  let presentation = parseInput(input);
  // The host's registered catalogs (FA-23): one list, handed to every core call, the renderer and the exporter.
  let catalogs = mergeCatalogs(options.catalogs);
  const check = (document) => checkFormat(document, { catalogs });
  let validation = check(presentation);
  const undoStack = [];
  const redoStack = [];
  const listeners = new Set();
  const rejectInvalid = Boolean(options.rejectInvalid);
  let snapshotCache;

  function emit(event) {
    snapshotCache = undefined;
    const snapshot = editor.snapshot();
    for (const listener of listeners) listener({ ...event, snapshot });
  }

  function commitPatch(operations, meta = {}) {
    assertPatchOperations(operations);
    let patches = operations.map(normalizeOperation);
    const before = presentation;
    let next, inversePatches;
    try {
      ({ presentation: next, inverse: inversePatches } = applyPatchWithInverse(before, patches));
    } catch (error) {
      throw editorPatchError(error);
    }
    // Owner rule (FA-23): an edit of a record under catalogs.default or a named group forks it into catalogs.custom (every reference
    // follows, the original is dropped), in this same undo step. Catalog updates and moves change catalog records on purpose.
    let forks = [];
    if (meta.catalogRecordEdit !== "in-place") {
      const forked = forkEditedRecords(before, next, { catalogs, forkIds: meta.forkIds });
      if (forked.forks.length) {
        forks = forked.forks;
        for (const key of new Set([...Object.keys(next), ...Object.keys(forked.document)]))
          if (!jsonEqual(next[key], forked.document[key])) patches = [...patches, forked.document[key] === undefined ? { op: "remove", path: formatPointer([key]) } : { op: Object.hasOwn(next, key) ? "replace" : "add", path: formatPointer([key]), value: clone(forked.document[key]) }];
        try {
          ({ presentation: next, inverse: inversePatches } = applyPatchWithInverse(before, patches));
        } catch (error) {
          throw editorPatchError(error);
        }
        meta = { ...meta, forked: forks, notice: forks.map(forkNotice).join(" ") };
      }
    }
    const nextValidation = check(next);

    if ((meta.rejectInvalid ?? rejectInvalid) && !nextValidation.valid) {
      throw new OPFEditorError("invalid-opf-edit", "OPF edit produced an invalid document.", {
        issues: errorFindings(nextValidation),
        patches
      });
    }

    if (patches.every(patch => patch.op === "test")) return {
      presentation: clone(presentation), patches: clonePatchOperations(patches), inversePatches: [], validation: nextValidation
    };
    presentation = next;
    validation = nextValidation;
    undoStack.push({ patches: clonePatchOperations(patches), inversePatches, meta });
    redoStack.length = 0;
    emit({
      type: "patch",
      patches: clonePatchOperations(patches),
      inversePatches: clonePatchOperations(inversePatches),
      validation,
      meta
    });

    return {
      presentation: clone(presentation),
      patches: clonePatchOperations(patches),
      inversePatches: clonePatchOperations(inversePatches),
      validation,
      ...(forks.length ? { forked: forks, notice: meta.notice } : {})
    };
  }

  const editor = {
    get presentation() {
      return clone(presentation);
    },
    get validation() {
      return validation;
    },
    /** The catalogs the host registered (`Catalog[]`, frozen): the first is the host default. */
    get catalogs() {
      return catalogs;
    },
    /**
     * Replace the registered catalogs (for example after the host loads a company catalog). The document is not changed; it is
     * re-validated against the new list (reference findings depend on it) and one `catalogs` event tells every view to redraw.
     */
    setCatalogs(next, meta = {}) {
      catalogs = mergeCatalogs(next);
      validation = check(presentation);
      emit({ type: "catalogs", patches: [], validation, meta });
      return catalogs;
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    snapshot() {
      return snapshotCache ??= freezeSnapshot({
        presentation: clone(presentation),
        validation: clone(validation),
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        undoDepth: undoStack.length,
        redoDepth: redoStack.length
      });
    },
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new OPFEditorError("invalid-listener", "Editor listener must be a function.");
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get(path, fallback) {
      return getValueAtPath(presentation, path, fallback);
    },
    set(path, value, meta = {}) {
      return commitPatch(createValuePatch(presentation, path, value), {
        ...meta,
        path: normalizePatchPath(path)
      });
    },
    composeSlide(slideIndex, options = {}) {
      return composeSlide(presentation.slides?.[slideIndex], slideContext(presentation, slideIndex, mergeCatalogs(catalogs, options.catalogs), options));
    },
    paginateSlide(slideIndex, options = {}, meta = {}) {
      const list = mergeCatalogs(catalogs, options.catalogs);
      // Core pagination reads the measurement from `fonts`, so the resolved context hands it over that way.
      const { textMeasurement, ...resolved } = slideContext(presentation, slideIndex, list, options);
      const pagination = paginateSlide(presentation.slides[slideIndex], {
        ...resolved,
        catalogs: list,
        fonts: options.fonts ?? (textMeasurement ? { textMeasurement } : undefined),
        reservedIds: collectReservedPresentationIds(presentation),
      });
      // Pagination can persist a readability policy without adding a page. Commit
      // that change too, so preview/export use the same minimum that was evaluated.
      if (pagination.slides.length === 1 && jsonEqual(pagination.slides[0], presentation.slides[slideIndex])) return { change: null, pagination };
      const slides = [...presentation.slides];
      slides.splice(slideIndex, 1, ...pagination.slides);
      const change = editor.set('slides', slides, { ...meta, rejectInvalid: true, pagination: pagination.pages });
      return { change, pagination };
    },
    setComposition(slideIndex, composition, meta = {}) {
      if (!Number.isInteger(slideIndex) || !presentation.slides?.[slideIndex]) throw new OPFEditorError("slide-index-out-of-range", "Slide index is out of range.");
      return editor.set(`slides.${slideIndex}.composition`, composition, { ...meta, rejectInvalid: true });
    },
    setGroupComposition(path, composition, meta = {}) {
      const pointer = normalizePatchPath(path);
      const group = editor.get(pointer);
      if (!pointer.startsWith("/slides/") || !group || !Array.isArray(group.blocks) || /^\/slides\/[^/]+$/.test(pointer)) throw new OPFEditorError("not-a-content-group", "Select a content group containing blocks.");
      return editor.set(`${pointer}/composition`, composition, { ...meta, rejectInvalid: true });
    },
    setCatalog(path, catalogKind, id, meta = {}) {
      return setCatalogId(editor, path, catalogKind, id, meta);
    },
    applyPatch: commitPatch,
    /**
     * The undo and redo stacks as plain data (oldest entry first): `{ undo: [{ patches, inversePatches, meta }], redo: [...] }`.
     * Together with `presentation` this is everything `restoreState` needs to bring a session back, for hosts that persist work.
     */
    exportHistory() {
      const entry = (item) => ({ patches: clonePatchOperations(item.patches), inversePatches: clonePatchOperations(item.inversePatches), meta: clone(item.meta ?? {}) });
      return { undo: undoStack.map(entry), redo: redoStack.map(entry) };
    },
    /**
     * Replace the document, and optionally the undo and redo history, in one step (a session that was persisted and is being restored).
     * The document is validated like any edit; the history is checked by replaying it (the inverse patches of the undo stack must walk
     * back from the document, the redo stack must walk forward), and a history that does not fit is refused with `invalid-history`
     * before anything changes, so a stale or damaged copy never corrupts the session. Emits one `restore` event.
     */
    restoreState(state, meta = {}) {
      if (!state || typeof state !== "object") throw new OPFEditorError("invalid-state", "restoreState needs { presentation, undo?, redo? }.");
      const next = parseInput(state.presentation);
      const nextValidation = check(next);
      if ((meta.rejectInvalid ?? rejectInvalid) && !nextValidation.valid) {
        throw new OPFEditorError("invalid-opf-edit", "The restored document is not valid OPF.", { issues: errorFindings(nextValidation) });
      }
      const undo = state.undo ?? [], redo = state.redo ?? [];
      const wellFormed = (entries) => Array.isArray(entries) && entries.every((item) => item && Array.isArray(item.patches) && Array.isArray(item.inversePatches));
      if (!wellFormed(undo) || !wellFormed(redo)) throw new OPFEditorError("invalid-history", "The undo history is not in the exported shape.");
      try {
        // The undo stack must walk back from the document and forward again to exactly the document; the redo stack must walk forward and
        // back again. Inverse patches alone would apply to any document, so the round trip is what ties the history to this one.
        let base = next;
        for (let at = undo.length - 1; at >= 0; at -= 1) base = applyJsonPatch(base, undo[at].inversePatches.map(normalizeOperation));
        let forward = base;
        for (let at = 0; at < undo.length; at += 1) forward = applyJsonPatch(forward, undo[at].patches.map(normalizeOperation));
        if (canonicalJson(forward) !== canonicalJson(next)) throw new Error("the undo history does not reproduce the document");
        let ahead = next;
        for (let at = redo.length - 1; at >= 0; at -= 1) ahead = applyJsonPatch(ahead, redo[at].patches.map(normalizeOperation));
        let back = ahead;
        for (let at = 0; at < redo.length; at += 1) back = applyJsonPatch(back, redo[at].inversePatches.map(normalizeOperation));
        if (canonicalJson(back) !== canonicalJson(next)) throw new Error("the redo history does not return to the document");
      } catch (error) {
        throw new OPFEditorError("invalid-history", "The undo history does not belong to this document.", { cause: error instanceof Error ? error.message : String(error) });
      }
      const entry = (item) => ({ patches: item.patches.map(normalizeOperation), inversePatches: item.inversePatches.map(normalizeOperation), meta: clone(item.meta ?? {}) });
      presentation = next;
      validation = nextValidation;
      undoStack.length = 0;
      redoStack.length = 0;
      undoStack.push(...undo.map(entry));
      redoStack.push(...redo.map(entry));
      emit({ type: "restore", patches: [], validation, meta });
      return { presentation: clone(presentation), patches: [], validation };
    },
    undo(meta = {}) {
      const entry = undoStack.pop();
      if (!entry) return null;
      presentation = applyJsonPatch(presentation, entry.inversePatches);
      validation = check(presentation);
      redoStack.push(entry);
      emit({
        type: "undo",
        patches: clonePatchOperations(entry.inversePatches),
        redoPatches: clonePatchOperations(entry.patches),
        validation,
        meta
      });
      return {
        presentation: clone(presentation),
        patches: clonePatchOperations(entry.inversePatches),
        redoPatches: clonePatchOperations(entry.patches),
        validation
      };
    },
    redo(meta = {}) {
      const entry = redoStack.pop();
      if (!entry) return null;
      presentation = applyJsonPatch(presentation, entry.patches);
      validation = check(presentation);
      undoStack.push(entry);
      emit({
        type: "redo",
        patches: clonePatchOperations(entry.patches),
        inversePatches: clonePatchOperations(entry.inversePatches),
        validation,
        meta
      });
      return {
        presentation: clone(presentation),
        patches: clonePatchOperations(entry.patches),
        inversePatches: clonePatchOperations(entry.inversePatches),
        validation
      };
    }
  };

  return editor;
}

export function createSvgTraceBinding(root, editor, options = {}) {
  assertElementRoot(root);
  assertEditorSession(editor);

  const selector = options.selector ?? `[${DATA_OPF_PATH}]`;
  const elements = traceElements(root, selector);
  const listeners = [];

  function select(element, sourceEvent) {
    const path = opfPathForElement(element);
    const detail = {
      path,
      pointer: opfPathToJsonPointer(path),
      value: editor.get(path),
      element,
      editor,
      sourceEvent
    };

    options.onSelect?.(detail);
    dispatchOpfEvent(element, SELECT_EVENT, detail);
    return detail;
  }

  function commit(elementOrPath, value, meta = {}) {
    const path = typeof elementOrPath === "string" ? elementOrPath : opfPathForElement(elementOrPath);
    return editor.set(path, value, {
      ...meta,
      source: meta.source ?? "svg-trace"
    });
  }

  for (const element of elements) {
    element.setAttribute?.("data-opf-bound", "true");
    if (options.interactive !== false) {
      ensureInteractiveTraceElement(element);

      const onClick = (event) => { event.stopPropagation?.(); select(element, event); };
      const onKeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault?.();
          event.stopPropagation?.();
          select(element, event);
        }
      };

      element.addEventListener?.("click", onClick);
      element.addEventListener?.("keydown", onKeydown);
      listeners.push([element, "click", onClick], [element, "keydown", onKeydown]);
    }
  }

  return {
    elements,
    getPath: opfPathForElement,
    getValue(elementOrPath, fallback) {
      return editor.get(typeof elementOrPath === "string" ? elementOrPath : opfPathForElement(elementOrPath), fallback);
    },
    select,
    commit,
    destroy() {
      for (const [element, type, listener] of listeners) {
        element.removeEventListener?.(type, listener);
      }
      listeners.length = 0;
      for (const element of elements) element.removeAttribute?.("data-opf-bound");
    }
  };
}

/**
 * The records a catalog control can offer for `catalogKind`, from core's `catalogRecords`: the document's embedded records,
 * then the registered catalogs' (`options.catalogs`, merged with `options.editor`'s). Each is the record itself.
 */
export function getCatalogRecords(catalogKind, options = {}) {
  return getCatalogOptions(catalogKind, options).map((option) => option.record);
}

/**
 * Picker options for `catalogKind`: `{ id, reference, label, record, group, source, origin }`, where `id` (= `reference`) is the
 * reference to write, `id` or `name:id`. `options.presentation` is the document (default: `options.editor`'s), `options.catalogs`
 * the host catalogs (merged after the session's registered ones).
 */
export function getCatalogOptions(catalogKind, options = {}) {
  assertCatalogKind(catalogKind);
  const presentation = options.presentation ?? options.editor?.presentation ?? {};
  return listCatalogRecords(presentation, catalogKind, { catalogs: mergeCatalogs(options.editor?.catalogs, options.catalogs) });
}

export function assertCatalogId(catalogKind, id, options = {}) {
  assertCatalogKind(catalogKind);
  if (typeof id !== "string" || id.length === 0) {
    throw new OPFEditorError("invalid-catalog-id", "Catalog control values must be non-empty catalog references.", {
      catalogKind,
      id
    });
  }

  const optionsById = new Set(getCatalogOptions(catalogKind, options).map((option) => option.id));
  if (!optionsById.has(id)) {
    throw new OPFEditorError("unknown-catalog-id", `Unknown ${catalogKind} catalog reference: ${id}.`, {
      catalogKind,
      id
    });
  }

  return id;
}

/** Write the catalog reference `id` at `path` (an object reference keeps its overrides and takes the new `id`). */
export function setCatalogId(editor, path, catalogKind, id, meta = {}) {
  assertEditorSession(editor);
  const catalogId = assertCatalogId(catalogKind, id, {
    presentation: meta.presentation ?? editor.presentation,
    catalogs: mergeCatalogs(editor.catalogs, meta.catalogs)
  });
  const current = editor.get(path);
  const value = catalogReferenceValue(current, catalogId);
  const { catalogs: _catalogs, presentation: _presentation, ...commitMeta } = meta;
  // Only documented design references may initialize their optional design parent.
  // Ordinary set/applyPatch retain RFC 6902's existing-parent requirement.
  const segments = splitOpfPath(path);
  const designField = { themes: "theme", colorSchemes: "colorScheme", fontSchemes: "fontScheme" }[catalogKind];
  const deckDesign = segments.length === 2 && segments[0] === "design";
  const slideDesign = segments.length === 4 && segments[0] === "slides" && /^(0|[1-9][0-9]*)$/.test(segments[1]) && segments[2] === "design" && editor.get(segments.slice(0, 2));
  const parent = segments.slice(0, -1);
  const patches = designField === segments.at(-1) && (deckDesign || slideDesign) && !hasValueAtPath(editor.presentation, parent)
    ? [{ op: "add", path: opfPathToJsonPointer(parent), value: { [designField]: value } }]
    : createValuePatch(editor.presentation, path, value);
  return editor.applyPatch(patches, {
    ...commitMeta,
    rejectInvalid: true,
    catalogKind,
    catalogId,
    source: commitMeta.source ?? "catalog-control"
  });
}

export function createTextInput(editor, options) {
  assertEditorSession(editor);
  const documentRef = resolveDomDocument(options?.document);
  const input = documentRef.createElement(options?.multiline ? "textarea" : "input");
  const path = options?.path;
  if (!path) throw new OPFEditorError("missing-path", "Text input requires an OPF path.");

  input.setAttribute(COMPONENT_ATTR, "text-input");
  input.setAttribute(DATA_OPF_PATH, path);
  if (!options?.multiline) input.setAttribute("type", options?.type ?? "text");
  if (options?.label) input.setAttribute("aria-label", options.label);

  const updateValue = () => {
    const nextValue = editor.get(path, "");
    input.value = nextValue === undefined || nextValue === null ? "" : String(nextValue);
  };
  const onInput = () => {
    editor.set(path, input.value, { source: "text-input" });
  };
  const unsubscribe = editor.subscribe(updateValue);

  input.addEventListener?.("input", onInput);
  input.destroy = () => {
    input.removeEventListener?.("input", onInput);
    unsubscribe();
  };
  updateValue();
  return input;
}

export function createCatalogSelect(editor, options) {
  assertEditorSession(editor);
  const documentRef = resolveDomDocument(options?.document);
  const select = documentRef.createElement("select");
  const path = options?.path;
  const catalogKind = options?.catalogKind;
  if (!path) throw new OPFEditorError("missing-path", "Catalog select requires an OPF path.");
  assertCatalogKind(catalogKind);

  select.setAttribute(COMPONENT_ATTR, "catalog-select");
  select.setAttribute(DATA_OPF_PATH, path);
  select.setAttribute("data-opf-catalog-kind", catalogKind);
  if (options?.label) select.setAttribute("aria-label", options.label);

  for (const option of getCatalogOptions(catalogKind, {
    catalogs: mergeCatalogs(editor.catalogs, options?.catalogs),
    presentation: options?.presentation ?? editor.presentation
  })) {
    const optionElement = documentRef.createElement("option");
    optionElement.value = option.id;
    optionElement.textContent = option.label;
    select.appendChild(optionElement);
  }

  const updateValue = () => {
    const current = editor.get(path);
    select.value = typeof current === "object" && current ? current.id : current ?? "";
  };
  const onChange = () => commitCatalogControl(select, options?.onError, updateValue, () => {
    return setCatalogId(editor, path, catalogKind, select.value, {
      catalogs: options?.catalogs,
      presentation: options?.presentation,
      source: "catalog-select"
    });
  });
  const unsubscribe = editor.subscribe(updateValue);

  select.addEventListener?.("change", onChange);
  select.destroy = () => {
    select.removeEventListener?.("change", onChange);
    unsubscribe();
  };
  updateValue();
  return select;
}

function parseInput(input) {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch (error) {
      throw new OPFEditorError("invalid-json", "OPF input is not valid JSON.", {
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (input instanceof Uint8Array) {
    return parseInput(new TextDecoder().decode(input));
  }

  if (input && typeof input === "object") return clone(input);

  throw new OPFEditorError("invalid-input", "OPF input must be a parsed object, JSON string, or Uint8Array.");
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

/** JSON with object keys sorted, so two documents compare equal whatever order their keys were written in. */
function canonicalJson(value) {
  return JSON.stringify(value, (key, item) => (item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((name) => [name, item[name]])) : item));
}

function clonePatchOperations(operations) {
  return operations.map((operation) => clone(operation));
}

function parseJsonPointer(pointer) {
  try {
    return parsePointer(pointer);
  } catch (error) {
    throw editorPatchError(error);
  }
}

function normalizePatchPath(path) {
  return typeof path === "string" && path.startsWith("/") ? path : opfPathToJsonPointer(path);
}

const PATCH_OPERATIONS = ["add", "replace", "remove", "move", "copy", "test"];

function normalizeOperation(operation) {
  if (!operation || typeof operation !== "object") {
    throw new OPFEditorError("invalid-patch-operation", "JSON Patch operation must be an object.", { operation });
  }
  if (!PATCH_OPERATIONS.includes(operation.op)) {
    throw new OPFEditorError("unsupported-patch-operation", `Unsupported JSON Patch operation: ${operation.op}.`, {
      operation
    });
  }
  if (operation.op === "test" && !Object.prototype.hasOwnProperty.call(operation, "value"))
    throw new OPFEditorError("invalid-patch-operation", "A test operation requires a value.");
  const normalized = { op: operation.op };
  if (operation.op === "move" || operation.op === "copy") {
    if (operation.from === undefined) throw new OPFEditorError("invalid-patch-operation", `A ${operation.op} operation requires from.`, { operation });
    normalized.from = normalizePatchPath(operation.from);
  }
  normalized.path = normalizePatchPath(operation.path);
  if (operation.op === "add" || operation.op === "replace" || operation.op === "test") normalized.value = clone(operation.value);
  return normalized;
}

// Core patch errors keep their stable codes; the editor reports them as OPFEditorError.
function editorPatchError(error) {
  if (!(error instanceof OPFPatchError)) return error;
  const details = {};
  if (error.path !== undefined) details.path = error.path;
  if (error.operation !== undefined) details.operation = error.operation;
  if (error.index !== undefined) details.index = error.index;
  if (error.validation) details.issues = errorFindings(error.validation);
  return new OPFEditorError(error.code, error.message, details);
}

function assertPatchOperations(operations) {
  if (!Array.isArray(operations)) {
    throw new OPFEditorError("invalid-patch", "JSON Patch must be an array of operations.", { operations });
  }
}

function assertElementRoot(root) {
  if (!root || typeof root !== "object" || typeof root.querySelectorAll !== "function") {
    throw new OPFEditorError("invalid-root", "SVG trace binding requires a root element with querySelectorAll.");
  }
}

function assertEditorSession(editor) {
  if (!editor || typeof editor.get !== "function" || typeof editor.set !== "function" || typeof editor.subscribe !== "function") {
    throw new OPFEditorError("invalid-editor", "Expected an editor session created by createEditorSession.");
  }
}

function traceElements(root, selector) {
  const elements = Array.from(root.querySelectorAll(selector));
  if (typeof root.matches === "function" && root.matches(selector)) elements.unshift(root);
  return elements;
}

function opfPathForElement(element) {
  const path = element?.getAttribute?.(DATA_OPF_PATH);
  if (!path) throw new OPFEditorError("missing-opf-path", "Element does not have a data-opf-path attribute.");
  return path;
}

function ensureInteractiveTraceElement(element) {
  if (!element.hasAttribute?.("tabindex")) element.setAttribute?.("tabindex", "0");
  if (!element.hasAttribute?.("role")) element.setAttribute?.("role", "button");
}

function dispatchOpfEvent(element, type, detail) {
  if (typeof element.dispatchEvent !== "function" || typeof globalThis.CustomEvent !== "function") return;
  element.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
}

function assertCatalogKind(catalogKind) {
  if (!catalogKinds.includes(catalogKind)) {
    throw new OPFEditorError("unknown-catalog-kind", `Unknown OPF catalog kind: ${catalogKind}.`, {
      catalogKind
    });
  }
}

function catalogReferenceValue(current, id) {
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return { ...current, id };
  }
  return id;
}

function resolveDomDocument(documentRef) {
  const resolved = documentRef ?? globalThis.document;
  if (!resolved || typeof resolved.createElement !== "function") {
    throw new OPFEditorError("missing-document", "DOM components require a document-like object.");
  }
  return resolved;
}

function freezeSnapshot(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeSnapshot);
    Object.freeze(value);
  }
  return value;
}
