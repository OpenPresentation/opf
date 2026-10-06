/** Placeholder kinds that hold slide content (everything except the three heading kinds). */
export const LAYOUT_BODY_KINDS = ['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline'] as const;
export type LayoutBodyKind = typeof LAYOUT_BODY_KINDS[number];

/** What a layout record holds, derived from its placeholders. */
export interface LayoutContent {
  /** The most frequent body placeholder kind (a tie goes to the kind that appears first in placeholder order), or 'title' when the layout has no body placeholder. */
  kind: LayoutBodyKind | 'title';
  /** The number of body placeholders. */
  count: number;
  /** Which heading placeholders the layout has. */
  heading: { title: boolean; subtitle: boolean; tag: boolean };
}

const bodyKinds: ReadonlySet<string> = new Set(LAYOUT_BODY_KINDS);

/**
 * Derives what a layout holds from its `placeholders`, which are the single source of truth: the content kind,
 * the number of body regions and which headings it has are never stored on the record.
 */
export function layoutContent(record: { placeholders?: ReadonlyArray<{ type?: string } | null | undefined> } | null | undefined): LayoutContent {
  const heading = { title: false, subtitle: false, tag: false };
  const counts = new Map<LayoutBodyKind, number>();
  let count = 0;
  for (const placeholder of Array.isArray(record?.placeholders) ? record.placeholders : []) {
    const type: string | undefined = placeholder?.type;
    if (type === 'title' || type === 'subtitle' || type === 'tag') heading[type] = true;
    else if (typeof type === 'string' && bodyKinds.has(type)) {
      counts.set(type as LayoutBodyKind, (counts.get(type as LayoutBodyKind) ?? 0) + 1);
      count += 1;
    }
  }
  let kind: LayoutContent['kind'] = 'title', best = 0;
  // Map iteration follows first insertion, so a tie keeps the kind that appears first.
  for (const [candidate, total] of counts) if (total > best) { kind = candidate; best = total; }
  return { kind, count, heading };
}
