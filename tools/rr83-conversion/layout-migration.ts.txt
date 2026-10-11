/**
 * OPF 0.19 layout migration (design section 9): the 278 layout ids of the 0.18 default catalog that 0.19 removes, each
 * mapped to one built-in layout and the design settings that reproduce its variant, and `migrate()`, which rewrites a
 * deck: every slide that names a removed id, and every embedded 0.18 record (converted to a template, section 7).
 * There are no aliases: after 0.19 the old ids exist only in `spec/reference/layout-migration.json` and here.
 */
import { layoutMigrationSource } from './generated/layout-migration.js';
import { parseReference, resolveReference, type CatalogOptions } from './catalog-refs.js';
import { bindRegions, placedImageBlocks, PROMOTED_REGION_KEY, regionAccepts, rootNodes } from './bind-regions.js';
import { isLayoutTemplate, layoutTemplate } from './layout-template.js';

/** What replaces one removed layout id. */
export interface LayoutMigrationRow {
  /** The built-in layout that replaces it, or `auto` (the slide drops its layout). */
  layout: string;
  /** Design settings the slide receives where neither the slide nor the deck sets the key. */
  design?: Readonly<Record<string, string | boolean>>;
  content?: {
    /** The old record's body placeholders: the slide's blocks are wrapped into content groups the same shape. */
    groups?: readonly unknown[];
    /** The old record bled its n-th image to an edge: the slide's matching top-level image block takes this placement. */
    placement?: { image: number; edge: 'left' | 'right' | 'top' | 'bottom'; size?: number; inset?: boolean };
    /** The slide drops its `layout` (`blank`). */
    dropLayout?: true;
  };
}

/** Every removed id of the 0.18 default catalog, with its replacement. */
export const LAYOUT_MIGRATION: Readonly<Record<string, LayoutMigrationRow>> = layoutMigrationSource as Record<string, LayoutMigrationRow>;

// biome-ignore lint/suspicious/noExplicitAny: authored JSON is walked untyped; every read is guarded.
type Rec = Record<string, any>;
const rec = (value: unknown): Rec => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Rec : {};
const clone = <T>(value: T): T => structuredClone(value);
const FIELDS = ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline'];
const HEADINGS = new Set(['title', 'subtitle', 'tag']);
const pointer = (path: readonly (string | number)[]) => path.length ? `/${path.map(part => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}` : '';

/** The replacement of a removed layout reference (`text-1x` or `default:text-1x`); undefined for any other reference. */
export function layoutMigrationRow(reference: unknown): LayoutMigrationRow | undefined {
  const parsed = parseReference(reference);
  if (!parsed || (parsed.group !== undefined && parsed.group !== 'default')) return undefined;
  return Object.hasOwn(LAYOUT_MIGRATION, parsed.id) ? LAYOUT_MIGRATION[parsed.id] : undefined;
}

/**
 * The row of a layout reference that OPF 0.19 removed: a 0.18 default id (bare or `default:`) that is not also the id of
 * a 0.19 built-in. Six ids live on as built-ins (agenda, comparison, dashboard, faq, timeline, two-column): their rows
 * only carry the old record's settings for `migrate`, and a reference to them is never `opf/layout-removed`.
 */
export function removedLayoutRow(reference: unknown): LayoutMigrationRow | undefined {
  const row = layoutMigrationRow(reference);
  return row && row.layout !== parseReference(reference)?.id ? row : undefined;
}

/** A root payload as blocks: each payload field one block (`bullets` stays with `text`), the payload's `type`, `caption` and `numbering` on the block they belong to. */
function rootAsBlocks(slide: Rec): Rec[] {
  const blocks: Rec[] = [];
  for (const field of FIELDS) {
    if (slide[field] === undefined || field === 'bullets' && slide.text !== undefined) continue;
    const block: Rec = { [field]: slide[field] };
    if (field === 'text' && slide.bullets !== undefined) block.bullets = slide.bullets;
    if ((field === 'items' || field === 'bullets' || field === 'text') && slide.numbering !== undefined) block.numbering = slide.numbering;
    if (['image', 'chart', 'table', 'video'].includes(field) && slide.caption !== undefined) block.caption = slide.caption;
    blocks.push(block);
  }
  return blocks;
}
function moveRootIntoBlocks(slide: Rec): void {
  if (Array.isArray(slide.blocks)) return;
  const blocks = rootAsBlocks(slide);
  if (!blocks.length) return;
  for (const key of [...FIELDS, 'numbering', 'caption', 'type']) delete slide[key];
  slide.blocks = blocks;
}

