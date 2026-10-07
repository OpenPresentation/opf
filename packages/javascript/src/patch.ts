// One RFC 6902 JSON Patch implementation for OPF: used by the CLI (`opf edit`,
// `opf diff`, `opf merge`) and the editor (undo/redo). Deterministic and
// dependency-free apart from the optional schema validation of the result.
//
// - Operations: add, remove, replace, move, copy, test (RFC 6902, section 4).
// - Pointers: strict RFC 6901 (`~0`, `~1`, `-` only where RFC 6902 allows it).
// - Safety: operates on a clone, defines own data properties (a `__proto__`
//   key is data), and only ever reads own properties.
// - Inverse patches: `applyPatchWithInverse` returns the patch that restores
//   the input exactly, for undo stacks.
import type { Finding, FindingReport, JsonPatchOperation } from "./generated/types/finding.js";
import { validate } from "./validator.js";

export type { JsonPatchOperation };

export type JsonPointer = string;

export type PatchErrorCode =
  | "invalid-patch"
  | "invalid-patch-operation"
  | "unsupported-patch-operation"
  | "invalid-json-pointer"
  | "patch-path-missing"
  | "patch-parent-missing"
  | "invalid-array-index"
  | "patch-test-failed"
  | "patch-invalid-move"
  | "patch-root-remove"
  | "patch-invalid-document";

export class OPFPatchError extends Error {
  readonly code: PatchErrorCode;
  /** The JSON Pointer the failing operation addressed, when known. */
  path?: string;
  /** The index of the failing operation within the patch, when known. */
  index?: number;
  /** The failing operation, when known. */
  operation?: unknown;
  constructor(code: PatchErrorCode, message: string, details: { path?: string; index?: number; operation?: unknown } = {}) {
    super(message);
    this.name = "OPFPatchError";
    this.code = code;
    if (details.path !== undefined) this.path = details.path;
    if (details.index !== undefined) this.index = details.index;
    if (details.operation !== undefined) this.operation = details.operation;
  }
}

/** Thrown when `validate` is requested and the patched document is not a valid OPF presentation. */
export class OPFPatchValidationError extends OPFPatchError {
  readonly validation: PatchValidationResult;
  constructor(validation: PatchValidationResult) {
    super("patch-invalid-document", "The patched document is not a valid OPF presentation.");
    this.name = "OPFPatchValidationError";
    this.validation = validation;
  }
}

/** What a validator hook returns: a `validate` report, or anything with `valid` (and `findings` for `strict` to read). */
export interface PatchValidationResult extends Pick<FindingReport, "valid"> {
  findings?: Finding[];
}

export interface ApplyPatchOptions {
  /**
   * Validate the whole patched document against the OPF schema (`true`) or a
   * custom validator. An invalid result throws `OPFPatchValidationError`; the
   * input is never changed. Intermediate states are not validated.
   */
  validate?: boolean | ((document: unknown) => PatchValidationResult);
  /** With `validate`, also reject warnings. */
  strict?: boolean;
}

export interface PatchResult {
  /** The patched presentation (a clone; the input is never changed). */
  presentation: unknown;
  /** The patch that restores the input from `presentation`. Applying it to `presentation` yields the input. */
  inverse: JsonPatchOperation[];
  /** The normalised operations that were applied (values cloned, unknown members dropped). */
  patch: JsonPatchOperation[];
  validation?: PatchValidationResult;
}

const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const clone = <T>(value: T): T => structuredClone(value);

/** JSON equality: member order is irrelevant, `-0` equals `0`, arrays compare in order. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    return a.length === other.length && a.every((item, i) => jsonEqual(item, other[i]));
  }
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => own(right, key) && jsonEqual(left[key], right[key]));
}

// ---------------------------------------------------------------------------
// JSON Pointer (RFC 6901) helpers: one place for escaping and splitting.

export function escapePointerToken(token: string | number): string {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1");
}
export function unescapePointerToken(token: string): string {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

/** Split a JSON Pointer into unescaped tokens. Throws `invalid-json-pointer`. */
export function parsePointer(pointer: unknown): string[] {
  if (typeof pointer !== "string" || (pointer !== "" && !pointer.startsWith("/")) || /~(?![01])/u.test(pointer)) {
    throw new OPFPatchError("invalid-json-pointer", "Expected a JSON Pointer (empty string or /path with ~0 and ~1 escapes).", { path: typeof pointer === "string" ? pointer : undefined });
  }
  return pointer === "" ? [] : pointer.slice(1).split("/").map(unescapePointerToken);
}

