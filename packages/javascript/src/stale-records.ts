/**
 * OPF 0.35: embedded copies of built-in layout records from before 0.35. `opf embed` (core `embed`) copies the records a deck uses into
 * `catalogs.default`, so a self-contained deck carries the built-in layouts as an earlier release published them. 0.35 changed their keys
 * (`flow: "none"` is `max: 1`, `listColumns` is gone, `sequence` is an `arrangement`, ...) and renamed their body regions, so such a copy
 * fails the 0.35 layout schema. This module recognizes such a copy (staleLayoutCopy), says what it is (staleCopyCause), builds the patch
 * that takes the current record (staleCopyFix: `use-current-record`, or `rename-layout` for a layout 0.35 removed) and makes the copies of
 * a deck valid (refreshStaleLayouts, which `embed` runs).
 *
 * What is safe, by the content hash of the copy (PRIOR_LAYOUT_HASHES):
 * - an unedited copy of the 0.34 release of the record: 0.35 converted exactly that record, so the current one draws as the copy did and
 *   taking it is safe; the fix also renames each pin of a slide on it to the region's 0.35 name (RENAMED_REGIONS), so every block stays
 *   in its region;
 * - an unedited copy of an earlier release, or an edited copy: the current record draws differently (or drops the edits), so the fix is
 *   offered and not marked safe; the per-key fixes (`use-max-1`, `remove:listColumns`, `use-arrangement`, ...) keep the copy and its
 *   drawing, and refreshStaleLayouts applies them when they make the copy valid;
 * - a copy of a layout 0.35 removed (`flow`, `vertical-flow`, `agenda-split`): `rename-layout` moves its slides to the layout that
 *   replaced it, as the slide fix of the same id does, drops the copy and embeds the replacement; safe when the copy is unedited.
 * The deck's own records (`catalogs.custom`) are never replaced: they get the per-key fixes only.
 */
import { catalogSchemaNames } from './catalog-schemas.js';
import { catalogGroupSource, embeddedCopy, parseReference, registeredCatalog, renamedLayout, renamedLayoutTitlePosition, resolveReference, type CatalogOptions } from './catalog-refs.js';
import { documentHash } from './document-hash.js';
import type { Finding, FindingFix, JsonPatchOperation } from './generated/types/finding.js';
import { PRIOR_LAYOUT_HASHES, RELEASE_034_LAYOUT_HASHES } from './prior-layout-hashes.js';
import { validateAgainstSchema } from './schema-check.js';
import { removedKeyRepair } from './schema-fixes.js';
import { schemas } from './schemas.js';

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value);
const rec = (value: unknown): Rec => (isRec(value) ? value : {});
const part = (value: string | number) => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const pointer = (segments: readonly (string | number)[]) => `/${segments.map(part).join('/')}`;
const slideAt = (document: unknown, index: number): Rec => {
  const slides = rec(document).slides;
  return Array.isArray(slides) ? rec(slides[index]) : {};
};
const embeddedLayouts = (document: unknown, group: string): Rec => rec(rec(rec(rec(document).catalogs)[group]).layouts);

/**
 * OPF 0.35 (step 2): the body regions of the built-in layouts renamed to the seven standard names, by layout id: `{ old: new }`. A slide
 * renamed from a removed layout keeps its pins, so `process` (from `flow`) and `vertical-process` (from `vertical-flow`) also map
 * `stages`. docs/migrations/0.35.md has the same table.
 */
export const RENAMED_REGIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  agenda: { items: 'body' },
  'agenda-split': { items: 'body' },
  chart: { charts: 'body', note: 'aside' },
  'chart-beside': { chart: 'body', notes: 'aside' },
  chevrons: { stages: 'body' },
  closing: { details: 'body' },
  code: { code: 'body', notes: 'aside' },
  comparison: { verdict: 'aside' },
  cycle: { stages: 'body' },
  dashboard: { kpis: 'lead', charts: 'body' },
  faq: { questions: 'body' },
  flow: { stages: 'body' },
  gallery: { pictures: 'body' },
  hero: { support: 'body' },
  hierarchy: { nodes: 'body' },
  'inverted-pyramid': { levels: 'body' },
  logos: { logos: 'body' },
  matrix: { quadrants: 'body' },
  metrics: { metrics: 'body', note: 'aside' },
  'org-chart': { people: 'body' },
  pillars: { pillars: 'body' },
  process: { steps: 'body', stages: 'body' },
  pyramid: { levels: 'body' },
  quote: { quotes: 'body' },
  scorecard: { cards: 'body' },
  statement: { message: 'body' },
  table: { table: 'body', note: 'aside' },
  'table-beside': { table: 'body', notes: 'aside' },
  team: { people: 'body' },
  timeline: { timeline: 'body', notes: 'aside' },
  venn: { sets: 'body' },
  'vertical-flow': { stages: 'body' },
  'vertical-process': { stages: 'body' },
});

