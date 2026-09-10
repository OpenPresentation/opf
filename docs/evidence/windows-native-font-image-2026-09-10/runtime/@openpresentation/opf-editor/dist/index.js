import { paginateSlide } from "@openpresentation/opf/pagination";
import { composeSlide, resolveCanvasDimensions, resolveFontFamilies } from "@openpresentation/opf/composition";
import {
  catalogKinds,
  catalogs as bundledCatalogs,
  validatePresentation
} from "@openpresentation/opf";

function resolveCompositionOptions(document, slideIndex, options = {}) {
      const slide = document.slides?.[slideIndex];
      if (!Number.isInteger(slideIndex) || !slide) throw new OPFEditorError("slide-index-out-of-range", "Slide index is out of range.");
      const inline = document.catalogs?.layouts?.records ?? [];
      const layout = options.layout ?? inline.find(record => record.id === slide.layout)
        ?? bundledCatalogs.layouts.find(record => record.id === slide.layout);
      const themeReference = slide.design?.theme ?? document.design?.theme ?? "minimal";
      const themeId = typeof themeReference === "string" ? themeReference : themeReference.id;
      const theme = document.catalogs?.themes?.records?.find(record => record.id === themeId)
        ?? bundledCatalogs.themes.find(record => record.id === themeId);
      const reference = slide.design?.fontScheme ?? document.design?.fontScheme ?? theme?.fontScheme ?? "roboto";
      const id = typeof reference === "string" ? reference : reference.id;
      const fontScheme = {...(document.catalogs?.fontSchemes?.records?.find(record=>record.id===id) ?? bundledCatalogs.fontSchemes.find(record=>record.id===id)),...(typeof reference === "object" ? reference : {})};
      return { ...resolveCanvasDimensions(slide.design?.dimensions ?? document.design?.dimensions ?? theme?.dimensions), fonts:resolveFontFamilies(fontScheme), contentAlignment:slide.design?.contentAlignment??document.design?.contentAlignment, titleAlignment:slide.design?.titleAlignment??document.design?.titleAlignment, contentBox:slide.design?.contentBox??document.design?.contentBox, ...options, layout, slideIndex };
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
const MISSING = Symbol("opf-editor.missing");

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
  const segments = splitOpfPath(path);
  if (!segments.length) return "";
  return `/${segments.map(escapePointerSegment).join("/")}`;
}

export function jsonPointerToOpfPath(pointer) {
  return parseJsonPointer(pointer).join(".");
}

export function getValueAtPath(document, path, fallback) {
  const value = readAtPath(document, splitOpfPath(path));
  return value === MISSING ? fallback : value;
}

