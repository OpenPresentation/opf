/**
 * OPF 0.19 layout templates (`opf-layout/v2`): a layout is a grid of named areas, written in the notation of CSS
 * `grid-template-areas`, and the body areas are regions that say which content they take and how several blocks share
 * them. This module parses and checks a record; binding content to regions is `bindRegions` (bind-regions.ts) and the
 * geometry is `composeSlide`.
 *
 * A record is a template when it has `areas`. Until the default catalog moves to `@openpresentation/gallery` 2.0.0, the
 * 0.18 records (`placeholders`, `opf-layout/v1`) still compose as they did; RR-83 removes them.
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
/** The two heading areas. They hold the slide's headings and have no `regions` entry. */
export const HEADING_AREAS = ['title', 'subtitle'] as const;
/**
 * Names a region may not take: the heading words, `auto`, and the six promoted-region words, so `region=` in the
 * Markdown dialect stays unambiguous.
 */
export const RESERVED_REGION_NAMES = ['title', 'subtitle', 'tag', 'auto', 'left', 'center', 'right', 'top', 'middle', 'bottom'] as const;
/** A template has at most this many rows and this many columns. */
export const MAX_TEMPLATE_TRACKS = 12;
/** A region holds at most this many blocks on one slide. */
export const MAX_REGION_BLOCKS = 12;
/** The layout id no catalog may define: `layout: "auto"` is automatic composition. */
export const AUTO_LAYOUT = 'auto';

/** One region of a template with every default applied. */
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

/** One named area of the grid: its top-left cell and its span, in logical (left-to-right) columns. */
export interface LayoutArea {
  name: string;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  /** `title` or `subtitle`. */
  heading: boolean;
}

/** A parsed, checked template. */
export interface LayoutTemplate {
  /** Row track sizes: relative numbers, or `auto` for the height the row's content needs. */
  rows: (number | 'auto')[];
  /** Column track sizes, relative. */
  columns: number[];
  /** The cell grid: `grid[row][column]` is an area name or `.`. */
  grid: string[][];
  /** Every area, headings included, in reading order (by top-left cell, row by row, then cell by cell). */
  areas: LayoutArea[];
  /** The body regions in reading order, with defaults applied. */
  regions: LayoutRegion[];
  /**
   * Where content no region accepts goes: `overflowRegion`, else the first primary region whose flow is not `none`.
   * Absent when the record names none and has no such region (the slide then draws it in an implicit row below the grid).
   */
  overflowRegion?: string;
  /** Whether the template has a `title` area and a `subtitle` area. */
  title: boolean;
  subtitle: boolean;
}

/** A problem with a template: `layout-template` for the grid itself, `layout-region` for the regions. */
export interface LayoutTemplateIssue {
  code: 'layout-template' | 'layout-region';
  /** JSON Pointer inside the record (`/areas/1`, `/regions/notes/max`). */
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
const pointerSegment = (segment: string) => segment.replaceAll('~', '~0').replaceAll('/', '~1');
const reserved: ReadonlySet<string> = new Set(RESERVED_REGION_NAMES);
const headingNames: ReadonlySet<string> = new Set(HEADING_AREAS);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Whether a layout record is a 0.19 template (it has `areas`). */
export function isLayoutTemplate(layout: unknown): boolean {
  return Object.hasOwn(record(layout), 'areas');
}

/** The region of `name` with every default applied; `value` is the record's `regions[name]` entry. */
export function layoutRegion(name: string, value: unknown): LayoutRegion {
  const entry = record(value);
  const accepts = Array.isArray(entry.accepts) ? [...new Set(entry.accepts.filter((kind): kind is RegionKind => (REGION_KINDS as readonly unknown[]).includes(kind)))] : [];
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
    anchor: (REGION_ANCHORS as readonly unknown[]).includes(entry.anchor) ? entry.anchor as RegionAnchor : 'top',
    empty: entry.empty === 'keep' ? 'keep' : 'collapse',
  };
}

interface Parsed { template?: LayoutTemplate; issues: LayoutTemplateIssue[] }