/** Join tokens into a JSON Pointer, escaping `~` and `/`. */
export function formatPointer(tokens: readonly (string | number)[]): JsonPointer {
  return tokens.length ? `/${tokens.map(escapePointerToken).join("/")}` : "";
}

/**
 * Stable path normalisation. Accepts a JSON Pointer (`/slides/0/title`), an
 * OPF dotted path (`slides.0.title`) or a segment array, and returns a JSON
 * Pointer. Use pointers or segment arrays for keys that contain dots.
 */
export function pointerFromPath(path: string | readonly (string | number)[]): JsonPointer {
  if (Array.isArray(path)) return formatPointer(path);
  if (typeof path !== "string") throw new OPFPatchError("invalid-json-pointer", "A path must be a string or an array of segments.");
  if (path === "") return "";
  if (path.startsWith("/")) { parsePointer(path); return path; }
  return formatPointer(path.split(".").filter(Boolean));
}

/** Parent pointer and final token of a non-root pointer. */
export function splitPointer(pointer: JsonPointer): { parent: JsonPointer; token: string } {
  const tokens = parsePointer(pointer);
  if (!tokens.length) throw new OPFPatchError("invalid-json-pointer", "The root pointer has no parent.", { path: pointer });
  return { parent: formatPointer(tokens.slice(0, -1)), token: tokens[tokens.length - 1]! };
}

/** Read a value without throwing: `found` is false for a missing path (including `-` and bad indices). */
export function readPointer(document: unknown, pointer: JsonPointer | readonly string[]): { found: true; value: unknown } | { found: false } {
  const tokens = typeof pointer === "string" ? parsePointer(pointer) : pointer;
  let value = document;
  for (const token of tokens) {
    if (Array.isArray(value)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token)) return { found: false };
      const at = Number(token);
      if (!Number.isSafeInteger(at) || at >= value.length) return { found: false };
      value = value[at];
    } else if (value && typeof value === "object" && own(value, token)) value = (value as Record<string, unknown>)[token];
    else return { found: false };
  }
  return { found: true, value };
}

/** Read a value or throw `patch-path-missing`. */
export function getAtPointer(document: unknown, pointer: JsonPointer | readonly string[]): unknown {
  const result = readPointer(document, pointer);
  if (!result.found) {
    const shown = typeof pointer === "string" ? pointer : formatPointer(pointer);
    throw new OPFPatchError("patch-path-missing", `Patch path does not exist: ${shown || "/"}`, { path: shown });
  }
  return result.value;
}

export const hasPointer = (document: unknown, pointer: JsonPointer | readonly string[]): boolean => readPointer(document, pointer).found;

// ---------------------------------------------------------------------------
// Operations

function arrayIndex(token: string, length: number, allowEnd: boolean, path: string): number {
  if (allowEnd && token === "-") return length;
  if (!/^(0|[1-9][0-9]*)$/.test(token)) throw new OPFPatchError("invalid-array-index", `Invalid array index: ${token}`, { path });
  const at = Number(token);
  if (!Number.isSafeInteger(at) || at > length || (!allowEnd && at >= length)) throw new OPFPatchError("invalid-array-index", `Array index out of bounds: ${token}`, { path });
  return at;
}

/** Normalise and structurally validate a patch (shape only; no document needed). Values are cloned. */
export function normalizePatch(patch: unknown): JsonPatchOperation[] {
  if (!Array.isArray(patch)) throw new OPFPatchError("invalid-patch", "A JSON Patch must be an array of operations.");
  return patch.map((operation, index) => normalizeOperation(operation, index));
}