/** One change `migrate` made. */
export interface LayoutMigrationChange {
  /** `layout-migrated` (a slide's removed id), `layout-converted` (an embedded 0.18 record rewritten as a template), `layout-dropped` (an embedded copy of a removed default record), `design-hoisted` (a setting every slide received moved to the deck). */
  code: 'layout-migrated' | 'layout-converted' | 'layout-dropped' | 'design-hoisted';
  /** JSON Pointer of what changed. */
  path: string;
  message: string;
}

/**
 * Apply one row of the table to a slide: the new layout (or none), the design settings the slide and the deck do not set,
 * and the content rewrite (content groups shaped like the old record's placeholder groups, the image placement, or a
 * dropped layout). Returns a new slide; never mutates the input.
 */
export function migrateSlide(slide: unknown, row: LayoutMigrationRow, deckDesign: unknown = {}): Rec {
  const out = clone(rec(slide));
  const reference = typeof out.layout === 'string' ? out.layout : '';
  if (row.layout === 'auto' || row.content?.dropLayout) delete out.layout;
  else out.layout = reference.startsWith('default:') ? `default:${row.layout}` : row.layout;
  const deck = rec(deckDesign);
  for (const [key, value] of Object.entries(row.design ?? {})) {
    if (rec(out.design)[key] !== undefined || deck[key] !== undefined) continue;
    out.design = { ...rec(out.design), [key]: value };
  }
  const promoted = Object.keys(out).some(key => PROMOTED_REGION_KEY.test(key));
  const placement = row.content?.placement;
  if (placement && !promoted) {
    moveRootIntoBlocks(out);
    const images = (Array.isArray(out.blocks) ? out.blocks : []).filter((block: Rec) => !Array.isArray(block.blocks) && block.image !== undefined);
    const target = images[placement.image];
    if (target && target.placement === undefined) target.placement = { edge: placement.edge, ...(placement.size !== undefined ? { size: placement.size } : {}), ...(placement.inset !== undefined ? { inset: placement.inset } : {}) };
  }
  const groups = row.content?.groups;
  if (groups && !promoted) {
    moveRootIntoBlocks(out);
    const blocks: Rec[] = Array.isArray(out.blocks) ? out.blocks : [];
    // The 0.18 rule: a slide that brings its own content groups keeps its structure.
    if (blocks.length && blocks.every(block => !Array.isArray(block.blocks))) {
      const placed = placedImageBlocks(out);
      const queue = blocks.filter((_, index) => !placed.has(index));
      let next = 0;
      const fill = (entries: readonly unknown[]): Rec[] => {
        const nodes: Rec[] = [];
        for (const entry of entries) {
          if (next >= queue.length) break;
          const value = rec(entry);
          if (value.type !== 'group') { nodes.push(queue[next++]!); continue; }
          const children = fill(Array.isArray(value.placeholders) ? value.placeholders : []);
          if (children.length) nodes.push({ blocks: children, ...(value.composition && Object.keys(value.composition).length ? { composition: clone(value.composition) } : {}) });
        }
        return nodes;
      };
      const wrapped = fill(groups);
      const rest = queue.slice(next);
      // Placed images keep their positions among the blocks: they never fill a placeholder.
      const result: Rec[] = [];
      let used = false;
      blocks.forEach((block, index) => {
        if (placed.has(index)) { result.push(block); return; }
        if (!used) { result.push(...wrapped, ...rest); used = true; }
      });
      out.blocks = result;
    }
  }
  return out;
}

/** One JSON Patch operation of a slide rewrite. */
export type SlidePatchOperation = { op: 'add' | 'replace'; path: string; value: unknown } | { op: 'remove'; path: string };
/** JSON Patch operations that turn `before` into `after`, one per changed top-level key of the slide at `base`. */
export function slidePatch(before: unknown, after: unknown, base: string): SlidePatchOperation[] {
  const a = rec(before), b = rec(after);
  const ops: SlidePatchOperation[] = [];
  for (const key of Object.keys(a)) if (!Object.hasOwn(b, key)) ops.push({ op: 'remove', path: `${base}${pointer([key])}` });
  for (const [key, value] of Object.entries(b)) {
    if (!Object.hasOwn(a, key)) ops.push({ op: 'add', path: `${base}${pointer([key])}`, value: clone(value) });
    else if (JSON.stringify(a[key]) !== JSON.stringify(value)) ops.push({ op: 'replace', path: `${base}${pointer([key])}`, value: clone(value) });
  }
  return ops;
}

