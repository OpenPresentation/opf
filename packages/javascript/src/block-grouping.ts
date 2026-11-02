/**
 * Group blocks before placing them (layout harvest LH-58, LH-82, LH-73, LH-46, LH-47). Pure: kinds, counts and text lengths,
 * no geometry. `composeSlide` runs it on a template slide's binding (`groupBinding`) and on the root blocks of an automatic
 * composition (`repeatedPairs`, `majorityKind`) before any cell is placed.
 *
 * 1. **Repeated pairs (LH-58).** A sequence that repeats one pair of kinds, a figure and a text (metric, chart, table, picture,
 *    video or code with a paragraph, in either order) or a long and a short paragraph (the long one at least twice the
 *    short one, on the same side of every pair), is k cells of two blocks, k >= 2.
 * 2. **Group by kind (LH-82, LH-73).** A flowing region whose blocks are mostly of a kind it accepts keeps only those; the
 *    blocks it took only as the overflow region go to another region that accepts them (the note of `metrics` and `chart`),
 *    beyond its `max`, else to the row below the grid. With no layout, interleaved blocks of two kinds with unequal counts
 *    are a grid of the majority kind above a row of the others.
 * 3. **Extra blocks join a fixed region (LH-46).** A block no region had room for, on a layout with no overflow region, joins
 *    the region that accepts it instead of the row below the grid: a `flow: none` region up to `JOINED_FIXED_MAX` blocks
 *    (accepted, no finding), a flowing region up to `MAX_REGION_BLOCKS` (beyond its `max`, still `layout-unplaced`). Fixed
 *    regions of one role side by side (the columns of `comparison`) become one region of N cells, with any block bound
 *    between theirs in source order; a lone fixed region arranges pictures as a mosaic and text as a lead plus cards.
 *
 * A slide that pins any block to a region keeps the binding as written.
 */
import { regionAccepts, regionRoleRank, type BoundBlock, type RegionBindingDiagnostic, type RegionBindingResult } from './bind-regions.js';
import { MAX_REGION_BLOCKS, type LayoutTemplate } from './layout-template.js';
import { areaRects } from './template-geometry.js';

/** LH-58: the kinds that pair with a paragraph as one cell. */
export const PAIR_FIGURE_KINDS: readonly string[] = ['metric', 'chart', 'table', 'image', 'video', 'code'];
/** LH-58: a pair of paragraphs is long + short when one is at least this many times the other's length. */
export const PAIR_LENGTH_RATIO = 2;
/** LH-46: a `flow: none` region takes at most this many blocks when extra blocks join it. */
export const JOINED_FIXED_MAX = 6;

/** A root block as grouping reads it: its kind, whether it is a content group and, for a paragraph, its length in characters. */
export interface GroupingNode { kind: string; group?: boolean; length?: number }

/**
 * How a region that grouping gave blocks arranges them: `mosaic` (pictures) or `lead` (a lead block over cards) for a fixed region
 * extra blocks joined (LH-46), `row` for a region that took the blocks of another kind out of a grid (LH-82: one row under it).
 */
export type JoinedArrangement = 'mosaic' | 'lead' | 'row';
/** LH-82: the blocks of another kind a region takes out of a grid are one row up to this many, else the region's own flow. */
export const MOVED_ROW_MAX = 4;

/**
 * LH-58: the number of pairs when `nodes` repeat one pair of kinds (2 or more pairs), else 0. `figure` is the position (0 or
 * 1) of the pair's figure: the non-text block, or the long paragraph of a long + short pair.
 */
export function repeatedPairs(nodes: readonly GroupingNode[]): { count: number; figure: 0 | 1 } | undefined {
  if (nodes.length < 4 || nodes.length % 2 || nodes.some(node => node.group)) return undefined;
  const first = nodes[0]!, second = nodes[1]!;
  if (!nodes.every((node, index) => node.kind === (index % 2 ? second : first).kind)) return undefined;
  const count = nodes.length / 2;
  if (first.kind !== second.kind) {
    const figure = first.kind === 'text' && PAIR_FIGURE_KINDS.includes(second.kind) ? 1 : second.kind === 'text' && PAIR_FIGURE_KINDS.includes(first.kind) ? 0 : undefined;
    return figure === undefined ? undefined : { count, figure };
  }
  if (first.kind !== 'text') return undefined;
  // Long + short paragraphs: the long one on the same side of every pair.
  const side = (a: number, b: number): 0 | 1 | undefined => a >= PAIR_LENGTH_RATIO * b ? 0 : b >= PAIR_LENGTH_RATIO * a ? 1 : undefined;
  const sides = Array.from({ length: count }, (_, pair) => side(nodes[2 * pair]!.length ?? 0, nodes[2 * pair + 1]!.length ?? 0));
  return sides[0] !== undefined && sides.every(entry => entry === sides[0]) ? { count, figure: sides[0] } : undefined;
}

/**
 * LH-82: interleaved blocks of two leaf kinds with unequal counts: the indexes of the majority kind (at least 2) and of the
 * others, or undefined when the blocks are already grouped (the majority all first or all last) or the counts are equal.
 */
