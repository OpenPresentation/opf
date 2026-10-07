// Three-way merge of OPF documents.
//
// `merge(base, ours, theirs)` combines two independently edited
// copies of `base`. Changes that touch different places merge automatically;
// changes that collide are reported as conflict objects and are never dropped
// without a record: the merged document carries one side's value (ours unless
// `prefer: "theirs"`), and the conflict holds both sides and the base.
//
// Arrays (slides, blocks, list items, table rows) are merged element-wise
// using the same matching as `diff`: by `id`, then identical
// content, then similarity. Insertions from both sides are kept (ours first at
// the same position), a deletion beats an untouched element, and a move on
// one side is applied unless the other side moved the same element elsewhere.
import { annotationText } from "./annotations.js";
import { jsonEqual, formatPointer } from "./patch.js";
import { matchArrays, idOf, DEFAULT_MATCH_THRESHOLD, type MatchOptions } from "./diff-match.js";

export type MergeConflictKind = "modify-modify" | "modify-delete" | "delete-modify" | "add-add" | "move-move";

export interface MergeConflict {
  kind: MergeConflictKind;
  /** JSON Pointer in the merged document where the resolved value lives (or would live if it was deleted). */
  path: string;
  /** The value in the base document, when it had one. */
  base?: unknown;
  /** Our value; absent when we deleted it. */
  ours?: unknown;
  /** Their value; absent when they deleted it. */
  theirs?: unknown;
  /** Which side deleted the value, for `modify-delete` and `delete-modify`. */
  deletedBy?: "ours" | "theirs";
  /** Which side the merged document took. */
  resolution: "ours" | "theirs";
  /** The slide the conflict is inside, when it is inside one. */
  slide?: { id?: string; title?: string; index: number };
  message: string;
}

export interface MergeOptions extends MatchOptions {
  /** Which side the merged document takes where the sides collide. Default "ours". Conflicts are reported either way. */
  prefer?: "ours" | "theirs";
}

export interface MergeResult {
  /** The merged document. Conflicting places hold the preferred side's value. */
  merged: unknown;
  conflicts: MergeConflict[];
  /** True when there are no conflicts. */
  clean: boolean;
  /** How many places changed on only one side (applied automatically) or identically on both. */
  applied: { ours: number; theirs: number; both: number };
}

const ABSENT = Symbol("absent");
type Maybe = unknown;

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const has = (value: object, key: string) => Object.hasOwn(value, key);
const same = (x: Maybe, y: Maybe) => (x === ABSENT || y === ABSENT ? x === y : jsonEqual(x, y));
const kindOf = (value: Maybe) => (value === ABSENT ? "absent" : Array.isArray(value) ? "array" : value === null ? "null" : typeof value);

interface Context {
  prefer: "ours" | "theirs";
  match: MatchOptions;
  conflicts: MergeConflict[];
  applied: { ours: number; theirs: number; both: number };
  slide?: { id?: string; title?: string; index: number };
}

const MESSAGES: Record<MergeConflictKind, string> = {
  "modify-modify": "Both sides changed this value differently.",
  "modify-delete": "We changed this value; they deleted it.",
  "delete-modify": "We deleted this value; they changed it.",
  "add-add": "Both sides added different values here.",
  "move-move": "Both sides moved this element to different positions.",
};

function conflict(ctx: Context, kind: MergeConflictKind, path: (string | number)[], base: Maybe, ours: Maybe, theirs: Maybe): Maybe {
  const entry: MergeConflict = { kind, path: formatPointer(path), resolution: ctx.prefer, message: MESSAGES[kind] } as MergeConflict;
  if (base !== ABSENT) entry.base = structuredClone(base);
  if (ours !== ABSENT) entry.ours = structuredClone(ours);
  if (theirs !== ABSENT) entry.theirs = structuredClone(theirs);
  if (kind === "modify-delete") entry.deletedBy = "theirs";
  if (kind === "delete-modify") entry.deletedBy = "ours";
  if (ctx.slide) entry.slide = { ...ctx.slide };
  ctx.conflicts.push(entry);
  return ctx.prefer === "ours" ? ours : theirs;
}