/** A 0.18 record converted to a template, with the region each of its leaves became (the 0.18 fill order). */
export interface ConvertedLayout {
  record: Rec;
  /** Per 0.18 body leaf, in reading order: the region that took its place. */
  leafRegions: string[];
}

/**
 * Convert a 0.18 layout record (`placeholders`, `composition.mode`) into a template (design section 7): the headings
 * become a `title` row; a flat row, column or grid of placeholders becomes one area per placeholder with the weights as
 * track sizes; a record with no mode becomes one `auto` region accepting the union of its kinds; a placeholder group
 * becomes one region accepting its leaf kinds (column flow for a column group, grid otherwise); an image placeholder with a
 * placement becomes a bled region on that edge. Region names are the kind, numbered when repeated (`chart`, `text-2`).
 */
export function convertLayoutRecord(input: unknown): ConvertedLayout {
  const old = rec(input);
  const placeholders: Rec[] = (Array.isArray(old.placeholders) ? old.placeholders : []).map(rec);
  const composition = rec(old.composition);
  const hasHeadings = placeholders.some(entry => HEADINGS.has(entry.type));
  const bodies = placeholders.filter(entry => !HEADINGS.has(entry.type));
  const placed = bodies.find(entry => entry.type === 'image' && entry.placement !== undefined);
  const flowing = bodies.filter(entry => entry !== placed);
  const used = new Map<string, number>();
  const nameFor = (kind: string): string => {
    const count = (used.get(kind) ?? 0) + 1;
    used.set(kind, count);
    return count === 1 ? kind : `${kind}-${count}`;
  };
  const leafKinds = (entry: Rec): string[] => entry.type === 'group' ? (Array.isArray(entry.placeholders) ? entry.placeholders : []).flatMap((child: unknown) => leafKinds(rec(child))) : [entry.type];
  const regions: Rec = {};
  const leafRegions: string[] = [];
  let cells: string[][] = [];
  let columns: number[] = [];
  let rows: (number | 'auto')[] = [];
  const mode = composition.mode;
  if (flowing.length && (mode === undefined || mode === 'auto')) {
    const kinds = [...new Set(flowing.flatMap(leafKinds))];
    const name = nameFor(kinds[0] ?? 'text');
    const count = flowing.flatMap(leafKinds).length;
    regions[name] = { accepts: kinds, role: 'primary', flow: 'auto', ...(count > 6 ? { max: Math.min(12, count) } : {}) };
    for (let index = 0; index < count; index++) leafRegions.push(name);
    cells = [[name]]; columns = [1]; rows = [1];
  } else if (flowing.length) {
    const names = flowing.map(entry => {
      const kinds = [...new Set(leafKinds(entry))];
      const name = nameFor(kinds[0] ?? 'text');
      if (entry.type === 'group') {
        const leaves = leafKinds(entry).length;
        // The group's leaves are its room, so later content goes on to the next region as it did in 0.18.
        regions[name] = { accepts: [...kinds, 'group'], role: 'primary', flow: rec(entry.composition).mode === 'column' ? 'column' : 'grid', max: Math.min(12, Math.max(1, leaves)) };
        for (let index = 0; index < leaves; index++) leafRegions.push(name);
      } else {
        regions[name] = { accepts: [entry.type], role: 'primary', flow: 'none' };
        leafRegions.push(name);
      }
      return name;
    });
    const weights: number[] = Array.isArray(composition.weights) ? composition.weights : [];
    if (mode === 'row') { cells = [names]; columns = names.map((_, index) => weights[index] ?? 1); rows = [1]; }
    else if (mode === 'column') { cells = names.map(name => [name]); columns = [1]; rows = names.map((_, index) => weights[index] ?? 1); }
    else {
      const count = Math.max(1, Math.min(names.length, Number.isInteger(composition.columns) ? composition.columns : Math.ceil(Math.sqrt(names.length))));
      for (let start = 0; start < names.length; start += count) cells.push(Array.from({ length: count }, (_, offset) => names[start + offset] ?? '.'));
      columns = Array.from({ length: count }, (_, index) => weights[index] ?? 1);
      rows = cells.map(() => 1);
    }
  }
  const width = Math.max(1, cells[0]?.length ?? 1);
  // Headings on top: an auto row over a body, or the whole slide (centred) for a record with no flowing body.
  if (hasHeadings) {
    if (cells.length) { cells.unshift(Array.from({ length: width }, () => 'title')); rows.unshift('auto'); }
    else { cells = [['title']]; columns = [1]; rows = [1]; }
  }
  if (!cells.length) { cells = [['.']]; columns = [1]; rows = [1]; }
  if (placed) {
    const name = nameFor('image');
    const placement = rec(placed.placement);
    const size = typeof placement.size === 'number' ? placement.size : 0.5;
    regions[name] = { accepts: ['image'], role: 'media', flow: 'none', bleed: true };
    const share = (total: number) => Math.round(total * size / (1 - size) * 1000) / 1000;
    if (placement.edge === 'left' || placement.edge === 'right') {
      const before = placement.edge === 'left';
      cells = cells.map(row => before ? [name, ...row] : [...row, name]);
      columns = before ? [share(columns.reduce((a, b) => a + b, 0)), ...columns] : [...columns, share(columns.reduce((a, b) => a + b, 0))];
    } else {
      const numeric = rows.reduce<number>((sum, size) => sum + (size === 'auto' ? 0 : size), 0) || 1;
      const row = Array.from({ length: cells[0]!.length }, () => name);
      if (placement.edge === 'top') { cells.unshift(row); rows.unshift(share(numeric)); } else { cells.push(row); rows.push(share(numeric)); }
    }
    // The placed image is the first image leaf of the 0.18 fill order only when it comes first; record it at its place.
    const order = bodies.indexOf(placed);
    leafRegions.splice(Math.min(order, leafRegions.length), 0, name);
  }
  const record: Rec = {
    ...(typeof old.name === 'string' ? { name: old.name } : {}),
    ...(old.summary !== undefined ? { summary: old.summary } : {}),
    ...(old.description !== undefined ? { description: old.description } : {}),
    ...(old.design !== undefined ? { design: clone(old.design) } : {}),
    areas: cells.map(row => row.join(' ')),
    columns,
    rows,
    regions,
    ...(old.tags !== undefined ? { tags: clone(old.tags) } : {}),
    ...(old.preview !== undefined ? { preview: clone(old.preview) } : {}),
  };
  const kept = Object.fromEntries(['gap', 'padding', 'minFontSize', 'overflow'].filter(key => composition[key] !== undefined).map(key => [key, composition[key]]));
  if (Object.keys(kept).length) record.composition = kept;
  for (const [key, value] of Object.entries(old)) if (key.startsWith('x-')) record[key] = clone(value);
  return { record, leafRegions };
}