function parse(layout: unknown): Parsed {
  const value = record(layout);
  const issues: LayoutTemplateIssue[] = [];
  const grid = (code: LayoutTemplateIssue['code'], path: string, message: string) => issues.push({ code, path, message });
  const areas = value.areas;
  if (!Array.isArray(areas) || !areas.length) {
    grid('layout-template', '/areas', 'a template needs 1 to 12 rows of area names');
    return { issues };
  }
  if (areas.length > MAX_TEMPLATE_TRACKS) grid('layout-template', '/areas', `a template has at most ${MAX_TEMPLATE_TRACKS} rows; this one has ${areas.length}`);
  const cells: string[][] = areas.map((row, index) => {
    if (typeof row !== 'string') { grid('layout-template', `/areas/${index}`, 'each row is a string of area names'); return []; }
    const words = row.trim().split(/\s+/).filter(Boolean);
    if (!words.length) grid('layout-template', `/areas/${index}`, 'a row needs at least one area name or "."');
    for (const word of words) if (word !== '.' && !NAME.test(word)) grid('layout-template', `/areas/${index}`, `'${word}' is not an area name (lowercase letters, digits and hyphens, starting with a letter) or "."`);
    return words;
  });
  const width = cells[0]?.length ?? 0;
  cells.forEach((row, index) => { if (index > 0 && row.length !== width && row.length) grid('layout-template', `/areas/${index}`, `every row has the same number of cells; row ${index + 1} has ${row.length}, row 1 has ${width}`); });
  if (width > MAX_TEMPLATE_TRACKS) grid('layout-template', '/areas', `a template has at most ${MAX_TEMPLATE_TRACKS} columns; this one has ${width}`);
  const columns = value.columns === undefined ? Array.from({ length: width }, () => 1) : value.columns;
  const rows = value.rows === undefined ? Array.from({ length: cells.length }, () => 1) : value.rows;
  if (!Array.isArray(columns) || columns.length !== width || !columns.every(positive)) grid('layout-template', '/columns', `columns needs one positive number per cell of a row (${width})`);
  if (!Array.isArray(rows) || rows.length !== cells.length || !rows.every(size => size === 'auto' || positive(size))) grid('layout-template', '/rows', `rows needs one positive number or "auto" per row (${cells.length})`);
  if (issues.length) return { issues };

  // Each name's cells must form one filled rectangle.
  const bounds = new Map<string, { top: number; left: number; bottom: number; right: number; count: number }>();
  cells.forEach((row, r) => { row.forEach((name, c) => {
    if (name === '.') return;
    const found = bounds.get(name);
    if (!found) bounds.set(name, { top: r, left: c, bottom: r, right: c, count: 1 });
    else { found.top = Math.min(found.top, r); found.left = Math.min(found.left, c); found.bottom = Math.max(found.bottom, r); found.right = Math.max(found.right, c); found.count++; }
  }); });
  const list: LayoutArea[] = [];
  for (const [name, box] of bounds) {
    const filled = (box.bottom - box.top + 1) * (box.right - box.left + 1);
    let rectangle = filled === box.count;
    for (let r = box.top; rectangle && r <= box.bottom; r++) for (let c = box.left; c <= box.right; c++) if (cells[r]![c] !== name) { rectangle = false; break; }
    if (!rectangle) { grid('layout-template', '/areas', `the cells of '${name}' do not form one filled rectangle`); continue; }
    list.push({ name, row: box.top, column: box.left, rowSpan: box.bottom - box.top + 1, columnSpan: box.right - box.left + 1, heading: headingNames.has(name) });
  }
  if (issues.length) return { issues };
  list.sort((a, b) => a.row - b.row || a.column - b.column);

  const entries = record(value.regions);
  const region = (path: string, message: string) => grid('layout-region', path, message);
  if (value.regions !== undefined && (value.regions === null || typeof value.regions !== 'object' || Array.isArray(value.regions))) region('/regions', 'regions is an object keyed by region name');
  for (const name of Object.keys(entries)) {
    if (reserved.has(name)) region(`/regions/${pointerSegment(name)}`, `'${name}' is reserved and cannot name a region (reserved: ${RESERVED_REGION_NAMES.join(', ')})`);
    else if (!bounds.has(name)) region(`/regions/${pointerSegment(name)}`, `region '${name}' has no area in areas`);
  }
  for (const area of list) {
    if (area.heading) continue;
    if (reserved.has(area.name)) { if (!Object.hasOwn(entries, area.name)) region('/areas', `'${area.name}' is reserved and cannot name a body area (reserved: ${RESERVED_REGION_NAMES.join(', ')})`); continue; }
    if (!Object.hasOwn(entries, area.name)) region('/regions', `body area '${area.name}' has no entry in regions`);
  }
  if (bounds.has('subtitle') && !bounds.has('title')) region('/areas', "a 'subtitle' area needs a 'title' area");
  for (const [name, entry] of Object.entries(entries)) {
    const raw = record(entry);
    if (raw.flow === 'none' && raw.max !== undefined && raw.max !== 1) region(`/regions/${pointerSegment(name)}/max`, `a region with flow "none" holds one block; max must be 1, not ${JSON.stringify(raw.max)}`);
  }
  const regions = list.filter(area => !area.heading && !reserved.has(area.name) && Object.hasOwn(entries, area.name)).map(area => layoutRegion(area.name, entries[area.name]));
  for (const entry of regions) if (!entry.accepts.length) region(`/regions/${pointerSegment(entry.name)}/accepts`, `region '${entry.name}' accepts no content kind`);
  if (value.overflowRegion !== undefined && !regions.some(entry => entry.name === value.overflowRegion)) region('/overflowRegion', `overflowRegion ${JSON.stringify(value.overflowRegion)} is not a region of this layout`);
  if (issues.length) return { issues };
  const overflowRegion = typeof value.overflowRegion === 'string' ? value.overflowRegion : regions.find(entry => entry.role === 'primary' && entry.flow !== 'none')?.name;
  return {
    issues,
    template: {
      rows: (rows as (number | 'auto')[]).slice(),
      columns: (columns as number[]).slice(),
      grid: cells,
      areas: list,
      regions,
      ...(overflowRegion !== undefined ? { overflowRegion } : {}),
      title: bounds.has('title'),
      subtitle: bounds.has('subtitle'),
    },
  };
}

/**
 * The problems `validate` reports for a template record (`opf/layout-template`, `opf/layout-region`): ragged rows, a name
 * whose cells are not one rectangle, track lists of the wrong length, a grid over 12 x 12, a word that is not a name;
 * a body area with no region, a region with no area, a reserved region name, a `subtitle` area without `title`,
 * `flow: "none"` with `max` other than 1, an `overflowRegion` that is not a region. Empty for a valid template and for a
 * record that is not a template.
 */
export function layoutTemplateIssues(layout: unknown): LayoutTemplateIssue[] {
  return isLayoutTemplate(layout) ? parse(layout).issues : [];
}

/** Parse and check a template record. Throws OPFLayoutTemplateError for a record with a `layout-template` or `layout-region` issue. */
export function layoutTemplate(layout: unknown): LayoutTemplate {
  const parsed = parse(layout);
  if (!parsed.template) throw new OPFLayoutTemplateError(parsed.issues);
  return parsed.template;
}
