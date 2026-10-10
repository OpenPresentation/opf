import { layoutTemplate, type LayoutRegion, type LayoutTemplate, type RegionKind } from './layout-template.js';

/** A diagnostic of content binding, in the `LayoutDiagnostic` shape composition reports. */
export interface RegionBindingDiagnostic {
  /** `region-unknown`, `region-kind` or `region-full` for an ignored pin; `layout-unplaced` for a block drawn beyond every region's room. */
  code: 'region-unknown' | 'region-kind' | 'region-full' | 'layout-unplaced';
  path: string;
  message: string;
  /** The region the block was drawn in (`layout-unplaced`), or the pinned region (the pin codes). */
  region?: string;
}

/** One root node of the slide as binding sees it. */
export interface BoundBlock {
  /** OPF path of the node: `slides.N.blocks.I` for a block, `slides.N.<field>` for a root payload field. */
  path: string;
  /** Its content kind; a content group is `group`. */
  kind: RegionKind;
  /** The block's index in `blocks`; absent for a root payload. */
  block?: number;
  /** Root payload fields the node holds (a root payload only). */
  fields?: string[];
  /** The block named this region with `region` and the pin was honoured. */
  pinned?: boolean;
}

export interface RegionBinding {
  /** The region's name. */
  name: string;
  /** The blocks bound to the region within its `max`, in source order. */
  blocks: BoundBlock[];
  /** Blocks no region had room for, drawn here beyond `max` (the overflow region only). */
  overflow: BoundBlock[];
}

export interface RegionBindingResult {
  /** Every region of the template in reading order, with what it holds. */
  regions: RegionBinding[];
  /** Blocks drawn in an implicit row below the grid: the layout has no overflow region. */
  below: BoundBlock[];
  diagnostics: RegionBindingDiagnostic[];
}

export interface BindRegionsOptions {
  /** Index used in the reported paths; defaults to 0. */
  slideIndex?: number;
}

const FIELDS = ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline'] as const;
const FIELD_KINDS: Readonly<Record<string, RegionKind>> = { text: 'text', bullets: 'text', items: 'list', image: 'image', video: 'video', chart: 'chart', table: 'table', code: 'code', metric: 'metric', quote: 'quote', timeline: 'timeline' };
const IMAGE_EDGES = ['left', 'right', 'top', 'bottom'];
/** The promoted-region keys of a slide (`left`, `top:left`, `middle+bottom:center+right`, ...). */
export const PROMOTED_REGION_KEY = /^(top|middle|bottom)(\+(top|middle|bottom))*(:(left|center|right)(\+(left|center|right))*)?$|^(left|center|right)(\+(left|center|right))*$/;
const record = (value: unknown): Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const empty = (value: unknown) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

/** The content kind of a block: `group` for a content group, else its `type` or the kind of its first payload field. */
export function blockKind(block: unknown): RegionKind {
  const value = record(block);
  if (Array.isArray(value.blocks)) return 'group';
  if (typeof value.type === 'string' && value.type !== 'group' && Object.values(FIELD_KINDS).includes(value.type as RegionKind)) return value.type as RegionKind;
  const field = FIELDS.find(name => value[name] !== undefined);
  return field ? FIELD_KINDS[field]! : 'text';
}

/** The leaf kinds of a content group, recursively. */
function leafKinds(block: Record<string, any>, into = new Set<RegionKind>(), depth = 0): Set<RegionKind> {
  if (depth > 32) return into;
  for (const child of Array.isArray(block.blocks) ? block.blocks : []) {
    const value = record(child);
    if (Array.isArray(value.blocks)) leafKinds(value, into, depth + 1);
    else into.add(blockKind(value));
  }
  return into;
}

/** Whether a region takes a block: its kind is accepted, or a group whose every leaf kind is accepted. */
export function regionAccepts(region: { readonly accepts: readonly string[] }, block: unknown): boolean {
  const kind = blockKind(block);
  if (region.accepts.includes(kind)) return true;
  if (kind !== 'group') return false;
  const kinds = leafKinds(record(block));
  return kinds.size > 0 && [...kinds].every(leaf => region.accepts.includes(leaf));
}

/**
 * The top-level image blocks that take a band of their own (`placement`): the first on each edge. They never occupy a
 * region. Composition places exactly these.
 */
export function placedImageBlocks(slide: unknown): Set<number> {
  const value = record(slide);
  const placed = new Set<number>();
  if (!Array.isArray(value.blocks) || Object.keys(value).some(key => PROMOTED_REGION_KEY.test(key))) return placed;
  const used = new Set<string>();
  value.blocks.forEach((block: unknown, index: number) => {
    const host = record(block);
    if (Array.isArray(host.blocks) || host.image === undefined || host.placement === undefined) return;
    const edge = record(host.placement).edge;
    if (!IMAGE_EDGES.includes(edge) || used.has(edge)) return;
    used.add(edge);
    placed.add(index);
  });
  return placed;
}

/**
 * The slide's root nodes in source order, as content binding reads them: each block of `blocks` that is not a placed
 * image (a content group is one node of kind `group`), or the fields of a root payload (`bullets` with `text` are one node).
 * Empty payloads draw nothing and are not nodes.
 */