function mergeValue(base: Maybe, ours: Maybe, theirs: Maybe, path: (string | number)[], ctx: Context): Maybe {
  if (same(ours, theirs)) { if (!same(ours, base)) ctx.applied.both++; return ours; }
  if (same(ours, base)) { ctx.applied.theirs++; return theirs; }
  if (same(theirs, base)) { ctx.applied.ours++; return ours; }
  // The sides disagree and both differ from the base.
  if (base !== ABSENT) {
    if (ours === ABSENT) return conflict(ctx, "delete-modify", path, base, ours, theirs);
    if (theirs === ABSENT) return conflict(ctx, "modify-delete", path, base, ours, theirs);
    if (isObject(base) && isObject(ours) && isObject(theirs)) return mergeObject(base, ours, theirs, path, ctx);
    if (Array.isArray(base) && Array.isArray(ours) && Array.isArray(theirs)) return mergeArray(base, ours, theirs, path, ctx);
    return conflict(ctx, "modify-modify", path, base, ours, theirs);
  }
  // Both sides added a value where the base had none.
  if (isObject(ours) && isObject(theirs)) return mergeObject({}, ours, theirs, path, ctx);
  if (Array.isArray(ours) && Array.isArray(theirs)) return mergeArray([], ours, theirs, path, ctx);
  return conflict(ctx, "add-add", path, base, ours, theirs);
}

function mergeObject(base: Record<string, unknown>, ours: Record<string, unknown>, theirs: Record<string, unknown>, path: (string | number)[], ctx: Context): Record<string, unknown> {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const source of [base, ours, theirs]) for (const key of Object.keys(source)) if (!seen.has(key)) { seen.add(key); keys.push(key); }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = mergeValue(has(base, key) ? base[key] : ABSENT, has(ours, key) ? ours[key] : ABSENT, has(theirs, key) ? theirs[key] : ABSENT, [...path, key], ctx);
    // Define own data properties, including __proto__, without invoking prototype setters.
    if (value !== ABSENT) Object.defineProperty(out, key, { value, enumerable: true, configurable: true, writable: true });
  }
  return out;
}

interface Node {
  /** Index in base, ours, theirs; -1 when absent there. */
  b: number;
  o: number;
  t: number;
  /** Set when both sides moved the element to different places. */
  moveConflict?: boolean;
}