export interface MigrateOptions extends CatalogOptions {}
export interface MigrateResult {
  /** The migrated deck (a copy; the input is never changed). */
  document: Rec;
  changes: LayoutMigrationChange[];
}

/**
 * Migrate a deck to the 0.19 layouts (`opf convert --migrate`): every slide whose layout is a removed 0.18 id that does
 * not resolve to a template takes its replacement (the table row: layout, design settings, content rewrite); every 0.18
 * record embedded under `catalogs.custom` or a named group is converted to a template, and slides that use it get
 * `region` pins where the new binding would place a block differently from the 0.18 fill order; embedded copies of
 * removed default records are dropped. A design setting that every slide received moves to the deck's design when the
 * deck does not set that key. Deterministic and offline.
 */
export function migrate(input: unknown, options: MigrateOptions = {}): MigrateResult {
  const document = clone(rec(input));
  const changes: LayoutMigrationChange[] = [];
  const slides: Rec[] = Array.isArray(document.slides) ? document.slides : [];
  const deckDesign = rec(document.design);
  // 1. Embedded 0.18 records: custom and named groups are converted, removed default copies are dropped (after the slides).
  const converted = new Map<string, ConvertedLayout>();
  const catalogs = rec(document.catalogs);
  for (const [group, value] of Object.entries(catalogs)) {
    if (group === 'default') continue;
    const layouts = rec(rec(value).layouts);
    for (const [id, record] of Object.entries(layouts)) {
      if (!Array.isArray(rec(record).placeholders)) continue;
      const result = convertLayoutRecord(record);
      layouts[id] = result.record;
      converted.set(`${group}:${id}`, result);
      changes.push({ code: 'layout-converted', path: pointer(['catalogs', group, 'layouts', id]), message: `The 0.18 layout record ${group}:${id} was rewritten as a template (areas ${JSON.stringify(result.record.areas)}).` });
    }
  }
  const received: Rec[] = [];
  slides.forEach((slide, index) => {
    received[index] = {};
    if (typeof slide.layout !== 'string' || slide.layout === 'auto') return;
    const parsed = parseReference(slide.layout);
    if (!parsed) return;
    // A slide on a converted record: pins where the template would bind a block elsewhere than the 0.18 leaf it filled.
    const key = parsed.group !== undefined ? `${parsed.group}:${parsed.id}` : rec(rec(catalogs.custom).layouts)[parsed.id] !== undefined ? `custom:${parsed.id}` : undefined;
    const conversion = key !== undefined ? converted.get(key) : undefined;
    if (conversion) {
      const pinned = pinToLeafRegions(slide, conversion, index);
      if (pinned) { slides[index] = pinned; changes.push({ code: 'layout-migrated', path: pointer(['slides', index]), message: `Slide ${index + 1} keeps its blocks where the 0.18 layout put them, with region pins.` }); }
      return;
    }
    const row = layoutMigrationRow(slide.layout);
    if (!row) return;
    const found = resolveReference(document, 'layouts', slide.layout, options);
    if (found && isLayoutTemplate(found.record)) return;
    const next = migrateSlide(slide, row, deckDesign);
    for (const [designKey, value] of Object.entries(rec(next.design))) if (rec(slide.design)[designKey] === undefined) received[index]![designKey] = value;
    slides[index] = next;
    changes.push({ code: 'layout-migrated', path: pointer(['slides', index, 'layout']), message: `Slide ${index + 1}: layout '${slide.layout}' was removed in OPF 0.19; it is now ${row.layout === 'auto' ? 'automatic (no layout)' : `'${row.layout}'`}${row.design ? ` with ${Object.entries(row.design).map(([name, value]) => `${name}: ${value}`).join(', ')}` : ''}.` });
  });
  // 2. Hoisting: a key and value every slide received moves to the deck when the deck does not set it.
  if (slides.length) {
    const first = received[0] ?? {};
    for (const [key, value] of Object.entries(first)) {
      if (deckDesign[key] !== undefined) continue;
      if (!received.every(entry => entry?.[key] === value)) continue;
      for (const slide of slides) {
        const design = rec(slide.design);
        delete design[key];
        if (!Object.keys(design).length) delete slide.design;
      }
      document.design = { ...rec(document.design), [key]: value };
      changes.push({ code: 'design-hoisted', path: pointer(['design', key]), message: `Every slide received ${key}: ${JSON.stringify(value)}; it is set once on the deck.` });
    }
  }
  // 3. Embedded copies of removed default records that no slide names any more.
  const defaults = rec(rec(catalogs.default).layouts);
  for (const [id, record] of Object.entries(defaults)) {
    if (!Object.hasOwn(LAYOUT_MIGRATION, id) || !Array.isArray(rec(record).placeholders)) continue;
    const named = slides.some(slide => typeof slide.layout === 'string' && (slide.layout === id || slide.layout === `default:${id}`));
    if (named) continue;
    delete defaults[id];
    changes.push({ code: 'layout-dropped', path: pointer(['catalogs', 'default', 'layouts', id]), message: `The embedded copy of the removed 0.18 layout '${id}' was dropped.` });
  }
  if (catalogs.default && Object.hasOwn(rec(catalogs.default), 'layouts') && !Object.keys(defaults).length) delete rec(catalogs.default).layouts;
  return { document, changes };
}

/** The slide with `region` pins where binding to the converted template differs from the 0.18 fill order, or undefined. */
function pinToLeafRegions(slide: Rec, conversion: ConvertedLayout, index: number): Rec | undefined {
  if (!Array.isArray(slide.blocks) || Object.keys(slide).some(key => PROMOTED_REGION_KEY.test(key))) return undefined;
  const template = layoutTemplate(conversion.record);
  const nodes = rootNodes(slide, index);
  const binding = bindRegions(slide, conversion.record, { slideIndex: index });
  const boundTo = new Map<string, string>();
  for (const region of binding.regions) for (const block of [...region.blocks, ...region.overflow]) boundTo.set(block.path, region.name);
  const out = clone(slide);
  let changed = false;
  nodes.forEach((node, order) => {
    const expected = conversion.leafRegions[order];
    if (expected === undefined || node.block === undefined || boundTo.get(node.path) === expected || node.value.region !== undefined) return;
    const region = template.regions.find(entry => entry.name === expected);
    if (!region || !regionAccepts(region, node.value)) return;
    out.blocks[node.block].region = expected;
    changed = true;
  });
  return changed ? out : undefined;
}
