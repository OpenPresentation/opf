import { paginateSlide } from "@openpresentation/opf/pagination";
import { PatchError, applyPatch as applyCorePatch, applyPatchWithInverse, formatPointer, invertPatch, jsonEqual, parsePointer, readPointer } from "@openpresentation/opf/patch";
import { collectReservedPresentationIds } from "./presentation-ids.js";
import { DEFAULT_FONT_SCHEME, resolveFontSchemeReference } from "./font-defaults.js";
import { composeSlide, resolveCanvasDimensions, resolveFontFamilies } from "@openpresentation/opf/composition";
import {
  catalogKinds,
  catalogs as bundledCatalogs,
  validatePresentation
} from "@openpresentation/opf";

function resolveCompositionOptions(document, slideIndex, { onDiagnostic, ...options } = {}) {
      const slide = document.slides?.[slideIndex];
      if (!Number.isInteger(slideIndex) || !slide) throw new OPFEditorError("slide-index-out-of-range", "Slide index is out of range.");
      const inline = document.catalogs?.layouts?.records ?? [];
      const layout = options.layout ?? inline.find(record => record.id === slide.layout)
        ?? bundledCatalogs.layouts.find(record => record.id === slide.layout);
      const themeReference = slide.design?.theme ?? document.design?.theme ?? "minimal";
      const themeId = typeof themeReference === "string" ? themeReference : themeReference.id;
      const theme = document.catalogs?.themes?.records?.find(record => record.id === themeId)
        ?? bundledCatalogs.themes.find(record => record.id === themeId);
      const reference = slide.design?.fontScheme ?? document.design?.fontScheme ?? theme?.fontScheme ?? DEFAULT_FONT_SCHEME;
      const fontPath = slide.design?.fontScheme !== undefined ? `slides.${slideIndex}.design.fontScheme` : document.design?.fontScheme !== undefined ? "design.fontScheme" : slide.design?.theme !== undefined ? `slides.${slideIndex}.design.theme` : "design.theme";
      const { scheme: fontScheme, diagnostic } = resolveFontSchemeReference(reference, id => document.catalogs?.fontSchemes?.records?.find(record=>record.id===id) ?? bundledCatalogs.fontSchemes.find(record=>record.id===id), fontPath);
      if (diagnostic) onDiagnostic?.(diagnostic);
      return { ...resolveCanvasDimensions(slide.design?.dimensions ?? document.design?.dimensions ?? theme?.dimensions), fonts:resolveFontFamilies(fontScheme), contentAlignment:slide.design?.contentAlignment??document.design?.contentAlignment, titleAlignment:slide.design?.titleAlignment??document.design?.titleAlignment, contentBox:slide.design?.contentBox??document.design?.contentBox, presentation:document, ...options, layout, slideIndex };
}

/**
 * The font families a slide resolves to (`heading`, `body`, `code`), by the same slide, deck,
 * theme, default order that composition, pagination and export use. Hosts read this after a
 * font-scheme or theme switch to show the fonts the preview now uses.
 */
