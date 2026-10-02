// Semantic diff of two OPF documents.
//
// `diffPresentations(a, b)` matches slides (and every other array's elements)
// deterministically, then reports what changed as typed, categorised changes
// and as an RFC 6902 patch that turns A into B. Moves are detected, not
// reported as a remove plus an add. The report is a pure function of the two
// documents: no timestamps, no randomness, no network.
import { formatPointer, jsonEqual, type JsonPatchOperation } from "./patch.js";
import { matchArrays, idOf, DEFAULT_MATCH_THRESHOLD, type MatchedBy, type MatchOptions } from "./diff-match.js";

export { mergePresentations } from "./merge.js";
export type { MergeConflict, MergeConflictKind, MergeOptions, MergeResult } from "./merge.js";
export { matchArrays, similarity } from "./diff-match.js";
export type { ArrayMatch, MatchPair, MatchedBy, MatchOptions } from "./diff-match.js";

export type DiffChangeType = "added" | "removed" | "changed" | "moved";
/** What kind of thing changed. */
export type DiffCategory = "slide" | "block" | "field" | "design" | "metadata" | "assets" | "catalogs" | "variables" | "narrative" | "extensions";

export interface DiffSlideRef {
  id?: string;
  title?: string;
  /** Index in the first document, when the slide exists there. */
  aIndex?: number;
  /** Index in the second document, when the slide exists there. */
  bIndex?: number;
}

export interface DiffChange {
  type: DiffChangeType;
  category: DiffCategory;
  /** JSON Pointer in document A (absent for additions). */
  aPath?: string;
  /** JSON Pointer in document B (absent for removals). */
  bPath?: string;
  /** Value in A (removed and changed). */
  before?: unknown;
  /** Value in B (added and changed). */
  after?: unknown;
  /** The slide the change belongs to, for slide-scoped changes. */
  slide?: DiffSlideRef;
}

export interface SlideMatchInfo extends DiffSlideRef {
  /** How the slide was identified across the documents; absent for added/removed slides. */
  matchedBy?: MatchedBy;
  similarity?: number;
  status: "unchanged" | "modified" | "moved" | "moved-modified" | "added" | "removed";
}

export interface DiffSummary {
  total: number;
  byCategory: Partial<Record<DiffCategory, number>>;
  byType: Partial<Record<DiffChangeType, number>>;
  slides: { added: number; removed: number; moved: number; modified: number; unchanged: number };
}

export interface PresentationDiff {
  equal: boolean;
  changes: DiffChange[];
  /** RFC 6902 patch: `applyPatch(a, patch)` deep-equals `b`. */
  patch: JsonPatchOperation[];
  slides: SlideMatchInfo[];
  summary: DiffSummary;
}

export type DiffOptions = MatchOptions;

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const REGION_KEY = /^(top|middle|bottom|left|center|right)([:+].*)?$/u;
const ROOT_CATEGORIES: Record<string, DiffCategory> = { design: "design", assets: "assets", catalogs: "catalogs", variables: "variables", narrative: "narrative", extensions: "extensions" };

/** The category a change at `tokens` belongs to. */
export function categoryOf(tokens: readonly string[]): DiffCategory {
  const [root] = tokens;
  if (root === undefined) return "metadata";
  if (root === "slides") {
    if (tokens.length <= 2) return "slide";
    if (tokens[2] === "design") return "design";
    const last = tokens[tokens.length - 1] ?? "", parent = tokens[tokens.length - 2];
    if (parent === "blocks" && /^\d+$/u.test(last)) return "block";
    if (REGION_KEY.test(last)) return "block";
    return "field";
  }
  return ROOT_CATEGORIES[root] ?? "metadata";
}

interface Context {
  options: DiffOptions;
  changes: DiffChange[];
  patch: JsonPatchOperation[];
  slide?: DiffSlideRef;
  slides: SlideMatchInfo[];
}

const pointer = (tokens: readonly (string | number)[]) => formatPointer(tokens);
const titleOf = (slide: unknown): string | undefined => (isObject(slide) && typeof slide.title === "string" ? slide.title : undefined);
const slideRef = (slide: unknown, aIndex?: number, bIndex?: number): DiffSlideRef => {
  const ref: DiffSlideRef = {};
  const id = idOf(slide), title = titleOf(slide);
  if (id !== undefined) ref.id = id;
  if (title !== undefined) ref.title = title;
  if (aIndex !== undefined) ref.aIndex = aIndex;
  if (bIndex !== undefined) ref.bIndex = bIndex;
  return ref;
};

