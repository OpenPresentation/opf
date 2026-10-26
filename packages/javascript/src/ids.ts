// Ids and patch scope (CE-04, CE-05).
//
// - `assignIds` fills the missing `id` of slides and content payloads (blocks, groups, regions) so edits can be addressed to
//   them across reordering; the id-addressed pointer (`/slides/@intro/blocks/@kpi`) is `resolveIdPointer` / `toIdPointer` in ./patch.ts.
// - `touches` reports what a patch reads and writes: the pointers, in index and id form, the ids of the slides and payloads
//   involved, and the part of the document each location belongs to. Hosts build conflict detection and permission checks on it.
// - `documentHash` is the content hash a patch application can require (`expectHash`).
import { isRecord, promotedRegionKeys, visitContentPayloads } from "./content-walk.js";
import type { JsonPatchOperation } from "./generated/types/finding.js";
import {
  applyPatch,
  formatPointer,
  idToken,
  isIdToken,
  normalizePatch,
  parsePointer,
  readPointer,
  resolveIdPointer,
  toIdPointer,
  walkPatch,
} from "./patch.js";

export { documentHash, OPFPatchHashError, idToken, isIdToken, resolveIdPatch, resolveIdPointer, toIdPatch, toIdPointer } from "./patch.js";

const INDEX_TOKEN = /^(0|[1-9][0-9]*)$/;

// ---------------------------------------------------------------------------
// assignIds

export type IdErrorCode = "invalid-document" | "invalid-id" | "duplicate-id";

/** Thrown by `assignIds` for a value that is not a document or a `generate` that returns an unusable id. */
export class OPFIdError extends Error {
  readonly code: IdErrorCode;
  /** The JSON Pointer of the slide or payload the error is about, when known. */
  path?: string;
  constructor(code: IdErrorCode, message: string, path?: string) {
    super(message);
    this.name = "OPFIdError";
    this.code = code;
    if (path !== undefined) this.path = path;
  }
}

export interface AssignIdsContext {
  /** `slide` for an entry of `slides`; `block` for a content payload (a block, a nested group or a promoted region). */
  kind: "slide" | "block";
  /** The JSON Pointer of the node, in index form (`/slides/2/blocks/0`). */
  pointer: string;
  /** The node, read only. */
  node: Readonly<Record<string, unknown>>;
  /** The id of the nearest slide or group above the node that has one (an id assigned earlier in this call counts). */
  parentId?: string;
}

export interface AssignIdsOptions {
  /**
   * Make the id of a node. It must return a non-empty string no slide or payload of the document uses, or `assignIds` throws
   * `OPFIdError` (`invalid-id`, `duplicate-id`). It is called in document order and must not depend on anything but its argument if the
   * result is to be deterministic. The default makes `slide-1`, `slide-2`, ... and `block-1`, `block-2`, ... skipping ids in use.
   */
  generate?: (context: AssignIdsContext) => string;
}

export interface AssignedId {
  /** The JSON Pointer of the node that got the id, in index form. */
  pointer: string;
  kind: "slide" | "block";
  id: string;
}

export interface AssignIdsResult {
  /** A copy of the document in which every slide and payload has an id. */
  document: unknown;
  /** The `add` operations that produce `document` from the input: one `/…/id` per assigned id. Empty when nothing was missing. */
  patch: JsonPatchOperation[];
  assigned: AssignedId[];
}

/**
 * Give every slide and content payload that has no `id` one, deterministically: the same document and `generate` give the same ids. An
 * existing id is never changed (not even a duplicate: that is a validation finding, not an assignment), and a new id is never one in
 * use, so a valid document stays valid. The input is not changed; `patch` is the same change as operations, for an editor to apply as one
 * undoable edit. The id is added as the node's last member (`format` puts it in canonical order).
 *
 * Slides and payloads share one id namespace in the schema; list items, table rows and runs have no id.
 */