export function rootNodes(slide: unknown, slideIndex = 0): (BoundBlock & { value: Record<string, any> })[] {
  const value = record(slide), base = `slides.${slideIndex}`;
  if (Array.isArray(value.blocks)) {
    const placed = placedImageBlocks(value);
    return value.blocks.flatMap((block: unknown, index: number) => {
      const host = record(block);
      if (placed.has(index)) return [];
      if (!Array.isArray(host.blocks) && FIELDS.every(field => empty(host[field]))) return [];
      if (Array.isArray(host.blocks) && !host.blocks.length) return [];
      return [{ path: `${base}.blocks.${index}`, kind: blockKind(host), block: index, value: host }];
    });
  }
  const nodes: (BoundBlock & { value: Record<string, any> })[] = [];
  for (const field of FIELDS) {
    if (empty(value[field]) || field === 'bullets' && !empty(value.text)) continue;
    const fields = field === 'text' && !empty(value.bullets) ? ['text', 'bullets'] : [field];
    nodes.push({ path: `${base}.${field}`, kind: FIELD_KINDS[field]!, fields, value: Object.fromEntries(fields.map(name => [name, value[name]])) });
  }
  return nodes;
}

/** Role rank of a region for a block kind (content binding, step 2): pictures prefer media regions, everything else primary ones. */
export function regionRoleRank(role: LayoutRegion['role'], kind: RegionKind): number {
  const media = kind === 'image' || kind === 'video';
  return media ? { media: 0, primary: 1, secondary: 2, supporting: 3 }[role] : { primary: 0, secondary: 1, supporting: 2, media: 3 }[role];
}

/**
 * Bind a slide's content to the regions of a template layout (OPF 0.19, design section 3). Pure: no geometry.
 *
 * 1. **Pins.** A block with `region: "<name>"` goes to that region, in source order, when the region exists, accepts the
 *    block's kind and has room; otherwise the pin is ignored with `region-unknown`, `region-kind` or `region-full` and the
 *    block joins step 2.
 * 2. **Everything else, in source order.** Of the regions that accept the block and have room, the block goes to the one
 *    with the lowest role rank (`regionRoleRank`), then the first in reading order.
 * 3. **No candidate.** The block goes to the overflow region whatever its `accepts` while it has room; beyond that it is
 *    drawn there anyway (`layout-unplaced`, which `paginate` resolves with a continuation slide). A layout with no overflow
 *    region draws it in an implicit row below the grid (`layout-unplaced` too).
 *
 * A slide with promoted regions (`left`, `top:left`, ...) composes them as in 0.18 and binds nothing.
 */
export function bindRegions(slide: unknown, layout: unknown, options: BindRegionsOptions = {}): RegionBindingResult {
  const template: LayoutTemplate = layoutTemplate(layout);
  const value = record(slide), index = options.slideIndex ?? 0;
  const regions: RegionBinding[] = template.regions.map(region => ({ name: region.name, blocks: [], overflow: [] }));
  const result: RegionBindingResult = { regions, below: [], diagnostics: [] };
  if (Object.keys(value).some(key => PROMOTED_REGION_KEY.test(key))) return result;
  const byName = new Map(template.regions.map((region, order) => [region.name, { region, binding: regions[order]!, order }]));
  const room = (name: string) => { const entry = byName.get(name)!; return entry.binding.blocks.length < entry.region.max; };
  const nodes = rootNodes(value, index);
  const rest: typeof nodes = [];
  for (const node of nodes) {
    const pin = node.block !== undefined ? node.value.region : undefined;
    if (typeof pin !== 'string') { rest.push(node); continue; }
    const target = byName.get(pin), pinPath = `${node.path}.region`;
    if (!target) result.diagnostics.push({ code: 'region-unknown', path: pinPath, region: pin, message: `The layout has no region '${pin}'; the block is placed by its kind instead.` });
    else if (!regionAccepts(target.region, node.value)) result.diagnostics.push({ code: 'region-kind', path: pinPath, region: pin, message: `Region '${pin}' does not accept ${node.kind} content (it accepts ${target.region.accepts.join(', ')}); the block is placed by its kind instead.` });
    else if (!room(pin)) result.diagnostics.push({ code: 'region-full', path: pinPath, region: pin, message: `Region '${pin}' already holds its ${target.region.max} block${target.region.max === 1 ? '' : 's'}; the block is placed by its kind instead.` });
    else { target.binding.blocks.push({ path: node.path, kind: node.kind, block: node.block!, pinned: true }); continue; }
    rest.push(node);
  }
  const overflowName = template.overflowRegion;
  for (const node of rest) {
    const bound: BoundBlock = { path: node.path, kind: node.kind, ...(node.block !== undefined ? { block: node.block } : {}), ...(node.fields ? { fields: node.fields } : {}) };
    let best: { rank: number; order: number; name: string } | undefined;
    for (const [name, entry] of byName) {
      if (!regionAccepts(entry.region, node.value) || !room(name)) continue;
      const rank = regionRoleRank(entry.region.role, node.kind);
      if (!best || rank < best.rank || rank === best.rank && entry.order < best.order) best = { rank, order: entry.order, name };
    }
    if (best) { byName.get(best.name)!.binding.blocks.push(bound); continue; }
    if (overflowName === undefined) {
      result.below.push(bound);
      result.diagnostics.push({ code: 'layout-unplaced', path: node.path, message: 'No region of the layout takes this block; it is drawn below the layout\'s grid. Choose another layout, pin it to a region, or paginate.' });
      continue;
    }
    const overflow = byName.get(overflowName)!;
    if (room(overflowName)) { overflow.binding.blocks.push(bound); continue; }
    overflow.binding.overflow.push(bound);
    result.diagnostics.push({ code: 'layout-unplaced', path: node.path, region: overflowName, message: `No region of the layout has room for this block; it is drawn in '${overflowName}' beyond its ${overflow.region.max} block${overflow.region.max === 1 ? '' : 's'}. Paginate to move it to a continuation slide, choose another layout, or remove a block.` });
  }
  // Within a region, blocks keep source order whatever step bound them.
  const order = new Map(nodes.map((node, position) => [node.path, position]));
  for (const binding of regions) binding.blocks.sort((a, b) => order.get(a.path)! - order.get(b.path)!);
  return result;
}
