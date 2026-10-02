// Deterministic element matching shared by `diffPresentations` and
// `mergePresentations`. Given two arrays it decides which element of A is
// "the same" element as which element of B, in this order:
//
//   1. a shared string `id`,
//   2. deep equality (an order-preserving LCS first, then order-free),
//   3. content similarity for objects and arrays (greedy, best score first,
//      ties broken by index),
//   4. positional pairing of leftover primitives between matched neighbours.
//
// Matched pairs that are out of order are reported as moves, found with a
// longest increasing subsequence so a single relocation is a single move.

export type MatchedBy = "id" | "equal" | "similar" | "position";

export interface MatchPair {
  /** Index in A. */
  a: number;
  /** Index in B. */
  b: number;
  by: MatchedBy;
  /** Similarity score for `similar` pairs. */
  similarity?: number;
}

export interface ArrayMatch {
  /** Pairs sorted by `a`. */
  pairs: MatchPair[];
  /** A indexes with no counterpart, ascending. */
  removed: number[];
  /** B indexes with no counterpart, ascending. */
  added: number[];
  /** `a` indexes of pairs that are out of order relative to the longest order-preserving chain. */
  moved: Set<number>;
}

export interface MatchOptions {
  /** Minimum similarity (0..1) to treat two unequal elements as the same. Default 0.5. */
  threshold?: number;
}

export const DEFAULT_MATCH_THRESHOLD = 0.5;
/** Elements with different string ids must be at least this similar to match by content. */
const DIFFERENT_ID_THRESHOLD = 0.8;
const MAX_SIMILARITY_PAIRS = 250_000;
const MAX_LCS_CELLS = 4_000_000;

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isComposite = (value: unknown) => !!value && typeof value === "object";
export const idOf = (value: unknown): string | undefined => isObject(value) && typeof value.id === "string" && value.id !== "" ? value.id : undefined;

const canonCache = new WeakMap<object, string>();
/** Stable JSON text: member order does not matter. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  const cached = canonCache.get(value);
  if (cached !== undefined) return cached;
  const text = Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  canonCache.set(value, text);
  return text;
}

type Leaves = Map<string, string | number | boolean | null>;
const leafCache = new WeakMap<object, Leaves>();
function leaves(value: unknown): Leaves {
  if (!isComposite(value)) return new Map();
  const cached = leafCache.get(value as object);
  if (cached) return cached;
  const out: Leaves = new Map();
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) { for (const [i, item] of node.entries()) walk(item, `${path}/${i}`); }
    else if (node && typeof node === "object") for (const key of Object.keys(node)) walk((node as Record<string, unknown>)[key], `${path}/${key}`);
    else out.set(path, node as string | number | boolean | null);
  };
  walk(value, "");
  leafCache.set(value as object, out);
  return out;
}

const words = (text: string) => new Set(text.toLowerCase().split(/\s+/u).filter(Boolean));
function wordOverlap(a: string, b: string): number {
  const left = words(a), right = words(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

/** Content similarity in [0, 1]: matching scalar leaves at the same path, with partial credit for similar text. */
export function similarity(a: unknown, b: unknown): number {
  if (canonical(a) === canonical(b)) return 1;
  const left = leaves(a), right = leaves(b);
  const size = Math.max(left.size, right.size);
  if (!size) return 0;
  let score = 0;
  for (const [path, value] of left) {
    if (!right.has(path)) continue;
    const other = right.get(path);
    if (value === other) score += 1;
    else if (typeof value === "string" && typeof other === "string") score += 0.5 * wordOverlap(value, other);
  }
  return score / size;
}

/** Longest strictly increasing subsequence of `values` (indexes into `values`), deterministic. */
export function longestIncreasing(values: readonly number[]): number[] {
  const tails: number[] = [], previous: number[] = new Array(values.length).fill(-1);
  for (let i = 0; i < values.length; i++) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (values[tails[mid]!]! < values[i]!) lo = mid + 1; else hi = mid; }
    if (lo > 0) previous[i] = tails[lo - 1]!;
    tails[lo] = i;
  }
  const chain: number[] = [];
  for (let at = tails.length ? tails[tails.length - 1]! : -1; at >= 0; at = previous[at]!) chain.push(at);
  return chain.reverse();
}

function lcsPairs(keysA: string[], keysB: string[]): Array<[number, number]> {
  const n = keysA.length, m = keysB.length;
  if (!n || !m) return [];
  if (n * m > MAX_LCS_CELLS) {
    // Too large for a table: take the common prefix and suffix, leave the middle to the order-free pass.
    const pairs: Array<[number, number]> = [];
    let head = 0;
    while (head < n && head < m && keysA[head] === keysB[head]) { pairs.push([head, head]); head++; }
    let tail = 0;
    while (tail < n - head && tail < m - head && keysA[n - 1 - tail] === keysB[m - 1 - tail]) tail++;
    for (let k = tail; k > 0; k--) pairs.push([n - k, m - k]);
    return pairs;
  }
  const width = m + 1, table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] = keysA[i] === keysB[j] ? table[(i + 1) * width + j + 1]! + 1 : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }
  const pairs: Array<[number, number]> = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (keysA[i] === keysB[j]) { pairs.push([i, j]); i++; j++; }
    else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) i++;
    else j++;
  }
  return pairs;
}