function record(ctx: Context, change: DiffChange) {
  if (ctx.slide) change.slide = { ...ctx.slide };
  ctx.changes.push(change);
}

function diffValue(a: unknown, b: unknown, aPath: (string | number)[], bPath: (string | number)[], ctx: Context): void {
  if (jsonEqual(a, b)) return;
  if (Array.isArray(a) && Array.isArray(b)) { diffArray(a, b, aPath, bPath, ctx); return; }
  if (isObject(a) && isObject(b)) { diffObject(a, b, aPath, bPath, ctx); return; }
  ctx.patch.push({ op: "replace", path: pointer(bPath), value: structuredClone(b) });
  record(ctx, { type: "changed", category: categoryOf(bPath.map(String)), aPath: pointer(aPath), bPath: pointer(bPath), before: structuredClone(a), after: structuredClone(b) });
}

function diffObject(a: Record<string, unknown>, b: Record<string, unknown>, aPath: (string | number)[], bPath: (string | number)[], ctx: Context): void {
  const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
  for (const key of Object.keys(a)) {
    if (own(b, key)) continue;
    ctx.patch.push({ op: "remove", path: pointer([...bPath, key]) });
    record(ctx, { type: "removed", category: categoryOf([...aPath, key].map(String)), aPath: pointer([...aPath, key]), before: structuredClone(a[key]) });
  }
  for (const key of Object.keys(b)) {
    if (!own(a, key)) {
      ctx.patch.push({ op: "add", path: pointer([...bPath, key]), value: structuredClone(b[key]) });
      record(ctx, { type: "added", category: categoryOf([...bPath, key].map(String)), bPath: pointer([...bPath, key]), after: structuredClone(b[key]) });
    } else diffValue(a[key], b[key], [...aPath, key], [...bPath, key], ctx);
  }
}

function diffArray(a: unknown[], b: unknown[], aPath: (string | number)[], bPath: (string | number)[], ctx: Context): void {
  const match = matchArrays(a, b, ctx.options);
  const isSlides = aPath.length === 1 && aPath[0] === "slides" && bPath.length === 1 && bPath[0] === "slides";
  const category = (path: (string | number)[]) => categoryOf(path.map(String));

  // Slides: record how each was matched.
  if (isSlides) {
    const changedPairs = new Set<number>();
    for (const pair of match.pairs) if (!jsonEqual(a[pair.a], b[pair.b])) changedPairs.add(pair.a);
    const infos: SlideMatchInfo[] = [];
    for (const pair of match.pairs) {
      const moved = match.moved.has(pair.a), changed = changedPairs.has(pair.a);
      infos.push({ ...slideRef(b[pair.b], pair.a, pair.b), matchedBy: pair.by, ...(pair.similarity !== undefined ? { similarity: pair.similarity } : {}), status: moved ? (changed ? "moved-modified" : "moved") : changed ? "modified" : "unchanged" });
    }
    for (const i of match.removed) infos.push({ ...slideRef(a[i], i), status: "removed" });
    for (const j of match.added) infos.push({ ...slideRef(b[j], undefined, j), status: "added" });
    infos.sort((x, y) => (x.bIndex ?? Infinity) - (y.bIndex ?? Infinity) || (x.aIndex ?? 0) - (y.aIndex ?? 0));
    ctx.slides.push(...infos);
  }
  const withSlide = (fn: () => void, aIndex?: number, bIndex?: number) => {
    if (!isSlides) return fn();
    const saved = ctx.slide;
    ctx.slide = slideRef(bIndex !== undefined ? b[bIndex] : a[aIndex!], aIndex, bIndex);
    try { fn(); } finally { ctx.slide = saved; }
  };

  // 1. Removals, highest index first so earlier indexes stay valid.
  for (const i of [...match.removed].reverse()) ctx.patch.push({ op: "remove", path: pointer([...bPath, i]) });
  for (const i of match.removed) withSlide(() => record(ctx, { type: "removed", category: category([...aPath, i]), aPath: pointer([...aPath, i]), before: structuredClone(a[i]) }), i, undefined);

  // 2. Moves: only elements outside the longest in-order chain move, each placed after its predecessor.
  const order = match.pairs.slice().sort((x, y) => x.b - y.b);
  const current = match.pairs.map(pair => pair.a);
  order.forEach((pair, t) => {
    if (!match.moved.has(pair.a)) return;
    const from = current.indexOf(pair.a);
    current.splice(from, 1);
    const to = t === 0 ? 0 : current.indexOf(order[t - 1]!.a) + 1;
    current.splice(to, 0, pair.a);
    if (from !== to) ctx.patch.push({ op: "move", from: pointer([...bPath, from]), path: pointer([...bPath, to]) });
    withSlide(() => record(ctx, { type: "moved", category: category([...bPath, pair.b]), aPath: pointer([...aPath, pair.a]), bPath: pointer([...bPath, pair.b]) }), pair.a, pair.b);
  });

  // 3. Additions in ascending order: every earlier B element is already in place.
  for (const j of match.added) {
    ctx.patch.push({ op: "add", path: pointer([...bPath, j]), value: structuredClone(b[j]) });
    withSlide(() => record(ctx, { type: "added", category: category([...bPath, j]), bPath: pointer([...bPath, j]), after: structuredClone(b[j]) }), undefined, j);
  }

  // 4. Edits inside matched elements, addressed by their final position.
  for (const pair of order) {
    withSlide(() => diffValue(a[pair.a], b[pair.b], [...aPath, pair.a], [...bPath, pair.b], ctx), pair.a, pair.b);
  }
}