export function assignIds(document: unknown, options: AssignIdsOptions = {}): AssignIdsResult {
  if (!isRecord(document)) throw new OPFIdError("invalid-document", "assignIds expects a presentation object.");
  const taken = new Set<string>();
  const slides = Array.isArray(document.slides) ? document.slides : [];
  const known = (node: Record<string, unknown>) => { if (typeof node.id === "string") taken.add(node.id); };
  slides.forEach((slide, index) => {
    if (!isRecord(slide)) return;
    known(slide);
    visitContentPayloads(slide, `/slides/${index}`, known);
  });

  const counters = { slide: 0, block: 0 };
  const byDefault = (kind: "slide" | "block"): string => {
    let id: string;
    do { counters[kind] += 1; id = `${kind}-${counters[kind]}`; } while (taken.has(id));
    return id;
  };
  const idOf = new Map<string, string>();
  const parentIdOf = (pointer: string): string | undefined => {
    for (let tokens = parsePointer(pointer).slice(0, -1); tokens.length; tokens = tokens.slice(0, -1)) {
      const id = idOf.get(formatPointer(tokens));
      if (id !== undefined) return id;
    }
    return undefined;
  };

  const patch: JsonPatchOperation[] = [];
  const assigned: AssignedId[] = [];
  const visit = (kind: "slide" | "block", node: Record<string, unknown>, pointer: string): void => {
    if (typeof node.id === "string") { idOf.set(pointer, node.id); return; }
    if (Object.hasOwn(node, "id")) return;
    let id: string;
    if (options.generate) {
      const parentId = parentIdOf(pointer);
      id = options.generate({ kind, pointer, node, ...(parentId !== undefined ? { parentId } : {}) });
      if (typeof id !== "string" || id === "") throw new OPFIdError("invalid-id", `generate returned ${JSON.stringify(id)} for ${pointer}; an id is a non-empty string.`, pointer);
      if (taken.has(id)) throw new OPFIdError("duplicate-id", `generate returned '${id}' for ${pointer}, which another slide or block already has.`, pointer);
    } else id = byDefault(kind);
    taken.add(id);
    idOf.set(pointer, id);
    patch.push({ op: "add", path: `${pointer}/id`, value: id });
    assigned.push({ pointer, kind, id });
  };
  slides.forEach((slide, index) => {
    if (!isRecord(slide)) return;
    const pointer = `/slides/${index}`;
    visit("slide", slide, pointer);
    visitContentPayloads(slide, pointer, (payload, path) => visit("block", payload, path));
  });
  return { document: applyPatch(document, patch), patch, assigned };
}

// ---------------------------------------------------------------------------
// touches

/**
 * The part of a presentation a location belongs to:
 * - `document`: the whole document (the root);
 * - `slide-order`: the `slides` array, or a slide as a whole (added, removed, moved, copied);
 * - `slide`: a field of one slide, or a slide replaced or read as a whole;
 * - `block`: a content payload (a block, a nested group or a promoted region) or the `blocks` array that holds it, below a slide;
 * - `design`: the deck's `design` or a slide's `design`;
 * - `assets`, `catalogs`: the deck's `assets` and `catalogs`;
 * - `metadata`: every other deck field (`name`, `language`, `references`, `datasets`, `variables`, `narrative`, `extensions`, ...).
 */
export type PatchScopeKind = "document" | "slide-order" | "slide" | "block" | "design" | "assets" | "catalogs" | "metadata";

const KIND_ORDER: readonly PatchScopeKind[] = ["document", "slide-order", "slide", "block", "design", "assets", "catalogs", "metadata"];

/** One location an operation reads or writes. */
export interface PatchTouch {
  /** The index of the operation within the patch. */
  operation: number;
  op: JsonPatchOperation["op"];
  /**
   * The JSON Pointer of the location. With a document: in index form, as it is when the operation runs (id tokens resolved, an
   * `add` at `-` given the index it appended at). Without one: as written.
   */
  pointer: string;
  /** The same location with `@id` tokens wherever an element has an id; without a document, as written. It survives reordering. */
  idPointer: string;
  kind: PatchScopeKind;
  /**
   * The ids of the slides and payloads this location is inside, is, or contains: every slide and payload on the path, plus the
   * ones inside the value a write removes, replaces or inserts (removing a slide lists its blocks). Without a document: the ids the
   * pointer names with id tokens and the ids inside the operation's value.
   */
  ids: string[];
  /** The ids in `ids` that belong to slides. */
  slideIds: string[];
}

export interface PatchScope {
  /** What the patch looks at without changing: `test`, and the source of `copy`. In operation order. */
  reads: PatchTouch[];
  /** What the patch changes: `add`, `replace`, `remove`, both ends of `move`, the destination of `copy`. In operation order. */
  writes: PatchTouch[];
  /** Every id in `reads` and `writes`, in order of first appearance. */
  ids: string[];
  slideIds: string[];
  /** The kinds of `reads` and `writes`, in the order `PatchScopeKind` lists them. */
  kinds: PatchScopeKind[];
}

type Shape = "document" | "slides" | "slide" | "payloads" | "payload" | "other";
interface Located { kind: PatchScopeKind; shape: Shape; ids: string[]; slideIds: string[] }
const AREAS: Record<string, PatchScopeKind> = { design: "design", assets: "assets", catalogs: "catalogs" };

