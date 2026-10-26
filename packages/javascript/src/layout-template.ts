/**
 * OPF layout templates (`opf-layout/v2`, FA-33): a layout record is one ordered list of regions, nested for two
 * dimensions. `direction` says whether the record's `regions` are placed side by side (`row`) or stacked (`column`); an
 * entry is a region (`name`, `size`, the content rules) or a split (`direction`, `regions`, `size`) that lays its own
 * regions out the other way. The list is the reading order. This module parses and checks a record and compiles the tree
 * into the grid the engine composes with (rows, columns, a cell grid of area names and the region rules); binding content
 * to regions is `bindRegions` (bind-regions.ts) and the geometry is `composeSlide`.
 *
 * A record is a template when it has `regions`.
 */

/** The content kinds a region can accept: the body content kinds and `group` for a content group. */
export const REGION_KINDS = ['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'group'] as const;
export type RegionKind = typeof REGION_KINDS[number];
/** Which content a region wants first (content binding, step 2). */
export const REGION_ROLES = ['primary', 'secondary', 'media', 'supporting'] as const;
export type RegionRole = typeof REGION_ROLES[number];
/** How several blocks share a region. */
export const REGION_FLOWS = ['none', 'grid', 'column', 'auto'] as const;
export type RegionFlow = typeof REGION_FLOWS[number];
export const REGION_ANCHORS = ['top', 'middle', 'bottom'] as const;
export type RegionAnchor = typeof REGION_ANCHORS[number];
/** The two heading regions. They hold the slide's headings, take only a `size`, and have no content rules. */
export const HEADING_AREAS = ['title', 'subtitle'] as const;
/**
 * Names a body region may not take: the heading words, `auto`, and the six promoted-region words, so `region=` in the
 * Markdown dialect stays unambiguous. `title` and `subtitle` name the heading regions.
 */
export const RESERVED_REGION_NAMES = ['title', 'subtitle', 'tag', 'auto', 'left', 'center', 'right', 'top', 'middle', 'bottom'] as const;
/** The compiled grid has at most this many rows and this many columns. */
export const MAX_TEMPLATE_TRACKS = 12;
/** A list of regions (the record's, or a split's) holds at most this many entries. */
export const MAX_REGION_ENTRIES = 12;
/** Region lists nest at most this deep: the record's own list is level 1, a split's list level 2, a split inside it level 3. */
export const MAX_REGION_DEPTH = 3;
/** A region holds at most this many blocks on one slide. */
export const MAX_REGION_BLOCKS = 12;
/** The layout id no catalog may define: `layout: "auto"` is automatic composition. */
export const AUTO_LAYOUT = 'auto';

/** One region of a template with every default applied (an inherited `anchor` included). */
export interface LayoutRegion {
  name: string;
  accepts: RegionKind[];
  role: RegionRole;
  flow: RegionFlow;
  /** Blocks the region holds on one slide (1 for `flow: "none"`, else 6 unless set). */
  max: number;
  bleed: boolean;
  listColumns: 'auto' | 1;
  anchor: RegionAnchor;
  empty: 'collapse' | 'keep';
}

/** One named area of the compiled grid: its top-left cell and its span, in logical (left-to-right) columns. */
export interface LayoutArea {
  name: string;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  /** `title` or `subtitle`. */
  heading: boolean;
}

/** A parsed, checked and compiled template. */
export interface LayoutTemplate {
  /** Row track sizes: relative numbers, or `auto` for the height the row's content needs. */
  rows: (number | 'auto')[];
  /** Column track sizes, relative. */
  columns: number[];
  /** The cell grid: `grid[row][column]` is an area name. */
  grid: string[][];
  /** Every area, headings included, in reading order (the order of the record's region list, depth first). */
  areas: LayoutArea[];
  /** The body regions in reading order, with defaults applied. */
  regions: LayoutRegion[];
  /**
   * Where content no region accepts goes: `overflowRegion`, else the first primary region whose flow is not `none`.
   * Absent when the record names none and has no such region (the slide then draws it in an implicit row below the grid).
   */
  overflowRegion?: string;
  /** Whether the template has a `title` region and a `subtitle` region. */
  title: boolean;
  subtitle: boolean;
  /**
   * The record's `anchor` when it places the whole stack: the record is a column whose entries are all sized `auto` and its
   * `anchor` is `middle` or `bottom`. The stack, headings included, then sits in the content box's leftover height. Absent
   * otherwise (including `top`, where the stack starts at the top as it always did).
   */
  stack?: 'middle' | 'bottom';
}

/** A problem with a template: `layout-template` for the tree itself, `layout-region` for the regions. */
export interface LayoutTemplateIssue {
  code: 'layout-template' | 'layout-region';
  /** JSON Pointer inside the record (`/regions/1/regions/0/size`). */
  path: string;
  message: string;
}

/** Thrown by `layoutTemplate` (and so by `composeSlide`) for a record with a `layout-template` or `layout-region` finding. */
export class OPFLayoutTemplateError extends RangeError {
  readonly code = 'layout-template';
  constructor(public readonly issues: LayoutTemplateIssue[]) {
    super(`The layout template is invalid: ${issues.map(issue => `${issue.path || '/'}: ${issue.message}`).join('; ')}`);
    this.name = 'OPFLayoutTemplateError';
  }
}

const NAME = /^[a-z][a-z0-9-]*$/;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const reserved: ReadonlySet<string> = new Set(RESERVED_REGION_NAMES);
const headingNames: ReadonlySet<string> = new Set(HEADING_AREAS);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const validSize = (value: unknown): value is number | 'auto' => value === 'auto' || (positive(value) && value <= 100);
const EPSILON = 1e-9;

/** Whether a layout record is a template (it has a `regions` list). */
export function isLayoutTemplate(layout: unknown): boolean {
  return Object.hasOwn(record(layout), 'regions');
}

/** The region of `name` with every default applied; `value` is its entry in a `regions` list, `inherited` the `anchor` of the record or split it sits in. */
export function layoutRegion(name: string, value: unknown, inherited?: RegionAnchor): LayoutRegion {
  const entry = record(value);
  // No `accepts` means every body content kind and `group`.
  const accepts = Array.isArray(entry.accepts) ? [...new Set(entry.accepts.filter((kind): kind is RegionKind => (REGION_KINDS as readonly unknown[]).includes(kind)))] : [...REGION_KINDS];
  const flow = (REGION_FLOWS as readonly unknown[]).includes(entry.flow) ? entry.flow as RegionFlow : 'auto';
  const max = Number.isInteger(entry.max) && (entry.max as number) >= 1 && (entry.max as number) <= MAX_REGION_BLOCKS ? entry.max as number : flow === 'none' ? 1 : 6;
  return {
    name,
    accepts,
    role: (REGION_ROLES as readonly unknown[]).includes(entry.role) ? entry.role as RegionRole : 'primary',
    flow,
    max,
    bleed: entry.bleed === true,
    listColumns: entry.listColumns === 'auto' ? 'auto' : 1,
    anchor: (REGION_ANCHORS as readonly unknown[]).includes(entry.anchor) ? entry.anchor as RegionAnchor : inherited ?? 'top',
    empty: entry.empty === 'keep' ? 'keep' : 'collapse',
  };
}

const anchorOf = (value: unknown): RegionAnchor | undefined => (REGION_ANCHORS as readonly unknown[]).includes(value) ? value as RegionAnchor : undefined;
const isSplitEntry = (entry: Record<string, unknown>) => entry.name === undefined && (entry.regions !== undefined || entry.direction !== undefined);

/** A region of the record in reading order, as `layoutEntries` lists it. */
export interface LayoutEntry {
  name: string;
  /** `title` or `subtitle`. */
  heading: boolean;
  /** The body region with its defaults and inherited `anchor` applied; absent for a heading. */
  region?: LayoutRegion;
}

/**
 * The regions of a record in reading order, read without checking the record (a tolerant walk for tools that describe a
 * record): headings and body regions with their rules, `anchor` inherited from the record and its splits.
 */
export function layoutEntries(layout: unknown): LayoutEntry[] {
  const value = record(layout), out: LayoutEntry[] = [], seen = new Set<string>();
  const walk = (list: unknown, inherited: RegionAnchor | undefined, depth: number) => {
    if (!Array.isArray(list) || depth > MAX_REGION_DEPTH) return;
    for (const raw of list) {
      const entry = record(raw);
      if (typeof entry.name === 'string') {
        if (seen.has(entry.name)) continue;
        seen.add(entry.name);
        out.push(headingNames.has(entry.name) ? { name: entry.name, heading: true } : { name: entry.name, heading: false, region: layoutRegion(entry.name, entry, inherited) });
      } else if (isSplitEntry(entry)) walk(entry.regions, anchorOf(entry.anchor) ?? inherited, depth + 1);
    }
  };
  walk(value.regions, anchorOf(value.anchor), 1);
  return out;
}

/** The record with `rules` merged into every body region entry (a copy; the record is not changed). */
export function withRegionRules(layout: unknown, rules: Record<string, unknown>): Record<string, unknown> {
  const rewrite = (list: unknown): unknown => Array.isArray(list) ? list.map(raw => {
    const entry = record(raw);
    if (typeof entry.name === 'string') return headingNames.has(entry.name) ? entry : { ...entry, ...rules };
    return isSplitEntry(entry) ? { ...entry, regions: rewrite(entry.regions) } : raw;
  }) : list;
  const value = record(layout);
  return { ...value, regions: rewrite(value.regions) };
}

/** The tree of a checked record: leaves are regions and headings, inner nodes are splits. */
type Node = { kind: 'leaf'; name: string; size: number | 'auto' } | { kind: 'split'; direction: 'row' | 'column'; size: number | 'auto'; children: Node[] };

interface Parsed { template?: LayoutTemplate; issues: LayoutTemplateIssue[] }

function parse(layout: unknown): Parsed {
  const value = record(layout);
  const issues: LayoutTemplateIssue[] = [];
  const add = (code: LayoutTemplateIssue['code'], path: string, message: string) => issues.push({ code, path, message });
  const regions: LayoutRegion[] = [];
  const names = new Set<string>();

  const directionOf = (path: string, raw: unknown, fallback: 'row' | 'column'): 'row' | 'column' => {
    if (raw === undefined) return fallback;
    if (raw === 'row' || raw === 'column') return raw;
    add('layout-template', path, `direction is "row" or "column", not ${JSON.stringify(raw)}`);
    return fallback;
  };
  const anchorCheck = (path: string, raw: unknown) => {
    if (raw !== undefined && anchorOf(raw) === undefined) add('layout-template', path, `anchor is one of ${REGION_ANCHORS.join(', ')}, not ${JSON.stringify(raw)}`);
  };

  const walk = (list: unknown, path: string, depth: number, direction: 'row' | 'column', inherited: RegionAnchor | undefined): Node[] => {
    if (!Array.isArray(list) || !list.length || list.length > MAX_REGION_ENTRIES) {
      add('layout-template', path, `regions is a list of 1 to ${MAX_REGION_ENTRIES} regions and splits${Array.isArray(list) ? `; this one has ${list.length}` : ''}`);
      return [];
    }
    const out: Node[] = [];
    list.forEach((raw, index) => {
      const at = `${path}/${index}`;
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { add('layout-template', at, 'each entry is a region ({ "name": ... }) or a split ({ "direction": ..., "regions": [...] })'); return; }
      const entry = raw as Record<string, unknown>;
      const split = isSplitEntry(entry);
      if (!split && typeof entry.name !== 'string') { add('layout-template', at, 'a region needs a name; a split needs direction and regions'); return; }
      const heading = typeof entry.name === 'string' && headingNames.has(entry.name);
      let size: number | 'auto' = split || !heading || direction === 'row' ? 1 : 'auto';
      if (entry.size !== undefined) {
        if (validSize(entry.size)) size = entry.size;
        else add('layout-template', `${at}/size`, `size is a number above 0 and up to 100, or "auto"; not ${JSON.stringify(entry.size)}`);
      }
      if (size === 'auto' && direction !== 'column') add('layout-template', `${at}/size`, '"auto" is allowed only in a column: a region or split in a row has a numeric size');
      if (split) {
        if (entry.name !== undefined) add('layout-template', `${at}/name`, 'a split has no name');
        const inner = directionOf(`${at}/direction`, entry.direction, 'column');
        if (entry.direction === undefined) add('layout-template', `${at}/direction`, 'a split needs a direction, "row" or "column"');
        anchorCheck(`${at}/anchor`, entry.anchor);
        if (depth >= MAX_REGION_DEPTH) { add('layout-template', `${at}/regions`, `regions nest at most ${MAX_REGION_DEPTH} levels deep (the record's list is level 1); this split would be level ${depth + 1}`); return; }
        out.push({ kind: 'split', direction: inner, size, children: walk(entry.regions, `${at}/regions`, depth + 1, inner, anchorOf(entry.anchor) ?? inherited) });
        return;
      }
      const name = entry.name as string;
      if (names.has(name)) add('layout-region', `${at}/name`, `region name '${name}' is used twice; names are unique across the whole record`);
      names.add(name);
      if (heading) {
        for (const key of Object.keys(entry)) if (key !== 'name' && key !== 'size') add('layout-region', `${at}/${key}`, `'${name}' is a heading region and takes only a size; '${key}' belongs on a body region`);
      } else {
        if (reserved.has(name)) add('layout-region', `${at}/name`, `'${name}' is reserved and cannot name a body region (reserved: ${RESERVED_REGION_NAMES.join(', ')})`);
        else if (!NAME.test(name)) add('layout-region', `${at}/name`, `'${name}' is not a region name (lowercase letters, digits and hyphens, starting with a letter)`);
        if (entry.flow === 'none' && entry.max !== undefined && entry.max !== 1) add('layout-region', `${at}/max`, `a region with flow "none" holds one block; max must be 1, not ${JSON.stringify(entry.max)}`);
        anchorCheck(`${at}/anchor`, entry.anchor);
        const found = layoutRegion(name, entry, inherited);
        if (!found.accepts.length) add('layout-region', `${at}/accepts`, `region '${name}' accepts no content kind`);
        regions.push(found);
      }
      out.push({ kind: 'leaf', name, size });
    });
    return out;
  };

  if (!Array.isArray(value.regions)) { add('layout-template', '/regions', `a template needs a regions list of 1 to ${MAX_REGION_ENTRIES} regions and splits`); return { issues }; }
  const direction = directionOf('/direction', value.direction, 'column');
  anchorCheck('/anchor', value.anchor);
  const children = walk(value.regions, '/regions', 1, direction, anchorOf(value.anchor));
  if (names.has('subtitle') && !names.has('title')) add('layout-region', '/regions', "a 'subtitle' region needs a 'title' region");
  if (value.overflowRegion !== undefined && !regions.some(entry => entry.name === value.overflowRegion)) add('layout-region', '/overflowRegion', `overflowRegion ${JSON.stringify(value.overflowRegion)} is not a region of this layout`);
  if (issues.length) return { issues };

  const grid = compile({ kind: 'split', direction, size: 1, children });
  if (grid.rows.length > MAX_TEMPLATE_TRACKS || grid.columns.length > MAX_TEMPLATE_TRACKS) {
    add('layout-template', '/regions', `the regions compile to a grid of at most ${MAX_TEMPLATE_TRACKS} rows and ${MAX_TEMPLATE_TRACKS} columns; this one has ${grid.rows.length} rows and ${grid.columns.length} columns`);
    return { issues };
  }
  const bounds = new Map<string, { top: number; left: number; bottom: number; right: number }>();
  for (const [r, row] of grid.cells.entries()) for (const [c, name] of row.entries()) {
    const found = bounds.get(name);
    if (!found) bounds.set(name, { top: r, left: c, bottom: r, right: c });
    else { found.bottom = r; found.right = c; }
  }
  const areas: LayoutArea[] = [];
  const order = (nodes: Node[]) => { for (const node of nodes) { if (node.kind === 'split') order(node.children); else {
    const box = bounds.get(node.name) ?? { top: 0, left: 0, bottom: 0, right: 0 };
    areas.push({ name: node.name, row: box.top, column: box.left, rowSpan: box.bottom - box.top + 1, columnSpan: box.right - box.left + 1, heading: headingNames.has(node.name) });
  } } };
  order(children);
  // A column of nothing but auto entries has no numeric track to hold the leftover height: the record's anchor places the stack.
  const stackAnchor = anchorOf(value.anchor);
  const stack = direction === 'column' && children.length > 0 && children.every(node => node.size === 'auto') && stackAnchor !== undefined && stackAnchor !== 'top' ? stackAnchor : undefined;
  const overflowRegion = typeof value.overflowRegion === 'string' ? value.overflowRegion : regions.find(entry => entry.role === 'primary' && entry.flow !== 'none')?.name;
  return {
    issues,
    template: {
      rows: grid.rows,
      columns: grid.columns,
      grid: grid.cells,
      areas,
      regions,
      ...(overflowRegion !== undefined ? { overflowRegion } : {}),
      title: names.has('title'),
      subtitle: names.has('subtitle'),
      ...(stack ? { stack } : {}),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The compile. Every tree is a guillotine partition, so it becomes a grid exactly: a fragment is the grid of one node
// (its row and column tracks and a cell per track pair); a split puts its children's fragments side by side (a row) or one
// above the other (a column) along its own axis and aligns them on the other axis by the cut positions each fragment has.

type Track = number | 'auto';
interface Fragment { rows: Track[]; columns: number[]; cells: string[][] }
interface Position { w: number; a: number }

/** Compare positions: numeric share first, then the autos passed (an auto track has no numeric length). */
const comparePositions = (x: Position, y: Position) => Math.abs(x.w - y.w) > EPSILON ? x.w - y.w : x.a - y.a;

/** The cut positions between tracks: numeric share of the fragment's numeric total (0 when it has none) and autos passed. */
function cutsOf(tracks: readonly Track[]): Position[] {
  const total = tracks.reduce<number>((sum, size) => sum + (size === 'auto' ? 0 : size), 0);
  const cuts: Position[] = [];
  let w = 0, a = 0;
  tracks.forEach((size, index) => {
    if (size === 'auto') a++; else w += size;
    if (index < tracks.length - 1) cuts.push({ w: total > 0 ? w / total : 0, a });
  });
  return cuts;
}

const endOf = (tracks: readonly Track[]): Position => ({ w: tracks.some(size => size !== 'auto') ? 1 : 0, a: tracks.filter(size => size === 'auto').length });

/** Align fragments on one axis: the union of their cuts, as tracks, and for each fragment the track each union track lies in. */
function align(axes: readonly (readonly Track[])[]): { tracks: Track[]; owner: number[][] } {
  const cuts: Position[] = [];
  for (const axis of axes) for (const cut of cutsOf(axis)) if (!cuts.some(found => comparePositions(found, cut) === 0)) cuts.push(cut);
  cuts.sort(comparePositions);
  const ends = axes.map(endOf);
  const end = ends.reduce((best, found) => comparePositions(found, best) > 0 ? found : best);
  const bounds: Position[] = [{ w: 0, a: 0 }, ...cuts.filter(cut => comparePositions(cut, end) < 0), end];
  const tracks: Track[] = [];
  for (let index = 1; index < bounds.length; index++) {
    const share = (bounds[index]?.w ?? 0) - (bounds[index - 1]?.w ?? 0);
    tracks.push(share > EPSILON ? share : 'auto');
  }
  const owner = axes.map(axis => {
    const own = cutsOf(axis);
    return tracks.map((_, index) => own.filter(cut => comparePositions(cut, bounds[index] ?? cut) <= 0).length);
  });
  return { tracks, owner };
}

/** The numeric tracks scaled to sum to `size`; every track `auto` for an `auto` size. */
function scale(tracks: readonly Track[], size: Track): Track[] {
  if (size === 'auto') return tracks.map(() => 'auto' as const);
  const total = tracks.reduce<number>((sum, track) => sum + (track === 'auto' ? 0 : track), 0);
  return total > 0 ? tracks.map(track => track === 'auto' ? track : track * size / total) : [...tracks];
}

function fragmentOf(node: Node): Fragment {
  if (node.kind === 'leaf') return { rows: [1], columns: [1], cells: [[node.name]] };
  const kids = node.children.map(child => ({ size: child.size, fragment: fragmentOf(child) }));
  if (node.direction === 'column') {
    const { tracks, owner } = align(kids.map(kid => kid.fragment.columns));
    const rows: Track[] = [], cells: string[][] = [];
    kids.forEach((kid, index) => {
      rows.push(...scale(kid.fragment.rows, kid.size));
      for (const row of kid.fragment.cells) cells.push(tracks.map((_, column) => row[owner[index]?.[column] ?? 0] ?? ''));
    });
    return { rows, columns: tracks.map(track => track as number), cells };
  }
  const { tracks, owner } = align(kids.map(kid => kid.fragment.rows));
  const columns: number[] = [];
  for (const kid of kids) columns.push(...scale(kid.fragment.columns, kid.size) as number[]);
  const cells = tracks.map((_, row) => kids.flatMap((kid, index) => kid.fragment.cells[owner[index]?.[row] ?? 0] ?? []));
  return { rows: tracks, columns, cells };
}

/** Weights as the smallest whole numbers with the same proportions (`[0.6, 0.4]` is `[3, 2]`), when there are any. */
function wholeWeights(tracks: readonly Track[]): Track[] {
  const total = tracks.reduce<number>((sum, track) => sum + (track === 'auto' ? 0 : track), 0);
  if (!(total > 0)) return [...tracks];
  for (let k = 1; k <= 1000; k++) {
    const scaled = tracks.map(track => track === 'auto' ? track : track / total * k);
    if (scaled.every(track => track === 'auto' || (Math.abs(track - Math.round(track)) < 1e-6 && Math.round(track) >= 1))) return scaled.map(track => track === 'auto' ? track : Math.round(track));
  }
  return tracks.map(track => track === 'auto' ? track : Math.round(track / total * 1e6) / 1e4);
}

function compile(root: Node): { rows: Track[]; columns: number[]; cells: string[][] } {
  const fragment = fragmentOf(root);
  return { rows: wholeWeights(fragment.rows), columns: wholeWeights(fragment.columns) as number[], cells: fragment.cells };
}

/**
 * The problems `validate` reports for a template record (`opf/layout-template`, `opf/layout-region`): a `regions` list
 * that is not 1 to 12 entries, an entry that is neither a region nor a split, a bad `direction` or `size`, `auto` outside
 * a column, splits nested too deep, regions that compile to more than 12 rows or columns; a name used twice, a reserved
 * name, a heading region with content rules, a `subtitle` without `title`, `flow: "none"` with `max` other than 1,
 * a region that accepts nothing, an `overflowRegion` that is not a region. Empty for a valid template and for a record
 * that is not a template.
 */
export function layoutTemplateIssues(layout: unknown): LayoutTemplateIssue[] {
  return isLayoutTemplate(layout) ? parse(layout).issues : [];
}

/** Parse, check and compile a template record. Throws OPFLayoutTemplateError for a record with a `layout-template` or `layout-region` issue. */
export function layoutTemplate(layout: unknown): LayoutTemplate {
  const parsed = parse(layout);
  if (!parsed.template) throw new OPFLayoutTemplateError(parsed.issues);
  return parsed.template;
}