/** Match the elements of two arrays. Pure and deterministic. */
export function matchArrays(a: readonly unknown[], b: readonly unknown[], options: MatchOptions = {}): ArrayMatch {
  const threshold = options.threshold ?? DEFAULT_MATCH_THRESHOLD;
  const matchA = new Array<number>(a.length).fill(-1), matchB = new Array<number>(b.length).fill(-1);
  const pairs: MatchPair[] = [];
  const link = (i: number, j: number, by: MatchedBy, score?: number) => {
    matchA[i] = j; matchB[j] = i;
    pairs.push(score === undefined ? { a: i, b: j, by } : { a: i, b: j, by, similarity: score });
  };
  const free = (side: number[]) => side.map((value, index) => (value < 0 ? index : -1)).filter(index => index >= 0);

  // 1. Shared ids, k-th occurrence to k-th occurrence.
  const idsB = new Map<string, number[]>();
  b.forEach((item, j) => { const id = idOf(item); if (id !== undefined) (idsB.get(id) ?? idsB.set(id, []).get(id)!).push(j); });
  const used = new Map<string, number>();
  a.forEach((item, i) => {
    const id = idOf(item); if (id === undefined) return;
    const list = idsB.get(id), at = used.get(id) ?? 0;
    if (list && at < list.length) { link(i, list[at]!, "id"); used.set(id, at + 1); }
  });

  // 2. Deep equality: order-preserving first, then anywhere.
  let freeA = free(matchA), freeB = free(matchB);
  const keysA = freeA.map(i => canonical(a[i])), keysB = freeB.map(j => canonical(b[j]));
  for (const [x, y] of lcsPairs(keysA, keysB)) link(freeA[x]!, freeB[y]!, "equal");
  freeA = free(matchA); freeB = free(matchB);
  const pool = new Map<string, number[]>();
  freeB.forEach(j => { const key = canonical(b[j]); (pool.get(key) ?? pool.set(key, []).get(key)!).push(j); });
  for (const i of freeA) {
    const list = pool.get(canonical(a[i]));
    if (list?.length) link(i, list.shift()!, "equal");
  }

  // 3. Similar composite elements, best score first.
  freeA = free(matchA).filter(i => isComposite(a[i])); freeB = free(matchB).filter(j => isComposite(b[j]));
  if (freeA.length && freeB.length && freeA.length * freeB.length <= MAX_SIMILARITY_PAIRS) {
    const scored: Array<{ i: number; j: number; score: number }> = [];
    for (const i of freeA) for (const j of freeB) {
      const idA = idOf(a[i]), idB = idOf(b[j]);
      const needed = idA !== undefined && idB !== undefined && idA !== idB ? Math.max(threshold, DIFFERENT_ID_THRESHOLD) : threshold;
      const score = similarity(a[i], b[j]);
      if (score >= needed && score > 0) scored.push({ i, j, score });
    }
    scored.sort((x, y) => y.score - x.score || x.i - y.i || x.j - y.j);
    for (const { i, j, score } of scored) if (matchA[i]! < 0 && matchB[j]! < 0) link(i, j, "similar", Math.round(score * 1000) / 1000);
  }

  // 4. Leftover primitives pair up by position between order-preserving neighbours.
  pairs.sort((x, y) => x.a - y.a);
  const chain = longestIncreasing(pairs.map(pair => pair.b)).map(index => pairs[index]!);
  const anchors: Array<[number, number]> = [[-1, -1], ...chain.map(pair => [pair.a, pair.b] as [number, number]), [a.length, b.length]];
  for (let k = 0; k + 1 < anchors.length; k++) {
    const [a0, b0] = anchors[k]!, [a1, b1] = anchors[k + 1]!;
    const gapA: number[] = [], gapB: number[] = [];
    for (let i = a0 + 1; i < a1; i++) if (matchA[i]! < 0 && !isComposite(a[i])) gapA.push(i);
    for (let j = b0 + 1; j < b1; j++) if (matchB[j]! < 0 && !isComposite(b[j])) gapB.push(j);
    for (let n = 0; n < Math.min(gapA.length, gapB.length); n++) link(gapA[n]!, gapB[n]!, "position");
  }

  pairs.sort((x, y) => x.a - y.a);
  const inChain = new Set(longestIncreasing(pairs.map(pair => pair.b)));
  const moved = new Set<number>();
  pairs.forEach((pair, index) => { if (!inChain.has(index)) moved.add(pair.a); });
  return { pairs, removed: free(matchA), added: free(matchB), moved };
}