/** The element of `array` a token names, and its id: an index in a document, or an id token (which also works with no document). */
function elementAt(array: unknown, token: string): { id?: string; node?: Record<string, unknown> } {
  if (isIdToken(token)) {
    const id = token.slice(1);
    const node = Array.isArray(array) ? array.find((item) => isRecord(item) && item.id === id) : undefined;
    return { id, ...(isRecord(node) ? { node } : {}) };
  }
  if (Array.isArray(array) && INDEX_TOKEN.test(token)) {
    const node = array[Number(token)];
    if (isRecord(node)) return { ...(typeof node.id === "string" && node.id !== "" ? { id: node.id } : {}), node };
  }
  return {};
}

/** What part of the presentation the location is, and the slides and payloads on the way to it. `document` may be undefined (then only id tokens name anything). */
function locate(tokens: readonly string[], document: unknown, readOnlyOrReplace: boolean): Located {
  const ids: string[] = [], slideIds: string[] = [];
  const out = (kind: PatchScopeKind, shape: Shape): Located => ({ kind, shape, ids, slideIds });
  if (!tokens.length) return out("document", "document");
  if (tokens[0] !== "slides") return out(AREAS[tokens[0]!] ?? "metadata", "other");
  if (tokens.length === 1) return out("slide-order", "slides");
  const slide = elementAt(isRecord(document) ? document.slides : undefined, tokens[1]!);
  if (slide.id !== undefined) { ids.push(slide.id); slideIds.push(slide.id); }
  if (tokens.length === 2) return out(readOnlyOrReplace ? "slide" : "slide-order", "slide");
  if (tokens[2] === "design") return out("design", "other");
  let kind: PatchScopeKind = "slide", shape: Shape = "other";
  let node = slide.node, slideLevel = true;
  for (let i = 2; i < tokens.length;) {
    const token = tokens[i]!;
    if (slideLevel && (promotedRegionKeys as readonly string[]).includes(token)) {
      const child = node?.[token];
      if (isRecord(child) && typeof child.id === "string") ids.push(child.id);
      kind = "block"; node = isRecord(child) ? child : undefined; slideLevel = false; i += 1;
      shape = i === tokens.length ? "payload" : "other";
    } else if (token === "blocks") {
      kind = "block"; i += 1;
      if (i === tokens.length) { shape = "payloads"; break; }
      const child = elementAt(node?.blocks, tokens[i]!);
      if (child.id !== undefined) ids.push(child.id);
      node = child.node; slideLevel = false; i += 1;
      shape = i === tokens.length ? "payload" : "other";
    } else break;
  }
  return out(kind, shape);
}

/** The ids of the slides and payloads inside `value`, which sits at a location of this shape. */
function idsWithin(shape: Shape, value: unknown, into: { ids: string[]; slideIds: string[] }): void {
  const payload = (node: unknown, slide: boolean): void => {
    if (!isRecord(node)) return;
    if (typeof node.id === "string") { into.ids.push(node.id); if (slide) into.slideIds.push(node.id); }
    visitContentPayloads(node, "", (child) => { if (typeof child.id === "string") into.ids.push(child.id); });
  };
  if (shape === "document") { if (isRecord(value) && Array.isArray(value.slides)) for (const slide of value.slides) payload(slide, true); }
  else if (shape === "slides") { if (Array.isArray(value)) for (const slide of value) payload(slide, true); }
  else if (shape === "slide") payload(value, true);
  else if (shape === "payloads") { if (Array.isArray(value)) for (const child of value) payload(child, false); }
  else if (shape === "payload") payload(value, false);
}

const unique = (list: readonly string[]): string[] => [...new Set(list)];

/**
 * The id form of the place a value is inserted at, written before the insertion: the ancestors by their ids, and the new element by the
 * id it brings when it goes into an array (otherwise the index or `-`, since no element is there yet to name).
 */
function insertionIdPointer(state: unknown, path: string, value: unknown): string {
  const named = parsePointer(toIdPointer(state, path, { keepLast: true }));
  const resolved = parsePointer(resolveIdPointer(state, path));
  if (named.length && isRecord(value) && typeof value.id === "string" && value.id !== "") {
    const parent = readPointer(state, resolved.slice(0, -1));
    if (parent.found && Array.isArray(parent.value)) named[named.length - 1] = idToken(value.id);
  }
  return formatPointer(named);
}