export function majorityKind(nodes: readonly GroupingNode[]): { kind: string; majority: number[]; others: number[] } | undefined {
  if (nodes.length < 3 || nodes.some(node => node.group)) return undefined;
  const kinds = [...new Set(nodes.map(node => node.kind))];
  if (kinds.length !== 2) return undefined;
  const counts = kinds.map(kind => nodes.filter(node => node.kind === kind).length);
  if (counts[0] === counts[1]) return undefined;
  const kind = counts[0]! > counts[1]! ? kinds[0]! : kinds[1]!;
  const majority = nodes.flatMap((node, index) => node.kind === kind ? [index] : []), others = nodes.flatMap((node, index) => node.kind === kind ? [] : [index]);
  if (majority.length < 2) return undefined;
  const contiguous = majority.every((index, position) => index === majority[0]! + position);
  return contiguous ? undefined : { kind, majority, others };
}

/** The characters of a paragraph (a string or rich runs), for long + short pairs. */
export function textLength(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) return value.reduce<number>((sum, run) => sum + (typeof run === 'string' ? run.length : run && typeof run === 'object' && typeof (run as { text?: unknown }).text === 'string' ? (run as { text: string }).text.length : 0), 0);
  return 0;
}

type RootNode = BoundBlock & { value: Record<string, any> };

/** A grouping node of a root node of the binding. */
export function groupingNode(node: { kind: string; value: Record<string, any> }): GroupingNode {
  return { kind: node.kind, ...(node.kind === 'group' ? { group: true } : {}), ...(node.kind === 'text' ? { length: textLength(node.value.text ?? node.value.bullets) } : {}) };
}

/** A binding after grouping: what each region draws as units of one block or of a pair (two blocks in one cell). */
export interface GroupedBinding extends RegionBindingResult {
  /** Each region's units, in source order: one block, or the two blocks of a pair (LH-58). */
  units: Map<string, BoundBlock[][]>;
  /** The units of the implicit row below the grid. */
  belowUnits: BoundBlock[][];
  /** LH-46: the arrangement of a fixed region extra blocks joined. */
  arrangements: Map<string, JoinedArrangement>;
}