function normalizeOperation(operation: unknown, index?: number): JsonPatchOperation {
  const fail = (code: PatchErrorCode, message: string, path?: string) => new OPFPatchError(code, index === undefined ? message : `Operation ${index}: ${message}`, { index, operation, path });
  if (!isObject(operation)) throw fail("invalid-patch-operation", "Expected an operation object.");
  const op = operation.op;
  if (typeof op !== "string" || !["add", "remove", "replace", "move", "copy", "test"].includes(op)) {
    throw fail("unsupported-patch-operation", `Unknown operation: ${String(op)}`);
  }
  if (typeof operation.path !== "string") throw fail("invalid-patch-operation", "An operation needs a string path.");
  try { parsePointer(operation.path); } catch (error) { throw fail("invalid-json-pointer", (error as Error).message, operation.path); }
  if (op === "move" || op === "copy") {
    if (typeof operation.from !== "string") throw fail("invalid-patch-operation", `${op} requires a string from.`, operation.path);
    try { parsePointer(operation.from); } catch (error) { throw fail("invalid-json-pointer", (error as Error).message, operation.from); }
    return { op, from: operation.from, path: operation.path };
  }
  if (op === "remove") return { op, path: operation.path };
  if (!own(operation, "value")) throw fail("invalid-patch-operation", `${op} requires value.`, operation.path);
  return { op: op as "add" | "replace" | "test", path: operation.path, value: clone(operation.value) };
}

function parentOf(document: unknown, tokens: string[], path: string): { parent: unknown; key: string } {
  const key = tokens[tokens.length - 1]!;
  const found = readPointer(document, tokens.slice(0, -1));
  if (!found.found || !found.value || typeof found.value !== "object") {
    throw new OPFPatchError("patch-parent-missing", `Patch parent does not exist for ${path}.`, { path });
  }
  return { parent: found.value, key };
}

// Mutating primitives on the working clone. They return the previous value (or a marker)
// so callers can build inverses. `document` is the working root; a root change returns the new root.
const NONE = Symbol("none");

function addAt(document: unknown, path: string, value: unknown): { document: unknown; inverse: JsonPatchOperation } {
  const tokens = parsePointer(path);
  if (!tokens.length) return { document: clone(value), inverse: { op: "replace", path: "", value: clone(document) } };
  const { parent, key } = parentOf(document, tokens, path);
  if (Array.isArray(parent)) {
    const at = arrayIndex(key, parent.length, true, path);
    parent.splice(at, 0, clone(value));
    return { document, inverse: { op: "remove", path: formatPointer([...tokens.slice(0, -1), at]) } };
  }
  const record = parent as Record<string, unknown>;
  const previous = own(record, key) ? record[key] : NONE;
  // Define own data properties, including __proto__, without invoking prototype setters.
  Object.defineProperty(record, key, { value: clone(value), enumerable: true, configurable: true, writable: true });
  return { document, inverse: previous === NONE ? { op: "remove", path } : { op: "replace", path, value: clone(previous) } };
}

function replaceAt(document: unknown, path: string, value: unknown): { document: unknown; inverse: JsonPatchOperation } {
  const tokens = parsePointer(path);
  if (!tokens.length) return { document: clone(value), inverse: { op: "replace", path: "", value: clone(document) } };
  const { parent, key } = parentOf(document, tokens, path);
  let previous: unknown;
  if (Array.isArray(parent)) {
    const at = arrayIndex(key, parent.length, false, path);
    previous = parent[at];
    parent[at] = clone(value);
  } else {
    const record = parent as Record<string, unknown>;
    if (!own(record, key)) throw new OPFPatchError("patch-path-missing", `Patch path does not exist: ${path}.`, { path });
    previous = record[key];
    Object.defineProperty(record, key, { value: clone(value), enumerable: true, configurable: true, writable: true });
  }
  return { document, inverse: { op: "replace", path, value: clone(previous) } };
}