function summarise(changes: DiffChange[], slides: SlideMatchInfo[]): DiffSummary {
  const summary: DiffSummary = { total: changes.length, byCategory: {}, byType: {}, slides: { added: 0, removed: 0, moved: 0, modified: 0, unchanged: 0 } };
  for (const change of changes) {
    summary.byCategory[change.category] = (summary.byCategory[change.category] ?? 0) + 1;
    summary.byType[change.type] = (summary.byType[change.type] ?? 0) + 1;
  }
  for (const slide of slides) {
    if (slide.status === "added") summary.slides.added++;
    else if (slide.status === "removed") summary.slides.removed++;
    else if (slide.status === "unchanged") summary.slides.unchanged++;
    else {
      if (slide.status === "moved" || slide.status === "moved-modified") summary.slides.moved++;
      if (slide.status === "modified" || slide.status === "moved-modified") summary.slides.modified++;
    }
  }
  return summary;
}

/**
 * Diff two OPF documents. Slides are matched by `id`, then by identical
 * content, then by content similarity (`threshold`, default 0.5); the same
 * rule matches blocks, list items and every other array element. The result
 * lists categorised changes and a JSON Patch from `a` to `b`.
 */
export function diffPresentations(a: unknown, b: unknown, options: DiffOptions = {}): PresentationDiff {
  const ctx: Context = { options: { threshold: options.threshold ?? DEFAULT_MATCH_THRESHOLD }, changes: [], patch: [], slides: [] };
  diffValue(a, b, [], [], ctx);
  return { equal: ctx.patch.length === 0, changes: ctx.changes, patch: ctx.patch, slides: ctx.slides, summary: summarise(ctx.changes, ctx.slides) };
}

// ---------------------------------------------------------------------------
// Readable report

