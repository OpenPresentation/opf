import { isLayoutTemplate, layoutRegion } from './layout-template.js';

/** Placeholder kinds that hold slide content (everything except the three heading kinds). */
export const LAYOUT_BODY_KINDS = ['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline'] as const;
export type LayoutBodyKind = typeof LAYOUT_BODY_KINDS[number];

/** FA-26: how deeply placeholder groups may nest inside one layout record (a top-level group is level 1). */
export const MAX_PLACEHOLDER_GROUP_DEPTH = 3;

/** What a layout record holds, derived from its placeholders. */
export interface LayoutContent {
  /** The most frequent body placeholder kind (a tie goes to the kind that appears first in reading order), or 'title' when the layout has no body placeholder. */
  kind: LayoutBodyKind | 'title';
  /** The number of body placeholders: the leaf regions, inside placeholder groups too. */
  count: number;
  /** Which heading placeholders the layout has. */
  heading: { title: boolean; subtitle: boolean; tag: boolean };
}

/** One leaf region of a layout record, in reading order (depth first, in array order). */
export interface LayoutLeaf {
  /** The region's content kind (a heading kind only at the top level). */
  type: string;
  /** Where the region is written: `layout.placeholders.1`, or `layout.placeholders.1.placeholders.0` inside a group. */
  path: string;
  /** 0 for a top-level region, else the level of the placeholder group that holds it (1 to 3). */
  depth: number;
  /** The raw placeholder entry. */
  placeholder: Record<string, unknown>;
}

/** A placeholder entry of a layout record, as composition reads it: a region, or a group of entries. */
export interface LayoutSlot {
  type: string;
  path: string;
  depth: number;
  placeholder: Record<string, unknown>;
  /** Present on a placeholder group: its entries, in reading order. */
  children?: LayoutSlot[];
}

const bodyKinds: ReadonlySet<string> = new Set(LAYOUT_BODY_KINDS);
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Whether a placeholder entry is a placeholder group (`{ type: "group", composition, placeholders }`). */
export function isPlaceholderGroup(placeholder: unknown): placeholder is { type: 'group'; composition?: Record<string, unknown>; placeholders: unknown[] } {
  return record(placeholder).type === 'group';
}

/**
 * The placeholder tree of a layout record: every entry with its path and depth, groups with their children.
 * Throws a RangeError for a record composition cannot use: a group without placeholders, a heading inside a group, or
 * groups nested deeper than MAX_PLACEHOLDER_GROUP_DEPTH. Validation reports the same cases as schema errors first.
 */
export function layoutSlots(layout: { placeholders?: unknown } | null | undefined, base = 'layout.placeholders'): LayoutSlot[] {
  const walk = (entries: unknown, path: string, depth: number): LayoutSlot[] => (Array.isArray(entries) ? entries : []).map((entry, index) => {
    const placeholder = record(entry), slotPath = `${path}.${index}`;
    const type = typeof placeholder.type === 'string' ? placeholder.type : '';
    if (type !== 'group') {
      if (depth > 0 && !bodyKinds.has(type)) throw new RangeError(`${slotPath}: a placeholder group holds body regions only, not '${type}'.`);
      return { type, path: slotPath, depth, placeholder };
    }
    if (depth >= MAX_PLACEHOLDER_GROUP_DEPTH) throw new RangeError(`${slotPath}: placeholder groups nest at most ${MAX_PLACEHOLDER_GROUP_DEPTH} levels inside a layout record.`);
    if (!Array.isArray(placeholder.placeholders) || !placeholder.placeholders.length) throw new RangeError(`${slotPath}: a placeholder group needs at least one placeholder.`);
    return { type, path: slotPath, depth, placeholder, children: walk(placeholder.placeholders, `${slotPath}.placeholders`, depth + 1) };
  });
  return walk(layout?.placeholders, base, 0);
}

/** The leaf regions of a layout record in reading order, the order slide content fills them (FA-26). Groups are flattened. */
export function layoutLeaves(layout: { placeholders?: unknown } | null | undefined): LayoutLeaf[] {
  const leaves: LayoutLeaf[] = [];
  const visit = (slots: LayoutSlot[]) => { for (const slot of slots) slot.children ? visit(slot.children) : leaves.push({ type: slot.type, path: slot.path, depth: slot.depth, placeholder: slot.placeholder }); };
  visit(layoutSlots(layout));
  return leaves;
}