export function resolveSlideFonts(document, slideIndex = 0, options = {}) {
  return resolveCompositionOptions(document, slideIndex, options).fonts;
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

export function getValueAtPath(document, path, fallback) {
  const found = readPointer(document, splitOpfPath(path));
  return found.found ? found.value : fallback;
}

export function hasValueAtPath(document, path) {
  return readPointer(document, splitOpfPath(path)).found;
}

export function createValuePatch(document, path, value) {
  const pointer = normalizePatchPath(path);
  return [
    {
      op: hasValueAtPath(document, pointer) ? "replace" : "add",
      path: pointer,
      value: clone(value)
    }
  ];
}

// Patch semantics (RFC 6902, pointers, inverse patches) live in core's
// "@openpresentation/opf/patch"; the editor adds its path spellings (dotted OPF
// paths), its error type and its clone policy on top.
export function applyJsonPatch(document, operations) {
  assertPatchOperations(operations);
  const patch = operations.map(normalizeOperation);
  try {
    return applyCorePatch(document, patch);
  } catch (error) {
    throw editorPatchError(error);
  }
}

export function invertJsonPatch(document, operations) {
  assertPatchOperations(operations);
  const patch = operations.map(normalizeOperation);
  try {
    return invertPatch(document, patch);
  } catch (error) {
    throw editorPatchError(error);
  }
}

export function validateOpfDocument(document, validator = validatePresentation) {
  const result = validator(document);
  const valid = Boolean(result?.valid);
  return {
    valid,
    errors: Array.isArray(result?.errors) ? result.errors : [],
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
    result
  };
}

export function createEditorSession(input, options = {}) {
  let document = parseInput(input);
  let validation = validateOpfDocument(document, options.validate ?? validatePresentation);
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
    const patches = operations.map(normalizeOperation);
    const before = document;
    let next, inversePatches;
    try {
      ({ document: next, inverse: inversePatches } = applyPatchWithInverse(before, patches));
    } catch (error) {
      throw editorPatchError(error);
    }
    const nextValidation = validateOpfDocument(next, options.validate ?? validatePresentation);

    if ((meta.rejectInvalid ?? rejectInvalid) && !nextValidation.valid) {
      throw new OPFEditorError("invalid-opf-edit", "OPF edit produced an invalid document.", {
        issues: nextValidation.errors,
        patches
      });
    }

    if (patches.every(patch => patch.op === "test")) return {
      document: clone(document), patches: clonePatchOperations(patches), inversePatches: [], validation: nextValidation
    };
    document = next;
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
      document: clone(document),
      patches: clonePatchOperations(patches),
      inversePatches: clonePatchOperations(inversePatches),
      validation
    };
  }

  const editor = {
    get document() {
      return clone(document);
    },
    get validation() {
      return validation;
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    snapshot() {
      return snapshotCache ??= freezeSnapshot({
        document: clone(document),
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
      return getValueAtPath(document, path, fallback);
    },
    set(path, value, meta = {}) {
      return commitPatch(createValuePatch(document, path, value), {
        ...meta,
        path: normalizePatchPath(path)
      });
    },
    composeSlide(slideIndex, options = {}) {
      return composeSlide(document.slides?.[slideIndex], resolveCompositionOptions(document, slideIndex, options));
    },
    paginateSlide(slideIndex, options = {}, meta = {}) {
      const resolved = resolveCompositionOptions(document, slideIndex, options);
      const pagination = paginateSlide(document.slides[slideIndex], {
        ...resolved,
        reservedIds: collectReservedPresentationIds(document),
      });
      // Pagination can persist a readability policy without adding a page. Commit
      // that change too, so preview/export use the same minimum that was evaluated.
      if (pagination.slides.length === 1 && jsonEqual(pagination.slides[0], document.slides[slideIndex])) return { change: null, pagination };
      const slides = [...document.slides];
      slides.splice(slideIndex, 1, ...pagination.slides);
      const change = editor.set('slides', slides, { ...meta, rejectInvalid: true, pagination: pagination.pages });
      return { change, pagination };
    },
    setComposition(slideIndex, composition, meta = {}) {
      if (!Number.isInteger(slideIndex) || !document.slides?.[slideIndex]) throw new OPFEditorError("slide-index-out-of-range", "Slide index is out of range.");
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
     * Together with `document` this is everything `restoreState` needs to bring a session back, for hosts that persist work.
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
      if (!state || typeof state !== "object") throw new OPFEditorError("invalid-state", "restoreState needs { document, undo?, redo? }.");
      const next = parseInput(state.document);
      const nextValidation = validateOpfDocument(next, options.validate ?? validatePresentation);
      if ((meta.rejectInvalid ?? rejectInvalid) && !nextValidation.valid) {
        throw new OPFEditorError("invalid-opf-edit", "The restored document is not valid OPF.", { issues: nextValidation.errors });
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
      document = next;
      validation = nextValidation;
      undoStack.length = 0;
      redoStack.length = 0;
      undoStack.push(...undo.map(entry));
      redoStack.push(...redo.map(entry));
      emit({ type: "restore", patches: [], validation, meta });
      return { document: clone(document), patches: [], validation };
    },
    undo(meta = {}) {
      const entry = undoStack.pop();
      if (!entry) return null;
      document = applyJsonPatch(document, entry.inversePatches);
      validation = validateOpfDocument(document, options.validate ?? validatePresentation);
      redoStack.push(entry);
      emit({
        type: "undo",
        patches: clonePatchOperations(entry.inversePatches),
        redoPatches: clonePatchOperations(entry.patches),
        validation,
        meta
      });
      return {
        document: clone(document),
        patches: clonePatchOperations(entry.inversePatches),
        redoPatches: clonePatchOperations(entry.patches),
        validation
      };
    },
    redo(meta = {}) {
      const entry = redoStack.pop();
      if (!entry) return null;
      document = applyJsonPatch(document, entry.patches);
      validation = validateOpfDocument(document, options.validate ?? validatePresentation);
      undoStack.push(entry);
      emit({
        type: "redo",
        patches: clonePatchOperations(entry.patches),
        inversePatches: clonePatchOperations(entry.inversePatches),
        validation,
        meta
      });
      return {
        document: clone(document),
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

export function getCatalogRecords(catalogKind, options = {}) {
  assertCatalogKind(catalogKind);
  const presentationCatalog = options.presentation?.catalogs?.[catalogKind];
  const explicitCatalog = options.catalogs?.[catalogKind] ?? options.catalogSources?.[catalogKind];

  return firstRecords(presentationCatalog)
    ?? firstRecords(explicitCatalog)
    ?? firstRecords(bundledCatalogs[catalogKind])
    ?? [];
}

export function getCatalogOptions(catalogKind, options = {}) {
  return getCatalogRecords(catalogKind, options).map((record) => ({
    id: record.id,
    label: catalogLabel(record),
    record
  }));
}

export function assertCatalogId(catalogKind, id, options = {}) {
  assertCatalogKind(catalogKind);
  if (typeof id !== "string" || id.length === 0) {
    throw new OPFEditorError("invalid-catalog-id", "Catalog control values must be non-empty catalog IDs.", {
      catalogKind,
      id
    });
  }

  const optionsById = new Set(getCatalogOptions(catalogKind, options).map((option) => option.id));
  if (!optionsById.has(id)) {
    throw new OPFEditorError("unknown-catalog-id", `Unknown ${catalogKind} catalog ID: ${id}.`, {
      catalogKind,
      id
    });
  }

  return id;
}

export function setCatalogId(editor, path, catalogKind, id, meta = {}) {
  assertEditorSession(editor);
  const catalogId = assertCatalogId(catalogKind, id, {
    presentation: meta.presentation ?? editor.document,
    catalogs: meta.catalogs,
    catalogSources: meta.catalogSources
  });
  const current = editor.get(path);
  const value = catalogReferenceValue(current, catalogId);
  const { catalogs, catalogSources, presentation, ...commitMeta } = meta;
  return editor.set(path, value, {
    ...commitMeta,
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
    ...options,
    presentation: options?.presentation ?? editor.document
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
  const onChange = () => {
    setCatalogId(editor, path, catalogKind, select.value, {
      catalogs: options?.catalogs,
      catalogSources: options?.catalogSources,
      presentation: options?.presentation,
      source: "catalog-select"
    });
  };
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
  if (!(error instanceof PatchError)) return error;
  const details = {};
  if (error.path !== undefined) details.path = error.path;
  if (error.operation !== undefined) details.operation = error.operation;
  if (error.index !== undefined) details.index = error.index;
  if (error.validation) details.issues = error.validation.errors;
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

function firstRecords(value) {
  if (Array.isArray(value)) return value.filter(isCatalogRecord);
  if (Array.isArray(value?.records)) return value.records.filter(isCatalogRecord);
  return null;
}

function isCatalogRecord(record) {
  return Boolean(record && typeof record === "object" && typeof record.id === "string");
}

function catalogLabel(record) {
  return String(record.name ?? record.title ?? record.label ?? record.id);
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