/** The 0.35 name of the 0.34 region `region` of the built-in layout `layout` (a bare id); undefined when 0.35 did not rename it. */
export function renamedRegion(layout: string, region: string): string | undefined {
  const names = Object.hasOwn(RENAMED_REGIONS, layout) ? RENAMED_REGIONS[layout]! : undefined;
  return names && Object.hasOwn(names, region) ? names[region] : undefined;
}

/** The names of every region of a layout record, nested splits included. */
export function layoutRegionNames(record: unknown): Set<string> {
  const names = new Set<string>();
  const walk = (regions: unknown) => {
    if (!Array.isArray(regions)) return;
    for (const region of regions) {
      if (!isRec(region)) continue;
      if (typeof region.name === 'string') names.add(region.name);
      walk(region.regions);
    }
  };
  walk(rec(record).regions);
  return names;
}

/** Which release of the built-in layout `id` an embedded `record` is, unedited: `0.34`, `earlier`, or undefined for any other record. */
export function priorBuiltinLayout(id: string, record: unknown): '0.34' | 'earlier' | undefined {
  const hashes = Object.hasOwn(PRIOR_LAYOUT_HASHES, id) ? PRIOR_LAYOUT_HASHES[id]! : undefined;
  if (!hashes || !isRec(record)) return undefined;
  const hash = documentHash(embeddedCopy(record)).slice('sha256:'.length, 'sha256:'.length + 16);
  if (!hashes.includes(hash)) return undefined;
  return RELEASE_034_LAYOUT_HASHES[id]?.includes(hash) ? '0.34' : 'earlier';
}

/** The schema issues of an embedded layout record, checked with the identity it is keyed by (as validate checks it). */
function layoutRecordIssues(id: string, record: unknown) {
  return validateAgainstSchema(isRec(record) ? { $schema: schemas[catalogSchemaNames.layouts].$id, id, ...record } : record, 'layouts').errors;
}

/** An embedded copy of a built-in layout record that the current layout schema rejects (staleLayoutCopy). */
export interface StaleLayoutCopy {
  /** The catalog group that embeds it (never `custom`). */
  group: string;
  id: string;
  /** JSON Pointer of the copy. */
  path: string;
  /** The release the copy is, unedited (priorBuiltinLayout); `edited` when its content is no released version of the record. */
  version: '0.34' | 'earlier' | 'edited';
  /** The current record of `id`, as embed copies it, when the catalog registered for the group's source has one. */
  current?: Rec;
  /** For a layout OPF 0.35 removed (`flow`, `vertical-flow`, `agenda-split`): the layout that replaced it and the title position its slides need. */
  renamed?: { id: string; current?: Rec; titlePosition?: 'start' };
}

/**
 * The embedded layout record `catalogs[group].layouts[id]`, when it is a copy of a built-in record: an unedited released version of one,
 * or any record whose id the catalog registered for the group's source publishes (or that 0.35 removed). Undefined for `catalogs.custom`
 * (the deck's own records) and for any other record. The caller checks that the copy fails the schema.
 */
export function staleLayoutCopy(document: unknown, group: string, id: string, options: CatalogOptions = {}): StaleLayoutCopy | undefined {
  if (group === 'custom') return undefined;
  const record = embeddedLayouts(document, group)[id];
  if (!isRec(record)) return undefined;
  const registered = rec(registeredCatalog(catalogGroupSource(document, group, options), options)?.layouts);
  const released = priorBuiltinLayout(id, record);
  const base = { group, id, path: pointer(['catalogs', group, 'layouts', id]), version: released ?? ('edited' as const) };
  if (isRec(registered[id])) return { ...base, current: embeddedCopy(registered[id]) };
  const next = renamedLayout('layouts', id);
  if (next !== undefined) {
    const position = renamedLayoutTitlePosition('layouts', id);
    return { ...base, renamed: { id: next, ...(isRec(registered[next]) ? { current: embeddedCopy(registered[next]) } : {}), ...(position ? { titlePosition: position } : {}) } };
  }
  return released ? base : undefined;
}

