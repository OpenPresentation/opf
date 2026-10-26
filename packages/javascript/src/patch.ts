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
// - Id-addressed paths (CE-04): a pointer token `@intro` names the array element whose `id` is `intro`, so
//   `/slides/@intro/blocks/@kpi/text` keeps pointing at the same block when slides and blocks move. See `resolveIdPointer`.
// - Preconditions (CE-04): `expectHash` applies a patch only to the document it was made for.
import { documentHash, normalizeDocumentHash } from "./document-hash.js";
import type { Finding, FindingReport, JsonPatchOperation } from "./generated/types/finding.js";
import { validate } from "./validator.js";

export { documentHash };
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
  | "patch-invalid-document"
  | "patch-id-not-found"
  | "patch-id-ambiguous"
  | "invalid-expect-hash"
  | "patch-hash-mismatch";

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

/**
 * Thrown when `expectHash` is given and the document is not the one the patch was made for (`code` `patch-hash-mismatch`): it changed
 * since the hash was taken. Nothing was applied. Read the document again, rebase the edit, and retry with the new hash.
 */
export class OPFPatchHashError extends OPFPatchError {
  /** The hash the caller expected, in the form `documentHash` returns. */
  readonly expected: string;
  /** The hash of the document the patch was given. */
  readonly actual: string;
  constructor(expected: string, actual: string) {
    super("patch-hash-mismatch", "The document changed since it was read: its hash is not the expected hash. Nothing was applied.");
    this.name = "OPFPatchHashError";
    this.expected = expected;
    this.actual = actual;
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
  /**
   * Apply the patch only to the document it was made for: the `documentHash` of the input. A different document throws
   * `OPFPatchHashError` (`patch-hash-mismatch`) before anything is applied; a value that is not a hash throws `invalid-expect-hash`.
   * The bare 64-digit hex form is accepted. This is optimistic concurrency for a server that holds the document.
   */
  expectHash?: string;
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

// ---------------------------------------------------------------------------
// Id-addressed paths (CE-04). In an array, the token `@intro` is the element whose `id` is `intro`. A token is read this way only
// where the value is an array, so an object key that starts with `@` (an extension's `@context`) is still a plain key, and an array
// has no other use for a token that is not an index. `@` is a legal character of a JSON Pointer token and of a URI fragment, so the
// pointer stays valid for any RFC 6901 tool (parsers, `fast-json-patch`, `jsonpointer`, URL fragments), which would fail to read the
// element but not to carry the path; a literal `{id:intro}` would need percent-encoding in a fragment. An id that begins with `@`
// is written `@@id`; `~` and `/` in an id escape as in every pointer.

/** True for a token that names an array element by id (`@intro`). */
export const isIdToken = (token: string): boolean => token.length > 1 && token.startsWith("@");
/** The pointer token that names the array element with this id (`intro` gives `@intro`). Escape it with `escapePointerToken` or `formatPointer`. */
export const idToken = (id: string): string => `@${id}`;

const INDEX_TOKEN = /^(0|[1-9][0-9]*)$/;

/** The index of the only element of `array` whose `id` is `id`: -1 when none has it, -2 when several do. */
function indexOfId(array: readonly unknown[], id: string): number {
  let found = -1;
  for (let i = 0; i < array.length; i += 1) {
    const item = array[i];
    if (isObject(item) && own(item, "id") && item.id === id) {
      if (found !== -1) return -2;
      found = i;
    }
  }
  return found;
}

/** The `id` of `array[at]` when it names that element: a non-empty string no other element of the array has. */
function uniqueIdAt(array: readonly unknown[], at: number): string | undefined {
  const item = array[at];
  if (!isObject(item) || !own(item, "id") || typeof item.id !== "string" || item.id === "") return undefined;
  return indexOfId(array, item.id) === at ? item.id : undefined;
}

/**
 * Tokens with every id token replaced by the element's index in `document`. A token is read as an id only where the document has
 * an array; below a missing path the rest is left as written (the operation then fails as it always did). Throws `patch-id-not-found`
 * when no element of the array has the id and `patch-id-ambiguous` when several do (an invalid document).
 */
function resolveTokens(document: unknown, tokens: readonly string[], pointer: string): string[] {
  const out: string[] = [];
  let cursor = document, walking = true;
  for (const token of tokens) {
    let resolved = token;
    if (walking && Array.isArray(cursor) && isIdToken(token)) {
      const at = indexOfId(cursor, token.slice(1));
      if (at === -1) throw new OPFPatchError("patch-id-not-found", `No element of ${formatPointer(out) || "/"} has the id '${token.slice(1)}'.`, { path: pointer });
      if (at === -2) throw new OPFPatchError("patch-id-ambiguous", `More than one element of ${formatPointer(out) || "/"} has the id '${token.slice(1)}'.`, { path: pointer });
      resolved = String(at);
    }
    out.push(resolved);
    if (walking) {
      const next = readPointer(cursor, [resolved]);
      if (next.found) cursor = next.value; else walking = false;
    }
  }
  return out;
}

/**
 * The index form of a pointer: every id token (`/slides/@intro/title`) replaced by the index of the element in `document`
 * (`/slides/2/title`). A pointer without id tokens is returned as written; nothing else is checked, so a path that does not exist
 * is not an error. Throws `patch-id-not-found` for an id no element has and `patch-id-ambiguous` for an id several elements share.
 */
export function resolveIdPointer(document: unknown, pointer: JsonPointer): JsonPointer {
  const tokens = parsePointer(pointer);
  return tokens.some(isIdToken) ? formatPointer(resolveTokens(document, tokens, pointer)) : pointer;
}

/** Tokens with each array index replaced by the element's id token where the element has a unique `id` (the last token only when `convertLast`). */
function idTokens(document: unknown, tokens: readonly string[], convertLast: boolean): string[] {
  const out: string[] = [];
  let cursor = document, walking = true;
  tokens.forEach((token, i) => {
    let named = token;
    if (walking && Array.isArray(cursor) && INDEX_TOKEN.test(token) && (convertLast || i < tokens.length - 1)) {
      const id = uniqueIdAt(cursor, Number(token));
      if (id !== undefined) named = idToken(id);
    }
    out.push(named);
    if (walking) {
      const next = readPointer(cursor, [token]);
      if (next.found) cursor = next.value; else walking = false;
    }
  });
  return out;
}

/**
 * The id form of an index pointer: every array index whose element has a unique, non-empty string `id` becomes `@id`
 * (`/slides/2/blocks/0` gives `/slides/@intro/blocks/@kpi`); indexes of elements without an id stay. Id tokens in the pointer are kept.
 * Pass an index into an array as the last token of an insertion (`add`) with `{ keepLast: true }` to leave it as written.
 */
export function toIdPointer(document: unknown, pointer: JsonPointer, options: { keepLast?: boolean } = {}): JsonPointer {
  return formatPointer(idTokens(document, resolveTokens(document, parsePointer(pointer), pointer), !options.keepLast));
}

/** Read a value without throwing: `found` is false for a missing path (including `-` and bad indices). An id token (`@intro`) finds the array element with that id. */
export function readPointer(document: unknown, pointer: JsonPointer | readonly string[]): { found: true; value: unknown } | { found: false } {
  const tokens = typeof pointer === "string" ? parsePointer(pointer) : pointer;
  let value = document;
  for (const token of tokens) {
    if (Array.isArray(value)) {
      let at: number;
      if (isIdToken(token)) {
        at = indexOfId(value, token.slice(1));
        if (at < 0) return { found: false };
      } else {
        if (!INDEX_TOKEN.test(token)) return { found: false };
        at = Number(token);
      }
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
  if (!INDEX_TOKEN.test(token)) throw new OPFPatchError("invalid-array-index", `Invalid array index: ${token}`, { path });
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

// `pointer` is the index form of `path` (id tokens resolved), the path the inverse and a resolved patch use.
interface Applied { document: unknown; inverse: JsonPatchOperation; pointer: string }

function addAt(document: unknown, path: string, value: unknown): Applied {
  const tokens = resolveTokens(document, parsePointer(path), path);
  if (!tokens.length) return { document: clone(value), inverse: { op: "replace", path: "", value: clone(document) }, pointer: "" };
  const { parent, key } = parentOf(document, tokens, path);
  if (Array.isArray(parent)) {
    const at = arrayIndex(key, parent.length, true, path);
    parent.splice(at, 0, clone(value));
    const pointer = formatPointer([...tokens.slice(0, -1), at]);
    return { document, inverse: { op: "remove", path: pointer }, pointer };
  }
  const record = parent as Record<string, unknown>;
  const previous = own(record, key) ? record[key] : NONE;
  // Define own data properties, including __proto__, without invoking prototype setters.
  Object.defineProperty(record, key, { value: clone(value), enumerable: true, configurable: true, writable: true });
  const pointer = formatPointer(tokens);
  return { document, inverse: previous === NONE ? { op: "remove", path: pointer } : { op: "replace", path: pointer, value: clone(previous) }, pointer };
}

function replaceAt(document: unknown, path: string, value: unknown): Applied {
  const tokens = resolveTokens(document, parsePointer(path), path);
  if (!tokens.length) return { document: clone(value), inverse: { op: "replace", path: "", value: clone(document) }, pointer: "" };
  const { parent, key } = parentOf(document, tokens, path);
  let previous: unknown;
  let pointer = formatPointer(tokens);
  if (Array.isArray(parent)) {
    const at = arrayIndex(key, parent.length, false, path);
    previous = parent[at];
    parent[at] = clone(value);
    pointer = formatPointer([...tokens.slice(0, -1), at]);
  } else {
    const record = parent as Record<string, unknown>;
    if (!own(record, key)) throw new OPFPatchError("patch-path-missing", `Patch path does not exist: ${path}.`, { path });
    previous = record[key];
    Object.defineProperty(record, key, { value: clone(value), enumerable: true, configurable: true, writable: true });
  }
  return { document, inverse: { op: "replace", path: pointer, value: clone(previous) }, pointer };
}

function removeAt(document: unknown, path: string): Applied {
  const tokens = resolveTokens(document, parsePointer(path), path);
  if (!tokens.length) throw new OPFPatchError("patch-root-remove", "The document root cannot be removed.", { path });
  const { parent, key } = parentOf(document, tokens, path);
  let previous: unknown;
  if (Array.isArray(parent)) {
    const at = arrayIndex(key, parent.length, false, path);
    previous = parent[at];
    parent.splice(at, 1);
    const pointer = formatPointer([...tokens.slice(0, -1), at]);
    return { document, inverse: { op: "add", path: pointer, value: clone(previous) }, pointer };
  }
  const record = parent as Record<string, unknown>;
  if (!own(record, key)) throw new OPFPatchError("patch-path-missing", `Patch path does not exist: ${path}.`, { path });
  previous = record[key];
  delete record[key];
  const pointer = formatPointer(tokens);
  return { document, inverse: { op: "add", path: pointer, value: clone(previous) }, pointer };
}

interface AppliedOperation {
  document: unknown;
  inverse: JsonPatchOperation[];
  /** The operation with id tokens resolved to indexes (an `add` at `-` carries the index it appended at). */
  resolved: JsonPatchOperation;
}

function applyOne(document: unknown, operation: JsonPatchOperation): AppliedOperation {
  switch (operation.op) {
    case "add": { const r = addAt(document, operation.path, operation.value); return { document: r.document, inverse: [r.inverse], resolved: { op: "add", path: r.pointer, value: operation.value } }; }
    case "replace": { const r = replaceAt(document, operation.path, operation.value); return { document: r.document, inverse: [r.inverse], resolved: { op: "replace", path: r.pointer, value: operation.value } }; }
    case "remove": { const r = removeAt(document, operation.path); return { document: r.document, inverse: [r.inverse], resolved: { op: "remove", path: r.pointer } }; }
    case "test": {
      const found = readPointer(document, operation.path);
      if (!found.found || !jsonEqual(found.value, operation.value)) throw new OPFPatchError("patch-test-failed", `Test failed at ${operation.path || "/"}: the value changed.`, { path: operation.path });
      return { document, inverse: [], resolved: { op: "test", path: resolveIdPointer(document, operation.path), value: operation.value } };
    }
    case "copy": {
      const from = resolveIdPointer(document, operation.from);
      const value = clone(getAtPointer(document, from));
      const r = addAt(document, operation.path, value);
      return { document: r.document, inverse: [r.inverse], resolved: { op: "copy", from, path: r.pointer } };
    }
    case "move": {
      const from = resolveTokens(document, parsePointer(operation.from), operation.from);
      // The destination reads against the document as it is once the value has left (RFC 6902, 4.4), so it resolves after the removal.
      // The descendant check needs it before, and a destination that cannot resolve yet is checked as written.
      let to: string[];
      try { to = resolveTokens(document, parsePointer(operation.path), operation.path); } catch { to = parsePointer(operation.path); }
      const value = clone(getAtPointer(document, from));
      if (from.length === to.length && from.every((token, i) => token === to[i])) return { document, inverse: [], resolved: { op: "move", from: formatPointer(from), path: formatPointer(to) } };
      if (to.length > from.length && from.every((token, i) => to[i] === token)) {
        throw new OPFPatchError("patch-invalid-move", "Cannot move a value into its descendant.", { path: operation.path });
      }
      const removed = removeAt(document, formatPointer(from));
      const added = addAt(removed.document, operation.path, value);
      // Undo runs in reverse: undo the add, then undo the remove.
      return { document: added.document, inverse: [added.inverse, removed.inverse], resolved: { op: "move", from: removed.pointer, path: added.pointer } };
    }
  }
}

/** One applied operation, as `walkPatch` reports it. */
export interface PatchStep {
  /** The index of the operation within the patch. */
  index: number;
  /** The normalized operation as given (id tokens as written). */
  operation: JsonPatchOperation;
  /** The same operation with id tokens resolved to indexes in the document it applied to (an `add` at `-` carries the index it appended at). */
  resolved: JsonPatchOperation;
  /** The patch that undoes this operation, in application order. */
  inverse: JsonPatchOperation[];
}

/**
 * Apply `patch` to a clone of `document` one operation at a time and tell the hooks about each: `before` sees the document an
 * operation is about to change, `after` the document it produced. The documents are the working copy, shared between calls: read them,
 * never keep or change them. Errors are those of `applyPatch`, with the operation's index. This is the one loop under
 * `applyPatchWithInverse`, `resolveIdPatch`, `toIdPatch` and `touches`; most callers want one of them.
 * @returns the patched clone.
 */
export function walkPatch(
  document: unknown,
  patch: unknown,
  hooks: { before?: (index: number, operation: JsonPatchOperation, working: unknown) => void; after?: (step: PatchStep, working: unknown) => void } = {},
): { document: unknown; operations: JsonPatchOperation[]; inverse: JsonPatchOperation[] } {
  const operations = normalizePatch(patch);
  let working = clone(document);
  const inverse: JsonPatchOperation[] = [];
  for (const [index, operation] of operations.entries()) {
    try {
      hooks.before?.(index, operation, working);
      const applied = applyOne(working, operation);
      working = applied.document;
      inverse.unshift(...applied.inverse);
      hooks.after?.({ index, operation, resolved: applied.resolved, inverse: applied.inverse }, working);
    } catch (error) {
      if (error instanceof OPFPatchError && error.index === undefined) {
        const wrapped = new OPFPatchError(error.code, `Operation ${index}: ${error.message}`, { path: error.path, index, operation });
        throw wrapped;
      }
      throw error;
    }
  }
  return { document: working, operations, inverse };
}

/** Throws `OPFPatchHashError` unless `documentHash(document)` is `expectHash`. */
function assertExpectedHash(document: unknown, expectHash: unknown): void {
  const expected = normalizeDocumentHash(expectHash);
  if (expected === undefined) throw new OPFPatchError("invalid-expect-hash", "expectHash must be a document hash: the value documentHash(document) returns.");
  const actual = documentHash(document);
  if (actual !== expected) throw new OPFPatchHashError(expected, actual);
}

/**
 * Apply a patch to a clone of `document` and return the result with its
 * inverse. Atomic: any failing operation throws and nothing is returned.
 */
export function applyPatchWithInverse(document: unknown, patch: unknown, options: ApplyPatchOptions = {}): PatchResult {
  if (options.expectHash !== undefined) assertExpectedHash(document, options.expectHash);
  const { document: working, operations, inverse } = walkPatch(document, patch);
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


/**
 * The patch with every id token resolved to the index it has when the operation runs: `/slides/@intro/title` becomes `/slides/2/title`,
 * operation by operation, so an earlier operation that moves a slide is accounted for. A path in the destination of `move` resolves
 * after the value has left. Throws what `applyPatch` throws (`patch-id-not-found`, ...). Use it to hand an id-addressed patch to a tool
 * that reads indexes.
 */
export function resolveIdPatch(document: unknown, patch: unknown): JsonPatchOperation[] {
  const resolved: JsonPatchOperation[] = [];
  walkPatch(document, patch, { after: (step) => { resolved.push(step.resolved); } });
  return resolved;
}

/**
 * The patch with every index that names an element with an `id` written as the id token (`/slides/2/title` becomes
 * `/slides/@intro/title`), operation by operation against the document each operation applies to. Where an operation inserts
 * (`add`, `copy` and `move` destinations), the last token stays an index (or `-`): there is no element yet to name. The id form survives
 * reordering, so a host that syncs by id sends it; `applyPatch` accepts it. Elements without an id keep their indexes.
 */
export function toIdPatch(document: unknown, patch: unknown): JsonPatchOperation[] {
  const out: JsonPatchOperation[] = [];
  const pending = new Map<number, JsonPatchOperation>();
  walkPatch(document, patch, {
    before: (index, operation, working) => {
      // Locations that name an existing element convert while it still exists (a removal deletes it). The ancestors of an insertion
      // convert before it too: the insertion itself may give one of them its id (`add /slides/0/id`), which the receiver cannot yet use.
      const named = (pointer: string) => toIdPointer(working, pointer);
      switch (operation.op) {
        case "replace": case "remove": case "test": pending.set(index, { ...operation, path: named(operation.path) }); break;
        case "copy": pending.set(index, { ...operation, from: named(operation.from), path: toIdPointer(working, operation.path, { keepLast: true }) }); break;
        case "add": pending.set(index, { ...operation, path: toIdPointer(working, operation.path, { keepLast: true }) }); break;
        case "move": pending.set(index, { ...operation, from: named(operation.from) }); break;
      }
    },
    after: (step, working) => {
      const early = pending.get(step.index)!;
      pending.delete(step.index);
      if (step.operation.op !== "move") { out.push(early); return; }
      // A moved element keeps its ancestors' ids; its destination converts once it has left, as the receiver resolves it.
      const appended = parsePointer(step.operation.path).at(-1) === "-";
      const destination = toIdPointer(working, step.resolved.path, { keepLast: true });
      out.push({ ...early, path: appended ? formatPointer([...parsePointer(destination).slice(0, -1), "-"]) : destination } as JsonPatchOperation);
    },
  });
  return out;
}