const CONTENT_KINDS = ["blocks", "chart", "table", "code", "metric", "quote", "timeline", "image", "video", "items", "bullets", "text"];
function shorten(text: string, max = 60) {
  const flat = text.replace(/\s+/gu, " ");
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
/** A short, single-line description of a value for reports. */
export function describeValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return JSON.stringify(shorten(value));
  if (value === null || typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
  const keys = Object.keys(value);
  const kind = CONTENT_KINDS.find(key => key in value);
  const record = value as Record<string, unknown>;
  if (kind) {
    const text = typeof record.text === "string" ? ` ${JSON.stringify(shorten(record.text, 40))}` : typeof record.title === "string" ? ` ${JSON.stringify(shorten(record.title, 40))}` : "";
    return `${kind}${text}`;
  }
  if (typeof record.id === "string") return `{id ${JSON.stringify(record.id)}}`;
  return `{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", …" : ""}}`;
}

function displayPath(pointerText: string | undefined, prefixLength = 0): string {
  if (pointerText === undefined) return "";
  const tokens = pointerText.split("/").slice(1).map(token => token.replaceAll("~1", "/").replaceAll("~0", "~")).slice(prefixLength);
  if (!tokens.length) return "(whole value)";
  return tokens.map((token, i) => (/^\d+$/u.test(token) ? `[${token}]` : /^[A-Za-z_$][\w$-]*$/u.test(token) ? (i ? `.${token}` : token) : `[${JSON.stringify(token)}]`)).join("");
}

function slideLabel(slide: DiffSlideRef, side: "a" | "b" = "b"): string {
  const index = side === "b" ? slide.bIndex ?? slide.aIndex : slide.aIndex ?? slide.bIndex;
  const parts = [`#${(index ?? 0) + 1}`];
  if (slide.title) parts.push(JSON.stringify(shorten(slide.title, 40)));
  if (slide.id) parts.push(`(id ${slide.id})`);
  return parts.join(" ");
}

function changeLine(change: DiffChange, prefixLength: number): string {
  switch (change.type) {
    case "added": return `+ ${displayPath(change.bPath, prefixLength)}  ${describeValue(change.after)}`.trimEnd();
    case "removed": return `- ${displayPath(change.aPath, prefixLength)}  ${describeValue(change.before)}`.trimEnd();
    case "moved": return `> ${displayPath(change.aPath, prefixLength)} -> ${displayPath(change.bPath, prefixLength)}`;
    default: return `~ ${displayPath(change.bPath, prefixLength)}  ${describeValue(change.before)} -> ${describeValue(change.after)}`;
  }
}

const SECTION_TITLES: Record<DiffCategory, string> = {
  metadata: "Metadata", design: "Design", variables: "Variables", narrative: "Narrative", assets: "Assets", catalogs: "Catalogs", extensions: "Extensions", slide: "Slides", block: "Slides", field: "Slides",
};

/** Render a diff as a plain-text report (no colour, stable ordering). */
export function formatDiffReport(diff: PresentationDiff): string {
  if (diff.equal) return "No differences.\n";
  const lines: string[] = [];
  const s = diff.summary.slides;
  const headline: string[] = [];
  const slideParts = ([[s.added, "added"], [s.removed, "removed"], [s.moved, "moved"], [s.modified, "modified"]] as Array<[number, string]>).filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  if (slideParts.length) headline.push(`slides: ${slideParts.join(", ")}`);
  for (const category of ["metadata", "design", "variables", "narrative", "assets", "catalogs", "extensions"] as const) {
    const count = diff.summary.byCategory[category];
    if (count) headline.push(`${category}: ${count}`);
  }
  lines.push(`${diff.summary.total} change${diff.summary.total === 1 ? "" : "s"} (${headline.join("; ")})`, "");

  for (const category of ["metadata", "design", "variables", "narrative", "assets", "catalogs", "extensions"] as const) {
    const section = diff.changes.filter(change => change.category === category);
    if (!section.length) continue;
    lines.push(SECTION_TITLES[category]);
    for (const change of section) lines.push(`  ${changeLine(change, 0)}`);
    lines.push("");
  }

  const slideChanges = diff.changes.filter(change => change.category === "slide" || change.category === "block" || change.category === "field" || (change.slide && change.category === "design"));
  if (slideChanges.length || diff.slides.some(slide => slide.status !== "unchanged")) {
    lines.push("Slides");
    const whole = (change: DiffChange) => change.category === "slide" && !!change.slide && (change.bPath ?? change.aPath)?.split("/").length === 3;
    for (const info of diff.slides) {
      if (info.status === "unchanged") continue;
      if (info.status === "added") { lines.push(`  + slide ${slideLabel(info)}`); continue; }
      if (info.status === "removed") { lines.push(`  - slide ${slideLabel(info, "a")}`); continue; }
      const moveNote = info.status === "moved" || info.status === "moved-modified" ? ` (moved from #${(info.aIndex ?? 0) + 1})` : "";
      lines.push(`  ~ slide ${slideLabel(info)}${moveNote}${info.matchedBy === "similar" ? " (matched by content)" : ""}`);
      const inner = slideChanges.filter(change => !whole(change) && change.slide && change.slide.bIndex === info.bIndex && change.slide.aIndex === info.aIndex);
      for (const change of inner) lines.push(`      ${changeLine(change, 2)}`);
    }
    // Changes to the slides array itself (for example a type change) that match no slide.
    for (const change of slideChanges) if (!change.slide) lines.push(`  ${changeLine(change, 0)}`);
    lines.push("");
  }
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}