/** Whether taking the current record (or the replacing layout) is safe: an unedited copy of the 0.34 release, or of a layout 0.35 removed. */
const safeToTake = (copy: StaleLayoutCopy) => (copy.renamed ? copy.version !== 'edited' : copy.version === '0.34');

/** What a stale copy is and how to fix it, as the start of a finding's help. */
export function staleCopyCause(copy: StaleLayoutCopy): string {
  const what = copy.version === 'edited' ? 'an edited copy' : copy.version === '0.34' ? "an unedited copy of OPF 0.34's release" : 'an unedited copy of an earlier release';
  const head = `catalogs.${copy.group}.layouts.${copy.id} is ${what} of the built-in layout '${copy.id}'${copy.renamed ? `, which 0.35 removed (use '${copy.renamed.id}')` : ''}; 0.35 changed the keys of the built-in records, so the copy fails the 0.35 layout schema.`;
  if (copy.renamed) {
    return `${head} ${safeToTake(copy) ? 'The fix rename-layout (`opf embed -i` applies it)' : 'The fix rename-layout, which drops your edits,'} moves its slides to '${copy.renamed.id}'${copy.renamed.titlePosition ? ` with design.titlePosition "${copy.renamed.titlePosition}"` : ''} and drops the copy.`;
  }
  if (!copy.current) return `${head} Apply the fix of each key (\`opf embed -i\` applies the safe ones), or register the catalog that publishes it to take the current record.`;
  if (safeToTake(copy)) return `${head} Take the current record, which draws as this copy did (fix use-current-record; \`opf embed -i\` applies it), or apply the fix of each key.`;
  return `${head} The fix of each key keeps ${copy.version === 'edited' ? 'your edits' : 'its drawing'} (\`opf embed -i\` applies the safe ones); use-current-record takes the current record, which draws ${copy.version === 'edited' ? 'without your edits' : 'as the current built-in does'}.`;
}

/** The slides whose `layout` resolves to the copy, with the reference each writes. */
function slidesUsing(document: unknown, copy: StaleLayoutCopy, options: CatalogOptions): { index: number; reference: string }[] {
  const slides = rec(document).slides;
  const using: { index: number; reference: string }[] = [];
  (Array.isArray(slides) ? slides : []).forEach((slide, index) => {
    const reference = rec(slide).layout;
    if (typeof reference !== 'string') return;
    const found = resolveReference(document, 'layouts', reference, options);
    if (found?.origin === 'document' && found.group === copy.group && found.id === copy.id) using.push({ index, reference });
  });
  return using;
}

/**
 * The operations that rename each pin of slide `index` that names a region of `before` (the 0.34 copy of the built-in layout `layout`)
 * and no region of `next` to the region's 0.35 name (RENAMED_REGIONS), when `next` has it.
 */
function pinOperations(document: unknown, index: number, layout: string, before: Set<string>, next: unknown): JsonPatchOperation[] {
  const names = layoutRegionNames(next);
  const blocks = slideAt(document, index).blocks;
  const ops: JsonPatchOperation[] = [];
  (Array.isArray(blocks) ? blocks : []).forEach((block, at) => {
    const pin = rec(block).region;
    if (typeof pin !== 'string' || names.has(pin) || !before.has(pin)) return;
    const renamed = renamedRegion(layout, pin);
    if (renamed !== undefined && names.has(renamed)) ops.push({ op: 'replace', path: pointer(['slides', index, 'blocks', at, 'region']), value: renamed });
  });
  return ops;
}

/** The operation that sets slide `index`'s design.titlePosition, unless the slide sets one. */
export function titlePositionOperations(document: unknown, index: number, position: 'start' | undefined): JsonPatchOperation[] {
  if (position === undefined) return [];
  const design = slideAt(document, index).design;
  if (isRec(design) && design.titlePosition !== undefined) return [];
  return isRec(design) ? [{ op: 'add', path: pointer(['slides', index, 'design', 'titlePosition']), value: position }] : [{ op: 'add', path: pointer(['slides', index, 'design']), value: { titlePosition: position } }];
}