export function hasValueAtPath(document, path) {
  return readAtPath(document, splitOpfPath(path)) !== MISSING;
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

export function applyJsonPatch(document, operations) {
  assertPatchOperations(operations);
  let next = clone(document);
  for (const operation of operations) {
    next = applyJsonPatchOperation(next, normalizeOperation(operation));
  }
  return next;
}

export function invertJsonPatch(document, operations) {
  assertPatchOperations(operations);
  let current = clone(document);
  const inverse = [];

  for (const operation of operations.map(normalizeOperation)) {
    const previous = readAtPath(current, parseJsonPointer(operation.path));
    if (operation.op !== "add" && previous === MISSING) {
      throw new OPFEditorError("patch-path-missing", `Cannot invert ${operation.op} for missing path ${operation.path}.`, {
        path: operation.path,
        operation
      });
    }
    const addReplacedObjectValue = operation.op === "add" && previous !== MISSING && !pathParentIsArray(current, operation.path);
    const inversePath = operation.op === "add" ? insertedPathForAdd(operation.path, previous, current) : operation.path;

    current = applyJsonPatchOperation(current, operation);

    if (addReplacedObjectValue) {
      inverse.unshift({ op: "replace", path: operation.path, value: clone(previous) });
    } else if (operation.op === "add") {
      inverse.unshift({ op: "remove", path: inversePath });
    } else if (operation.op === "replace") {
      inverse.unshift({ op: "replace", path: operation.path, value: clone(previous) });
    } else if (operation.op === "remove") {
      inverse.unshift({ op: "add", path: operation.path, value: clone(previous) });
    }
  }

  return inverse;
}

export function validateOpfDocument(document, validator = validatePresentation) {
  const result = validator(document);
  const valid = Boolean(result?.valid);
  return {
    valid,
    errors: Array.isArray(result?.errors) ? result.errors : [],
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
    const inversePatches = invertJsonPatch(before, patches);
    const next = applyJsonPatch(before, patches);
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
      const pagination = paginateSlide(document.slides[slideIndex], { ...resolved, reservedIds: document.slides.map(slide => slide.id).filter(Boolean) });
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

function clonePatchOperations(operations) {
  return operations.map((operation) => clone(operation));
}

function escapePointerSegment(segment) {
  return String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
}

function unescapePointerSegment(segment) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function parseJsonPointer(pointer) {
  if (pointer === "") return [];
  if (typeof pointer !== "string" || !pointer.startsWith("/")) {
    throw new OPFEditorError("invalid-json-pointer", "JSON Patch paths must be JSON Pointers.", { path: pointer });
  }
  return pointer.slice(1).split("/").map(unescapePointerSegment);
}

function normalizePatchPath(path) {
  return typeof path === "string" && path.startsWith("/") ? path : opfPathToJsonPointer(path);
}

function normalizeOperation(operation) {
  if (!operation || typeof operation !== "object") {
    throw new OPFEditorError("invalid-patch-operation", "JSON Patch operation must be an object.", { operation });
  }
  if (!["add", "replace", "remove", "test"].includes(operation.op)) {
    throw new OPFEditorError("unsupported-patch-operation", `Unsupported JSON Patch operation: ${operation.op}.`, {
      operation
    });
  }
  if (operation.op === "test" && !Object.prototype.hasOwnProperty.call(operation, "value"))
    throw new OPFEditorError("invalid-patch-operation", "A test operation requires a value.");
  const normalized = {
    op: operation.op,
    path: normalizePatchPath(operation.path)
  };
  if (operation.op !== "remove") normalized.value = clone(operation.value);
  return normalized;
}

function assertPatchOperations(operations) {
  if (!Array.isArray(operations)) {
    throw new OPFEditorError("invalid-patch", "JSON Patch must be an array of operations.", { operations });
  }
}

function readAtPath(document, segments) {
  let current = document;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (segment === "-") return MISSING;
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return MISSING;
      current = current[index];
    } else if (current && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else {
      return MISSING;
    }
  }
  return current;
}

function jsonEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && jsonEqual(a[key], b[key]));
}
function applyJsonPatchOperation(document, operation) {
  const segments = parseJsonPointer(operation.path);
  if (operation.op === "test") {
    const current = readAtPath(document, segments);
    if (current === MISSING || !jsonEqual(current, operation.value))
      throw new OPFEditorError("patch-test-failed", `The value changed at ${operation.path || "/"}.`, {path: operation.path});
    return clone(document);
  }
  if (segments.length === 0) {
    if (operation.op === "remove") return undefined;
    return clone(operation.value);
  }

  const next = clone(document);
  const parent = readAtPath(next, segments.slice(0, -1));
  const key = segments.at(-1);

  if (parent === MISSING || parent === null || typeof parent !== "object") {
    throw new OPFEditorError("patch-parent-missing", `Patch parent does not exist for ${operation.path}.`, {
      path: operation.path,
      operation
    });
  }

  if (Array.isArray(parent)) applyArrayOperation(parent, key, operation);
  else applyObjectOperation(parent, key, operation);

  return next;
}

function insertedPathForAdd(path, previous, document) {
  if (previous !== MISSING || !path.endsWith("/-")) return path;
  const parentPath = path.slice(0, -2);
  const parent = readAtPath(document, parseJsonPointer(parentPath));
  if (!Array.isArray(parent)) return path;
  return `${parentPath}/${parent.length}`;
}

function pathParentIsArray(document, path) {
  const segments = parseJsonPointer(path);
  if (segments.length === 0) return false;
  const parent = readAtPath(document, segments.slice(0, -1));
  return Array.isArray(parent);
}

function applyArrayOperation(parent, key, operation) {
  if (!/^(0|[1-9][0-9]*)$/.test(key) && !(key === "-" && operation.op === "add")) {
    throw new OPFEditorError("invalid-array-index", `Invalid array index in patch path ${operation.path}.`, { path: operation.path });
  }
  const index = key === "-" ? parent.length : Number(key);
  if (!Number.isInteger(index) || index < 0 || index > parent.length) {
    throw new OPFEditorError("invalid-array-index", `Invalid array index in patch path ${operation.path}.`, {
      path: operation.path,
      operation
    });
  }

  if (operation.op === "add") {
    parent.splice(index, 0, clone(operation.value));
    return;
  }

  if (index >= parent.length) {
    throw new OPFEditorError("patch-path-missing", `Patch path does not exist: ${operation.path}.`, {
      path: operation.path,
      operation
    });
  }

  if (operation.op === "replace") parent[index] = clone(operation.value);
  else parent.splice(index, 1);
}

function applyObjectOperation(parent, key, operation) {
  if (operation.op === "add") {
    Object.defineProperty(parent, key, { value: clone(operation.value), writable: true, enumerable: true, configurable: true });
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(parent, key)) {
    throw new OPFEditorError("patch-path-missing", `Patch path does not exist: ${operation.path}.`, {
      path: operation.path,
      operation
    });
  }

  if (operation.op === "replace") parent[key] = clone(operation.value);
  else delete parent[key];
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