function mergeArray(base: unknown[], ours: unknown[], theirs: unknown[], path: (string | number)[], ctx: Context): unknown[] {
  const mo = matchArrays(base, ours, ctx.match), mt = matchArrays(base, theirs, ctx.match);
  const oOf = new Array<number>(base.length).fill(-1), tOf = new Array<number>(base.length).fill(-1);
  const baseOfO = new Array<number>(ours.length).fill(-1), baseOfT = new Array<number>(theirs.length).fill(-1);
  for (const pair of mo.pairs) { oOf[pair.a] = pair.b; baseOfO[pair.b] = pair.a; }
  for (const pair of mt.pairs) { tOf[pair.a] = pair.b; baseOfT[pair.b] = pair.a; }

  // The spine is our order. Everything of theirs is woven into it.
  const spine: Node[] = ours.map((_, o) => { const b = baseOfO[o]!; return { b, o, t: b >= 0 ? tOf[b]! : -1 }; });
  const oursAddedOnly = (node: Node | undefined) => !!node && node.b < 0 && node.o >= 0 && node.t < 0;
  const tNode = new Map<number, Node>();
  for (const node of spine) if (node.t >= 0) tNode.set(node.t, node);

  const insertAfterPredecessor = (ti: number, node: Node) => {
    let anchor: Node | undefined;
    for (let p = ti - 1; p >= 0 && !anchor; p--) anchor = tNode.get(p);
    let at = anchor ? spine.indexOf(anchor) + 1 : 0;
    // Our own insertions at the same position stay ahead of theirs.
    while (oursAddedOnly(spine[at])) at++;
    spine.splice(at, 0, node);
  };

  // Theirs: insertions and elements we deleted that they still carry.
  for (let ti = 0; ti < theirs.length; ti++) {
    const bi = baseOfT[ti]!;
    if (bi >= 0) {
      if (oOf[bi]! >= 0) continue; // already on the spine
      // We deleted it. A deletion beats an untouched element; against an edit it is a conflict.
      if (same(base[bi], theirs[ti])) { ctx.applied.ours++; continue; }
      const node: Node = { b: bi, o: -1, t: ti };
      tNode.set(ti, node);
      insertAfterPredecessor(ti, node);
      continue;
    }
    // Their insertion; collapse it onto an identical or same-id insertion of ours.
    const id = idOf(theirs[ti]);
    let twin = id !== undefined ? spine.find(node => oursAddedOnly(node) && idOf(ours[node.o]) === id) : undefined;
    if (!twin) {
      let anchor: Node | undefined;
      for (let p = ti - 1; p >= 0 && !anchor; p--) anchor = tNode.get(p);
      for (let at = anchor ? spine.indexOf(anchor) + 1 : 0; oursAddedOnly(spine[at]); at++) {
        if (jsonEqual(ours[spine[at]!.o], theirs[ti])) { twin = spine[at]; break; }
      }
    }
    if (twin) { twin.t = ti; tNode.set(ti, twin); continue; }
    const node: Node = { b: -1, o: -1, t: ti };
    tNode.set(ti, node);
    insertAfterPredecessor(ti, node);
  }

  // Theirs: moves of elements that are still on the spine.
  const basePredecessor = (list: number[], index: number) => { for (let p = index - 1; p >= 0; p--) if (list[p]! >= 0) return list[p]!; return -1; };
  const movedByTheirs = mt.pairs.filter(pair => mt.moved.has(pair.a)).sort((x, y) => x.b - y.b);
  for (const pair of movedByTheirs) {
    const node = spine.find(candidate => candidate.b === pair.a && candidate.o >= 0 && candidate.t === pair.b);
    if (!node) continue;
    if (mo.moved.has(pair.a)) {
      if (basePredecessor(baseOfO, node.o) === basePredecessor(baseOfT, pair.b)) continue;
      node.moveConflict = true;
      if (ctx.prefer === "ours") continue;
    }
    spine.splice(spine.indexOf(node), 1);
    insertAfterPredecessor(pair.b, node);
  }

  // Resolve every node into the merged array.
  const out: unknown[] = [];
  const isSlides = path.length === 1 && path[0] === "slides";
  for (const node of spine) {
    const at = [...path, out.length];
    const savedSlide = ctx.slide;
    if (isSlides) {
      const sample = node.o >= 0 ? ours[node.o] : node.t >= 0 ? theirs[node.t] : base[node.b];
      ctx.slide = { index: out.length, ...(idOf(sample) !== undefined ? { id: idOf(sample) } : {}), ...(isObject(sample) && (typeof sample.title === "string" || Array.isArray(sample.title)) && annotationText(sample.title) ? { title: annotationText(sample.title) } : {}) };
    }
    try {
      const b = node.b >= 0 ? base[node.b] : ABSENT, o = node.o >= 0 ? ours[node.o] : ABSENT, t = node.t >= 0 ? theirs[node.t] : ABSENT;
      if (node.b >= 0) {
        if (o !== ABSENT && t !== ABSENT) {
          const merged = mergeValue(b, o, t, at, ctx);
          if (node.moveConflict) {
            ctx.conflicts.push({ kind: "move-move", path: formatPointer(at), base: structuredClone(b), resolution: ctx.prefer, message: MESSAGES["move-move"], ...(ctx.slide ? { slide: { ...ctx.slide } } : {}) });
          }
          out.push(merged);
        } else if (o !== ABSENT) {
          // Theirs deleted it.
          if (same(b, o)) ctx.applied.theirs++;
          else { const kept = conflict(ctx, "modify-delete", at, b, o, ABSENT); if (kept !== ABSENT) out.push(kept); }
        } else if (t !== ABSENT) {
          // Ours deleted it, theirs changed it.
          const kept = conflict(ctx, "delete-modify", at, b, ABSENT, t);
          if (kept !== ABSENT) out.push(kept);
        }
      } else if (o !== ABSENT && t !== ABSENT) {
        out.push(mergeValue(ABSENT, o, t, at, ctx));
      } else if (o !== ABSENT) { ctx.applied.ours++; out.push(o); }
      else { ctx.applied.theirs++; out.push(t); }
    } finally { ctx.slide = savedSlide; }
  }
  return out;
}

/**
 * Three-way merge of OPF documents. Never discards a side silently: every
 * collision is listed in `conflicts` with the base, our value and their value.
 * The merged document is not validated; callers validate it before saving.
 */
export function merge(base: unknown, ours: unknown, theirs: unknown, options: MergeOptions = {}): MergeResult {
  const ctx: Context = {
    prefer: options.prefer === "theirs" ? "theirs" : "ours",
    match: { threshold: options.threshold ?? DEFAULT_MATCH_THRESHOLD },
    conflicts: [], applied: { ours: 0, theirs: 0, both: 0 },
  };
  const merged = mergeValue(structuredClone(base), structuredClone(ours), structuredClone(theirs), [], ctx);
  return { merged: merged === ABSENT ? undefined : merged, conflicts: ctx.conflicts, clean: ctx.conflicts.length === 0, applied: ctx.applied };
}