/**
 * What a patch reads and writes, for conflict detection and permission checks.
 *
 * Without `document`, from the patch alone: the pointers as written, the id tokens they carry and the ids inside the values the
 * operations insert. With `document`, the patch is walked operation by operation against that document (the version it was made for),
 * so each location is resolved as it is when its operation runs: an earlier operation that inserts or moves a slide is accounted for,
 * `@id` tokens become indexes, every location also gets its id form, and a `remove`, `replace` or `move` lists the ids of what it
 * destroys. A patch that does not apply to `document` throws the `OPFPatchError` that `applyPatch` throws; the document is not changed.
 *
 * Two patches made against the same document conflict when a write of one has the same `idPointer` as, or sits inside or above, a
 * location the other reads or writes (compare `pointer` when elements have no ids), or when what one destroys is in the `ids` of the
 * other. A `move` changes where an element sits, not what is inside it, so it meets the element and its siblings but not an edit
 * inside it: skip the descendants of a `move` location (`op` is `move`). A permission check reads `kind`, `slideIds` and `ids` of
 * `writes`, moves included. What counts as a conflict and what a user may touch stays with the host.
 */
export function touches(patch: unknown, document?: unknown): PatchScope {
  const reads: PatchTouch[] = [];
  const writes: PatchTouch[] = [];
  const record = (list: PatchTouch[], index: number, operation: JsonPatchOperation, pointer: string, state: unknown, values: readonly unknown[], idPointer?: string): void => {
    const tokens = parsePointer(pointer);
    const where = locate(tokens, state, operation.op === "replace" || operation.op === "test" || list === reads);
    const found = { ids: where.ids, slideIds: where.slideIds };
    for (const value of values) idsWithin(where.shape, value, found);
    list.push({ operation: index, op: operation.op, pointer, idPointer: idPointer ?? pointer, kind: where.kind, ids: unique(found.ids), slideIds: unique(found.slideIds) });
  };

  if (document === undefined) {
    normalizePatch(patch).forEach((operation, index) => {
      switch (operation.op) {
        case "add": case "replace": record(writes, index, operation, operation.path, undefined, [operation.value]); break;
        case "remove": record(writes, index, operation, operation.path, undefined, []); break;
        case "test": record(reads, index, operation, operation.path, undefined, [operation.value]); break;
        case "copy": record(reads, index, operation, operation.from, undefined, []); record(writes, index, operation, operation.path, undefined, []); break;
        case "move": record(writes, index, operation, operation.from, undefined, []); record(writes, index, operation, operation.path, undefined, []); break;
      }
    });
  } else {
    // The value a copy or a move carries is read before the operation and written after it.
    const carried = new Map<number, unknown>();
    const insertion = new Map<number, string>();
    const valueAt = (state: unknown, pointer: string): unknown[] => { const found = readPointer(state, pointer); return found.found ? [found.value] : []; };
    walkPatch(document, patch, {
      before: (index, operation, working) => {
        if (operation.op === "add") { insertion.set(index, insertionIdPointer(working, operation.path, operation.value)); return; }
        const source = operation.op === "copy" || operation.op === "move" ? operation.from : operation.path;
        const pointer = resolveIdPointer(working, source);
        const old = valueAt(working, pointer);
        if (operation.op === "copy" || operation.op === "move") carried.set(index, old[0]);
        if (operation.op === "copy") insertion.set(index, insertionIdPointer(working, operation.path, old[0]));
        const idPointer = toIdPointer(working, pointer);
        if (operation.op === "test") record(reads, index, operation, pointer, working, old, idPointer);
        else if (operation.op === "copy") record(reads, index, operation, pointer, working, old, idPointer);
        else if (operation.op === "replace") record(writes, index, operation, pointer, working, [...old, operation.value], idPointer);
        else record(writes, index, operation, pointer, working, old, idPointer);
      },
      after: (step, working) => {
        const { operation, resolved, index } = step;
        if (operation.op !== "add" && operation.op !== "copy" && operation.op !== "move") return;
        const value = operation.op === "add" ? operation.value : carried.get(index);
        // A moved element is named by its own id once it has landed; an inserted one by the id it brings, and its ancestors by their
        // ids before the insertion (the insertion may give one of them its id).
        const idPointer = operation.op === "move" ? toIdPointer(working, resolved.path) : insertion.get(index)!;
        record(writes, index, operation, resolved.path, working, [value], idPointer);
      },
    });
  }

  const all = [...reads, ...writes];
  return {
    reads,
    writes,
    ids: unique(all.flatMap((touch) => touch.ids)),
    slideIds: unique(all.flatMap((touch) => touch.slideIds)),
    kinds: KIND_ORDER.filter((kind) => all.some((touch) => touch.kind === kind)),
  };
}