function removeAt(document: unknown, path: string): { document: unknown; inverse: JsonPatchOperation } {
  const tokens = parsePointer(path);
  if (!tokens.length) throw new OPFPatchError("patch-root-remove", "The document root cannot be removed.", { path });
  const { parent, key } = parentOf(document, tokens, path);
  let previous: unknown;
  if (Array.isArray(parent)) {
    const at = arrayIndex(key, parent.length, false, path);
    previous = parent[at];
    parent.splice(at, 1);
    return { document, inverse: { op: "add", path: formatPointer([...tokens.slice(0, -1), at]), value: clone(previous) } };
  }
  const record = parent as Record<string, unknown>;
  if (!own(record, key)) throw new OPFPatchError("patch-path-missing", `Patch path does not exist: ${path}.`, { path });
  previous = record[key];
  delete record[key];
  return { document, inverse: { op: "add", path, value: clone(previous) } };
}

function applyOne(document: unknown, operation: JsonPatchOperation): { document: unknown; inverse: JsonPatchOperation[] } {
  switch (operation.op) {
    case "add": { const r = addAt(document, operation.path, operation.value); return { document: r.document, inverse: [r.inverse] }; }
    case "replace": { const r = replaceAt(document, operation.path, operation.value); return { document: r.document, inverse: [r.inverse] }; }
    case "remove": { const r = removeAt(document, operation.path); return { document: r.document, inverse: [r.inverse] }; }
    case "test": {
      const found = readPointer(document, operation.path);
      if (!found.found || !jsonEqual(found.value, operation.value)) throw new OPFPatchError("patch-test-failed", `Test failed at ${operation.path || "/"}: the value changed.`, { path: operation.path });
      return { document, inverse: [] };
    }
    case "copy": {
      const value = clone(getAtPointer(document, operation.from));
      const r = addAt(document, operation.path, value);
      return { document: r.document, inverse: [r.inverse] };
    }
    case "move": {
      const from = parsePointer(operation.from), to = parsePointer(operation.path);
      const value = clone(getAtPointer(document, from));
      if (from.length === to.length && from.every((token, i) => token === to[i])) return { document, inverse: [] };
      if (to.length > from.length && from.every((token, i) => to[i] === token)) {
        throw new OPFPatchError("patch-invalid-move", "Cannot move a value into its descendant.", { path: operation.path });
      }
      const removed = removeAt(document, operation.from);
      const added = addAt(removed.document, operation.path, value);
      // Undo runs in reverse: undo the add, then undo the remove.
      return { document: added.document, inverse: [added.inverse, removed.inverse] };
    }
  }
}

/**
 * Apply a patch to a clone of `document` and return the result with its
 * inverse. Atomic: any failing operation throws and nothing is returned.
 */
export function applyPatchWithInverse(document: unknown, patch: unknown, options: ApplyPatchOptions = {}): PatchResult {
  const operations = normalizePatch(patch);
  let working = clone(document);
  const inverse: JsonPatchOperation[] = [];
  for (const [index, operation] of operations.entries()) {
    try {
      const step = applyOne(working, operation);
      working = step.document;
      inverse.unshift(...step.inverse);
    } catch (error) {
      if (error instanceof OPFPatchError && error.index === undefined) {
        const wrapped = new OPFPatchError(error.code, `Operation ${index}: ${error.message}`, { path: error.path, index, operation });
        throw wrapped;
      }
      throw error;
    }
  }
  const result: PatchResult = { presentation: working, inverse, patch: operations };
  if (options.validate) {
    const validator = typeof options.validate === "function" ? options.validate : (value: unknown) => validate(value, { only: options.strict ? ["format", "references"] : ["format"] });
    const validation = validator(working);
    if (!validation.valid || (options.strict && validation.findings?.some((entry) => entry.severity === "warning"))) throw new OPFPatchValidationError(validation);
    result.validation = validation;
  }
  return result;
}

/** Apply an RFC 6902 patch to a clone of `document`; the input is never changed. */
export function applyPatch(document: unknown, patch: unknown, options: ApplyPatchOptions = {}): unknown {
  return applyPatchWithInverse(document, patch, options).presentation;
}

/** The patch that undoes `patch` when applied to the result of `applyPatch(document, patch)`. */
export function invertPatch(document: unknown, patch: unknown): JsonPatchOperation[] {
  return applyPatchWithInverse(document, patch).inverse;
}