/** Run the grouping rules on a template slide's binding. `nodes` are the slide's root nodes (`rootNodes`). */
export function groupBinding(binding: RegionBindingResult, template: LayoutTemplate, nodes: readonly RootNode[], options: { join?: boolean } = {}): GroupedBinding {
  const units = new Map<string, BoundBlock[][]>(binding.regions.map(entry => [entry.name, [...entry.blocks, ...entry.overflow].map(block => [block])]));
  let below: BoundBlock[][] = binding.below.map(block => [block]);
  const arrangements = new Map<string, JoinedArrangement>();
  // Blocks still drawn beyond their region's room (`layout-unplaced`); a block grouping places within a region's rule leaves it.
  const unplaced = new Set<string>(binding.diagnostics.filter(entry => entry.code === 'layout-unplaced').map(entry => entry.path));
  const position = new Map(nodes.map((node, index) => [node.path, index]));
  const payloadOf = new Map(nodes.map(node => [node.path, node.value]));
  const byOrder = (a: BoundBlock[], b: BoundBlock[]) => position.get(a[0]!.path)! - position.get(b[0]!.path)!;
  const result = (): GroupedBinding => {
    const diagnostics: RegionBindingDiagnostic[] = binding.diagnostics.flatMap(entry => {
      if (entry.code !== 'layout-unplaced') return [entry];
      if (!unplaced.has(entry.path)) return [];
      // A block that joined a flowing region beyond its `max` is reported in that region.
      const region = [...units].find(([, list]) => list.some(unit => unit.some(block => block.path === entry.path)))?.[0];
      return [region === undefined || entry.region === region ? entry : { ...entry, region, message: `No region of the layout has room for this block; it is drawn in '${region}' beyond its ${template.regions.find(item => item.name === region)!.max} blocks. Paginate to move it to a continuation slide, choose another layout, or remove a block.` }];
    });
    return {
      regions: binding.regions.map(entry => {
        const blocks = (units.get(entry.name) ?? []).flat();
        return { name: entry.name, blocks: blocks.filter(block => !unplaced.has(block.path)), overflow: blocks.filter(block => unplaced.has(block.path)) };
      }),
      below: below.flat(), diagnostics, units, belowUnits: below, arrangements,
    };
  };
  if (nodes.some(node => node.block !== undefined && node.value.region !== undefined)) return result();
  const regionByName = new Map(template.regions.map((region, order) => [region.name, { region, order }]));
  // The region a block would bind to by kind, ignoring room: the lowest role rank, then reading order.
  const homeOf = (block: BoundBlock, except?: string) => template.regions
    .filter(region => region.name !== except && regionAccepts(region, payloadOf.get(block.path)))
    .sort((a, b) => regionRoleRank(a.role, block.kind) - regionRoleRank(b.role, block.kind) || regionByName.get(a.name)!.order - regionByName.get(b.name)!.order);

  // 1. LH-58: repeated pairs are one cell each, in the region their figure binds to.
  const pairs = repeatedPairs(nodes.map(groupingNode));
  if (pairs) {
    const figure = nodes[pairs.figure]!, target = homeOf(figure)[0];
    if (target && pairs.count <= Math.max(target.max, JOINED_FIXED_MAX)) {
      for (const list of units.values()) list.length = 0;
      below = [];
      unplaced.clear();
      const bound = (node: RootNode): BoundBlock => ({ path: node.path, kind: node.kind, ...(node.block !== undefined ? { block: node.block } : {}), ...(node.fields ? { fields: node.fields } : {}) });
      units.set(target.name, Array.from({ length: pairs.count }, (_, pair) => [bound(nodes[2 * pair]!), bound(nodes[2 * pair + 1]!)]));
      return result();
    }
  }

  // 2. LH-82, LH-73: a flowing region keeps the kinds it accepts when they are the majority of its blocks; the blocks it holds only
  // as the overflow region (within its room) move to another region that accepts them, else below the grid.
  const moved = new Set<string | undefined>();
  for (const region of template.regions) {
    if (region.flow === 'none') continue;
    const list = units.get(region.name)!;
    const foreign = list.filter(unit => !unplaced.has(unit[0]!.path) && !regionAccepts(region, payloadOf.get(unit[0]!.path)));
    const own = list.length - foreign.length;
    if (!foreign.length || own < 2 || own <= foreign.length) continue;
    for (const unit of foreign) {
      list.splice(list.indexOf(unit), 1);
      const target = homeOf(unit[0]!, region.name)[0];
      if (target) units.get(target.name)!.push(unit); else below.push(unit);
      moved.add(target?.name);
    }
  }
  // The region (or the row below) that took them sets them in one row under the grid, as Claude Design sets the notes of a metric
  // or chart grid, so the grid keeps most of the body; more than MOVED_ROW_MAX keep the region's flow.
  for (const name of moved) if (name !== undefined && units.get(name)!.length >= 2 && units.get(name)!.length <= MOVED_ROW_MAX) arrangements.set(name, 'row');

  // 3. LH-46, LH-47: a block that went below the grid joins the region that accepts it while that region has room for siblings.
  // `join: false` (composeSlide, when the joined cells overflow more) leaves them below the grid.
  if (options.join === false) { for (const list of units.values()) list.sort(byOrder); below.sort(byOrder); return result(); }
  const joined = new Set<string>();
  below = below.filter(unit => {
    const block = unit[0]!;
    if (!unplaced.has(block.path)) return true;
    const target = homeOf(block).find(region => units.get(region.name)!.length < (region.flow === 'none' ? JOINED_FIXED_MAX : MAX_REGION_BLOCKS));
    if (!target) return true;
    units.get(target.name)!.push(unit);
    // A fixed region takes it as a sibling; a flowing region draws it beyond its `max`, as the overflow region does.
    if (target.flow === 'none' || units.get(target.name)!.length <= target.max) unplaced.delete(block.path);
    joined.add(target.name);
    return false;
  });
  const rects = areaRects(template.grid);
  for (const name of joined) {
    const region = regionByName.get(name)!.region;
    if (region.flow !== 'none') continue;
    // Fixed regions of one role side by side (same rows) are one region of N cells: the first takes their blocks, and the blocks
    // bound elsewhere between them in source order, so the cells keep reading order; the others collapse into it.
    const rect = rects.get(name)!;
    const siblings = template.regions.filter(other => other.flow === 'none' && other.role === region.role && rects.get(other.name)?.row === rect.row && rects.get(other.name)?.rowSpan === rect.rowSpan);
    const lead = siblings[0]!;
    if (siblings.length > 1) {
      const members = siblings.flatMap(other => units.get(other.name)!);
      const first = Math.min(...members.map(unit => position.get(unit[0]!.path)!)), last = Math.max(...members.map(unit => position.get(unit[0]!.path)!));
      const between = template.regions.filter(other => !siblings.includes(other)).flatMap(other => units.get(other.name)!.filter(unit => { const at = position.get(unit[0]!.path)!; return at > first && at < last; }));
      const all = [...members, ...between];
      if (all.length > JOINED_FIXED_MAX || !all.every(unit => regionAccepts(lead, payloadOf.get(unit[0]!.path)))) continue;
      for (const other of template.regions) units.set(other.name, units.get(other.name)!.filter(unit => !all.includes(unit)));
      units.set(lead.name, all);
      for (const unit of all) unplaced.delete(unit[0]!.path);
      continue;
    }
    const list = units.get(name)!;
    if (list.length < 2) continue;
    const kinds = list.map(unit => unit[0]!.kind);
    if (kinds.every(kind => kind === 'image' || kind === 'video')) arrangements.set(name, 'mosaic');
    else if (kinds.every(kind => kind === 'text' || kind === 'quote' || kind === 'metric')) arrangements.set(name, 'lead');
  }
  for (const list of units.values()) list.sort(byOrder);
  below.sort(byOrder);
  return result();
}