/**
 * The operations that drop the copy of a removed layout once no slide uses it, and embed the layout that replaced it where the group
 * lacks it: what `rename-layout` adds on a slide's last reference to the copy (validate's opf/unresolved-reference).
 */
export function droppedCopyOperations(document: unknown, copy: StaleLayoutCopy): JsonPatchOperation[] {
  if (!copy.renamed) return [];
  const ops: JsonPatchOperation[] = [{ op: 'remove', path: copy.path }];
  if (copy.renamed.current && !Object.hasOwn(embeddedLayouts(document, copy.group), copy.renamed.id)) ops.push({ op: 'add', path: pointer(['catalogs', copy.group, 'layouts', copy.renamed.id]), value: copy.renamed.current });
  return ops;
}

/** The slides that use a stale copy (slidesUsing), for the slide findings. */
export function staleCopyUsers(document: unknown, copy: StaleLayoutCopy, options: CatalogOptions = {}): number[] {
  return slidesUsing(document, copy, options).map((entry) => entry.index);
}

/**
 * The patch that takes the current record for a stale copy, or undefined when no current record is registered: the copy replaced by the
 * current record and each pin of a slide on it renamed to the region's 0.35 name; for a removed layout, its slides moved to the layout
 * that replaced it (and its title position), their pins renamed, the copy dropped and the replacement embedded where the group lacks it.
 */
export function staleCopyPatch(document: unknown, copy: StaleLayoutCopy, options: CatalogOptions = {}): JsonPatchOperation[] | undefined {
  const before = layoutRegionNames(embeddedLayouts(document, copy.group)[copy.id]);
  const using = slidesUsing(document, copy, options);
  if (copy.current) return [{ op: 'replace', path: copy.path, value: copy.current }, ...using.flatMap(({ index }) => pinOperations(document, index, copy.id, before, copy.current))];
  if (!copy.renamed) return undefined;
  const replacement = copy.renamed.current ?? embeddedLayouts(document, copy.group)[copy.renamed.id];
  const ops: JsonPatchOperation[] = [];
  for (const { index, reference } of using) {
    ops.push({ op: 'replace', path: pointer(['slides', index, 'layout']), value: renamedLayout('layouts', reference) ?? copy.renamed.id }, ...titlePositionOperations(document, index, copy.renamed.titlePosition));
    if (isRec(replacement)) ops.push(...pinOperations(document, index, copy.id, before, replacement));
  }
  return [...ops, ...droppedCopyOperations(document, copy)];
}

/** The fix of a stale copy (staleCopyPatch): `use-current-record`, or `rename-layout` for a removed layout; safe as safeToTake says. */
export function staleCopyFix(document: unknown, copy: StaleLayoutCopy, options: CatalogOptions = {}): FindingFix | undefined {
  const patch = staleCopyPatch(document, copy, options);
  if (!patch) return undefined;
  return copy.renamed
    ? { id: 'rename-layout', title: `Use layout ${copy.renamed.id} and drop the old copy of ${copy.id}`, kind: 'patch', safe: safeToTake(copy), patch }
    : { id: 'use-current-record', title: `Take the current ${copy.id} record`, kind: 'patch', safe: safeToTake(copy), patch };
}

const applyOperation = (root: Rec, operation: JsonPatchOperation): void => {
  const segmentsOf = (path: string) => path.slice(1).split('/').map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
  const parentOf = (segments: string[]) => segments.slice(0, -1).reduce<unknown>((node, segment) => (node as Record<string, unknown>)[segment], root) as Record<string, unknown>;
  const segments = segmentsOf(operation.path);
  if (operation.op === 'move') {
    const from = segmentsOf(operation.from);
    const value = parentOf(from)[from.at(-1)!];
    delete parentOf(from)[from.at(-1)!];
    parentOf(segments)[segments.at(-1)!] = value;
  } else if (operation.op === 'remove') delete parentOf(segments)[segments.at(-1)!];
  else if (operation.op === 'add' || operation.op === 'replace') parentOf(segments)[segments.at(-1)!] = structuredClone(operation.value);
};

