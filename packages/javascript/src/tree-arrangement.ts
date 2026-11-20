/** SH-21: list-entry levels are a single-root tree's zero-based parent depth. Preserve source order and never infer a missing parent. */
/** `assistant`: the entry is its parent's assistant (`assistant: true`), which only an org chart places, beside the line to the reports. */
export interface ArrangementTreeNode { index: number; level: number; parent?: number; children: number[]; assistant?: true }
export type ArrangementTreeResult = { ok: true; nodes: ArrangementTreeNode[] } | { ok: false; reason: string; index?: number };
/** Build a semantic tree without changing any authored entry. A caller must retain/refuse an invalid source rather than reparent it. */
export function arrangementTree(entries: readonly unknown[]): ArrangementTreeResult {
  if (!entries.length) return { ok: false, reason: 'A tree needs one root entry.' };
  const nodes: ArrangementTreeNode[] = [], ancestors: number[] = [];
  for (const [index, entry] of entries.entries()) {
    const object = entry !== null && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : undefined;
    const explicit = object?.level, level = explicit === undefined ? 0 : explicit, assistant = object?.assistant === true;
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 0) return { ok: false, index, reason: 'A tree entry needs a nonnegative integer level.' };
    if (index === 0 && level !== 0) return { ok: false, index, reason: 'The first tree entry is its level-zero root.' };
    if (index > 0 && level === 0) return { ok: false, index, reason: 'This tree has more than one root; forests need a reported fallback.' };
    if (level > ancestors.length) return { ok: false, index, reason: 'The entry skips a parent level; depth may grow by only one level at a time.' };
    if (index === 0 && assistant) return { ok: false, index, reason: 'The root cannot be an assistant.' };
    const parent = level === 0 ? undefined : ancestors[level - 1];
    if (parent !== undefined && nodes[parent]?.assistant) return { ok: false, index, reason: 'An assistant has no reports.' };
    const node: ArrangementTreeNode = { index, level, ...(parent === undefined ? {} : { parent }), children: [], ...(assistant ? { assistant: true as const } : {}) };
    nodes.push(node);
    if (parent !== undefined) {
      const ancestor = nodes[parent];
      if (!ancestor) return { ok: false, index, reason: 'The entry has no existing parent at its authored level.' };
      ancestor.children.push(index);
    }
    ancestors.length = level;
    ancestors.push(index);
  }
  return { ok: true, nodes };
}