/**
 * A one-line summary of a record's placeholders in reading order, each group with its mode and its entries in parentheses:
 * `title, column (text, text), chart`. Pickers and catalog pages show it where a flat list of kinds would hide the structure.
 */
export function layoutStructure(layout: { placeholders?: unknown } | null | undefined): string {
  // OPF 0.19: a template reads as its areas in reading order, each region with its flow and accepted kinds:
  // `title, chart (none: chart), notes (column: text, list, metric, quote, chart)`.
  if (isLayoutTemplate(layout)) return templateAreas(layout).map(entry => entry.region ? `${entry.name} (${entry.region.flow}: ${entry.region.accepts.join(', ')})` : entry.name).join(', ');
  const describe = (slots: LayoutSlot[]): string => slots.map(slot => {
    if (!slot.children) return slot.type;
    const mode = record(slot.placeholder.composition).mode;
    return `${typeof mode === 'string' && mode !== 'auto' ? mode : 'group'} (${describe(slot.children)})`;
  }).join(', ');
  return describe(layoutSlots(layout));
}

/** Whether a layout record holds at least one placeholder group. */
export function hasPlaceholderGroups(layout: { placeholders?: unknown } | null | undefined): boolean {
  return Array.isArray(layout?.placeholders) && layout.placeholders.some(isPlaceholderGroup);
}

/**
 * Derives what a layout holds from its `placeholders`, which are the single source of truth: the content kind,
 * the number of body regions and which headings it has are never stored on the record. Placeholder groups count
 * through their leaves.
 */
export function layoutContent(layout: { placeholders?: ReadonlyArray<unknown> } | null | undefined): LayoutContent {
  // OPF 0.19: a template's content is its regions: `count` is the number of body regions, `kind` the first kind the first
  // primary region accepts (else the first region's), and a title area holds the tag, title and subtitle.
  if (isLayoutTemplate(layout)) {
    const areas = templateAreas(layout), regions = areas.flatMap(entry => entry.region ? [entry.region] : []);
    const lead = regions.find(region => region.role === 'primary') ?? regions[0];
    const leadKind = lead?.accepts.find(kind => kind !== 'group');
    const title = areas.some(entry => entry.name === 'title');
    return { kind: leadKind ?? 'title', count: regions.length, heading: { title, subtitle: title || areas.some(entry => entry.name === 'subtitle'), tag: title } };
  }
  const heading = { title: false, subtitle: false, tag: false };
  const counts = new Map<LayoutBodyKind, number>();
  let count = 0;
  const visit = (entries: ReadonlyArray<unknown> | undefined, depth: number) => {
    for (const entry of Array.isArray(entries) ? entries : []) {
      const type: unknown = record(entry).type;
      if (type === 'group') { if (depth < MAX_PLACEHOLDER_GROUP_DEPTH) visit(record(entry).placeholders as unknown[], depth + 1); continue; }
      if (type === 'title' || type === 'subtitle' || type === 'tag') { if (depth === 0) heading[type] = true; }
      else if (typeof type === 'string' && bodyKinds.has(type)) {
        counts.set(type as LayoutBodyKind, (counts.get(type as LayoutBodyKind) ?? 0) + 1);
        count += 1;
      }
    }
  };
  visit(layout?.placeholders, 0);
  let kind: LayoutContent['kind'] = 'title', best = 0;
  // Map iteration follows first insertion, so a tie keeps the kind that appears first.
  for (const [candidate, total] of counts) if (total > best) { kind = candidate; best = total; }
  return { kind, count, heading };
}

/** The named areas of a template in reading order, with the region of each body area. Tolerates an invalid template. */
function templateAreas(layout: unknown): { name: string; region?: ReturnType<typeof layoutRegion> }[] {
  const value = record(layout), regions = record(value.regions);
  const rows = Array.isArray(value.areas) ? value.areas.filter((row): row is string => typeof row === 'string') : [];
  const seen = new Set<string>(), out: { name: string; region?: ReturnType<typeof layoutRegion> }[] = [];
  for (const row of rows) for (const name of row.trim().split(/\s+/)) {
    if (!name || name === '.' || seen.has(name)) continue;
    seen.add(name);
    out.push(name === 'title' || name === 'subtitle' || !Object.hasOwn(regions, name) ? { name } : { name, region: layoutRegion(name, regions[name]) });
  }
  return out;
}