/**
 * The copy converted by the safe fixes of its schema findings (removedKeyRepair: `use-max-1`, `remove:listColumns`, `use-arrangement`,
 * ...), when they make it valid; undefined when one of its errors has no safe fix. The copy keeps its drawing and its region names.
 */
function convertedCopy(document: unknown, copy: StaleLayoutCopy): Rec | undefined {
  const holder: Rec = { catalogs: { [copy.group]: { layouts: { [copy.id]: structuredClone(embeddedLayouts(document, copy.group)[copy.id]) } } } };
  for (let round = 0; round < 8; round++) {
    const record = embeddedLayouts(holder, copy.group)[copy.id];
    const issues = layoutRecordIssues(copy.id, record);
    if (!issues.length) return rec(record);
    const fixes = issues.map((issue) => removedKeyRepair({ ruleId: 'opf/catalog-record', path: `${copy.path}${issue.path}`, validation: issue } as unknown as Finding, holder)?.fixes.find((fix) => fix.safe));
    if (fixes.some((fix) => fix?.kind !== 'patch')) return undefined;
    for (const fix of fixes) for (const operation of (fix as { patch: JsonPatchOperation[] }).patch) applyOperation(holder, operation);
  }
  return undefined;
}

/** One stale copy `embed` made valid (refreshStaleLayouts). */
export interface RefreshedRecord {
  group: string;
  kind: 'layouts';
  id: string;
  source?: string;
  /**
   * `current`: replaced by the current record (an unedited copy of the 0.34 release); `converted`: kept, with the safe fix of each removed
   * key applied (it draws as before); `renamed`: a layout 0.35 removed, its slides moved to `renamedTo` and the copy dropped.
   */
  how: 'current' | 'converted' | 'renamed';
  renamedTo?: string;
  /** JSON Pointers of the slide layouts and block pins rewritten so that every slide keeps its layout and every block its region. */
  references: string[];
}

/**
 * Make every embedded copy of a built-in layout record from before OPF 0.35 that fails the layout schema valid, in place, without
 * changing what it draws: an unedited copy of the 0.34 release takes the current record (its slides' pins renamed to the 0.35 regions), a
 * copy of a layout 0.35 removed moves its slides to the replacement (when unedited and the replacement is registered), and any other copy
 * gets the safe fix of each removed key when that makes it valid. A copy that stays invalid, and the deck's own records
 * (`catalogs.custom`), are kept as they are. Returns what changed. `embed` calls it before embedding.
 */
export function refreshStaleLayouts(document: Rec, options: CatalogOptions = {}): RefreshedRecord[] {
  const refreshed: RefreshedRecord[] = [];
  for (const [group, value] of Object.entries(rec(document.catalogs))) {
    if (group === 'custom' || !isRec(value) || !isRec(value.layouts)) continue;
    for (const [id, record] of Object.entries(value.layouts)) {
      if (!layoutRecordIssues(id, record).length) continue;
      const copy = staleLayoutCopy(document, group, id, options);
      if (!copy) continue;
      const source = catalogGroupSource(document, group, options);
      const entry = { group, kind: 'layouts' as const, id, ...(source !== undefined ? { source } : {}) };
      const patch = safeToTake(copy) && (copy.current || copy.renamed?.current) ? staleCopyPatch(document, copy, options) : undefined;
      if (patch) {
        for (const operation of patch) applyOperation(document, operation);
        refreshed.push({ ...entry, how: copy.renamed ? 'renamed' : 'current', ...(copy.renamed ? { renamedTo: copy.renamed.id } : {}), references: patch.filter((operation) => operation.path.startsWith('/slides/')).map((operation) => operation.path) });
        continue;
      }
      const converted = convertedCopy(document, copy);
      if (!converted) continue;
      (value.layouts as Rec)[id] = converted;
      refreshed.push({ ...entry, how: 'converted', references: [] });
    }
  }
  return refreshed;
}

/** For a layout reference, the bare built-in id it names in `default` (a bare id or `default:`), if any. */
export function builtinLayoutId(reference: unknown): string | undefined {
  const parsed = parseReference(reference);
  return parsed && (parsed.group === undefined || parsed.group === 'default') ? parsed.id : undefined;
}
