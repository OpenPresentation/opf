import {
  catalogGroupDeclared,
  catalogGroupSource,
  catalogKinds,
  catalogReferenceSites,
  embeddedCopy,
  parseReference,
  recordReferenceSites,
  registeredCatalog,
  resolveReference,
  unresolvedReference,
  dottedPath,
  type Catalog,
  type CatalogKind,
  type CatalogOptions,
  type CatalogReferenceSite,
  type UnresolvedReferenceDiagnostic,
} from './catalog-refs.js';
import { hostCatalogs } from './host-catalogs.js';
import type { Presentation } from './types.js';

/**
 * The authoring helpers of OPF 0.15 catalogs (FA-20): embed what a document uses, copy slides between documents
 * with their records, and compare embedded records with a catalog's current ones. Catalog-free and pure: inputs are
 * never mutated, nothing is fetched.
 */

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value);
const rec = (value: unknown): Rec => (isRec(value) ? value : {});

/** Canonical JSON (sorted keys) for comparing records by content. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRec(value))
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
/** Whether two records have the same content once embedded (`$schema`, `id` and `x-*` ignored). */
export function sameRecord(a: unknown, b: unknown): boolean {
  return canonical(embeddedCopy(a)) === canonical(embeddedCopy(b));
}

function setAt(root: Rec, path: readonly (string | number)[], value: unknown): void {
  let node: unknown = root;
  for (const part of path.slice(0, -1)) node = (node as Record<string | number, unknown>)[part];
  (node as Record<string | number, unknown>)[path[path.length - 1] as string | number] = value;
}
const kindsOf = (group: Rec, kind: CatalogKind): Rec => {
  if (!isRec(group[kind])) group[kind] = {};
  return group[kind] as Rec;
};

// ------------------------------------------------------------------------------------------------------------ embed

/** One record `embed` or `copySlides` added to a document. */
export interface EmbeddedRecord {
  group: string;
  kind: CatalogKind;
  id: string;
  source?: string;
}
export interface EmbedResult {
  document: Presentation;
  /** The records added, in the order they were embedded. */
  added: EmbeddedRecord[];
  /** The references that resolve nowhere: they stay as written. */
  unresolved: UnresolvedReferenceDiagnostic[];
}

/**
 * Embed every record the document references, once, in the group it resolves in, together with the records those
 * records reference (a theme's colour and font schemes). A bare id that resolves in the host's default catalog is
 * embedded under `catalogs.default` (whose `source` is set to that catalog's). Records already embedded are kept as
 * they are; catalog display metadata (`x-*`), `$schema` and `id` are stripped from the copies. Idempotent.
 */
export function embed(document: unknown, options: CatalogOptions = {}): EmbedResult {
  const out = structuredClone(rec(document)) as Rec;
  const catalogs = hostCatalogs(options);
  const added: EmbeddedRecord[] = [];
  const unresolved: UnresolvedReferenceDiagnostic[] = [];
  const queue: CatalogReferenceSite[] = catalogReferenceSites(out);
  const reported = new Set<string>();
  while (queue.length) {
    const site = queue.shift() as CatalogReferenceSite;
    const parsed = parseReference(site.reference);
    if (parsed?.group !== undefined && !catalogGroupDeclared(out, parsed.group)) continue; // a validation error, not a record to embed
    const found = resolveReference(out, site.kind, site.reference, { ...catalogs, ...(site.group !== undefined ? { group: site.group } : {}) });
    if (!found) {
      const path = dottedPath(site.path);
      if (!reported.has(path)) {
        reported.add(path);
        unresolved.push(unresolvedReference(out, site.kind, site.reference, path, catalogs));
      }
      continue;
    }
    if (found.origin === 'document') continue;
    if (!isRec(out.catalogs)) out.catalogs = {};
    const groups = out.catalogs as Rec;
    if (!isRec(groups[found.group])) groups[found.group] = {};
    const group = groups[found.group] as Rec;
    if (found.group !== 'custom' && typeof group.source !== 'string' && found.source !== undefined) {
      // The source goes first, so a group reads as "this catalog, these records".
      const rest = { ...group };
      for (const key of Object.keys(group)) delete group[key];
      Object.assign(group, { source: found.source }, rest);
    }
    const copy = embeddedCopy(found.record);
    kindsOf(group, site.kind)[found.id] = copy;
    added.push({ group: found.group, kind: site.kind, id: found.id, ...(found.source !== undefined ? { source: found.source } : {}) });
    queue.push(...recordReferenceSites(site.kind, copy, ['catalogs', found.group, site.kind, found.id], found.group));
  }
  return { document: out as unknown as Presentation, added, unresolved };
}

// ------------------------------------------------------------------------------------------------------- copySlides

/** A copied record that did not keep its reference. */
export interface CopiedRecordRename {
  kind: CatalogKind;
  /** The reference in the source document. */
  from: string;
  /** The reference the copied slides use in the target. */
  to: string;
  /**
   * `custom-conflict`: the target's own record of that id differs (or the id is taken); `catalog-revision`: the target
   * holds a different revision of the same catalog record, so the incoming one moved to `custom`.
   */
  reason: 'custom-conflict' | 'catalog-revision';
}
export interface CopySlidesResult {
  /** The new target document; `to` is not mutated. */
  document: Presentation;
  /** Indexes of the copied slides in the target. */
  slides: number[];
  /** Every record that did not keep its reference, so an author can review it. */
  renamed: CopiedRecordRename[];
  /** Catalog groups the target did not have, added for the copied records. */
  addedGroups: { name: string; source?: string }[];
  /** Records added to the target. */
  added: EmbeddedRecord[];
  /** References of the copied slides that resolve nowhere in the source: copied as written. */
  unresolved: UnresolvedReferenceDiagnostic[];
}

/** A group name for a catalog source: the host name without `www.` and dots, or the package name. */
function groupNameFor(source: string): string {
  const base = source.startsWith('pkg:')
    ? source.slice(4).replace(/^@/, '').split('/').slice(0, 2).join('-')
    : (() => {
        try {
          return new URL(source).hostname.replace(/^www\./, '');
        } catch {
          return source;
        }
      })();
  const name = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-z]/.test(name) ? name : `catalog-${name || 'source'}`;
}

/**
 * Copy slides `indexes` of `from` to the end of `to` (or before `options.at`), with the records they reference.
 * Groups match by `source`, not by name: references are rewritten to the target's name for that source, and a missing
 * group is added (renamed when its name is taken). A record whose content the target already has is reused. A `custom`
 * record whose id the target uses for different content is renamed `<id>-2`. A catalog record whose revision differs
 * from the one the target resolves goes into `custom` as `<id>-2`, so the copied slides look the same, and is listed in
 * `renamed`.
 */
export function copySlides(from: unknown, to: unknown, indexes: readonly number[], options: CatalogOptions & { at?: number } = {}): CopySlidesResult {
  const source = rec(from);
  const target = structuredClone(rec(to)) as Rec;
  const catalogs = hostCatalogs(options);
  const sourceSlides = Array.isArray(source.slides) ? source.slides : [];
  const targetSlides = Array.isArray(target.slides) ? (target.slides as unknown[]) : [];
  for (const index of indexes)
    if (!Number.isInteger(index) || index < 0 || index >= sourceSlides.length) throw new RangeError(`Slide index ${String(index)} is outside the source presentation's ${sourceSlides.length} slides.`);
  const at = options.at ?? targetSlides.length;
  if (!Number.isInteger(at) || at < 0 || at > targetSlides.length) throw new RangeError(`Insertion index ${String(at)} is outside the target presentation's ${targetSlides.length + 1} positions.`);

  const renamed: CopiedRecordRename[] = [];
  const addedGroups: CopySlidesResult['addedGroups'] = [];
  const added: EmbeddedRecord[] = [];
  const unresolved: UnresolvedReferenceDiagnostic[] = [];
  const hadCatalogs = isRec(target.catalogs);
  const groups = (): Rec => {
    if (!isRec(target.catalogs)) target.catalogs = {};
    return target.catalogs as Rec;
  };
  /** Where a source record landed in the target: its group and id there. */
  const memo = new Map<string, { group: string; id: string }>();

  /** The target group that holds records of catalog `catalogSource`, creating it when the target has none. */
  const targetGroupFor = (catalogSource: string, sourceGroupName: string): string => {
    for (const [name, value] of Object.entries(rec(target.catalogs))) if (name !== 'custom' && isRec(value) && value.source === catalogSource) return name;
    if (rec(target.catalogs).default !== false && catalogGroupSource(target, 'default', catalogs) === catalogSource) return 'default';
    let name = sourceGroupName === 'default' || sourceGroupName === 'custom' ? groupNameFor(catalogSource) : sourceGroupName;
    for (let n = 2; catalogGroupDeclared(target, name) || name === 'default' || name === 'custom'; n++) name = `${sourceGroupName === 'default' ? groupNameFor(catalogSource) : sourceGroupName}-${n}`;
    groups()[name] = { source: catalogSource };
    addedGroups.push({ name, source: catalogSource });
    return name;
  };
  /** Whether a bare `id` already resolves in the target, in which case a new custom record must not take it. */
  const bareTaken = (kind: CatalogKind, id: string) => resolveReference(target, kind, id, catalogs) !== undefined;
  /** Add `record` to the target's custom group as `wanted` (or `wanted-2` and up; always suffixed when `renamed`), reusing an equal record. */
  const addCustom = (kind: CatalogKind, wanted: string, record: Rec, renamed = false): { id: string; reused: boolean } => {
    const custom = rec(rec(target.catalogs).custom);
    const existing = rec(custom[kind]);
    for (const [id, value] of Object.entries(existing)) if (((!renamed && id === wanted) || /^-\d+$/.test(id.slice(wanted.length))) && id.startsWith(wanted) && sameRecord(value, record)) return { id, reused: true };
    let n = renamed ? 2 : 1;
    let id = renamed ? `${wanted}-2` : wanted;
    while (Object.hasOwn(existing, id) || bareTaken(kind, id)) id = `${wanted}-${++n}`;
    if (!isRec(groups().custom)) groups().custom = {};
    kindsOf(groups().custom as Rec, kind)[id] = record;
    added.push({ group: 'custom', kind, id });
    return { id, reused: false };
  };
  /** The shortest reference that resolves to `group`/`id` in the target from a record in `holder` (or a slide). */
  const referenceTo = (kind: CatalogKind, group: string, id: string, holder?: string): string => {
    const found = resolveReference(target, kind, id, { ...catalogs, ...(holder !== undefined ? { group: holder } : {}) });
    return found && found.group === group && found.id === id ? id : `${group}:${id}`;
  };

  /** Copy the record `reference` names in the source (written in a record of group `holder`, or on a slide) and say where it landed in the target. */
  const place = (kind: CatalogKind, reference: string, path: string, holder?: string): { group: string; id: string } | undefined => {
    const found = resolveReference(source, kind, reference, { ...catalogs, ...(holder !== undefined ? { group: holder } : {}) });
    if (!found) {
      unresolved.push(unresolvedReference(source, kind, reference, path, catalogs));
      return undefined;
    }
    const key = `${kind}\u0000${found.group}\u0000${found.source ?? ''}\u0000${found.id}`;
    const known = memo.get(key);
    if (known) return known;
    const incoming = embeddedCopy(found.record);
    const catalogSource = found.group === 'custom' ? undefined : found.source;
    const group = catalogSource === undefined ? 'custom' : targetGroupFor(catalogSource, found.group);
    // The records this one references land first; their references are written for the group this record lands in.
    const inner = recordReferenceSites(kind, incoming, []).map((site) => ({ site, placed: place(site.kind, site.reference, `${path} -> ${site.path.join('.')}`, found.group) }));
    const rewrite = (holderGroup: string) => {
      const copy = structuredClone(incoming);
      for (const { site, placed } of inner) if (placed) setAt(copy, site.path, referenceTo(site.kind, placed.group, placed.id, holderGroup));
      return copy;
    };
    let placed: { group: string; id: string };
    if (group === 'custom') {
      const result = addCustom(kind, found.id, rewrite('custom'));
      if (result.id !== found.id) renamed.push({ kind, from: reference, to: result.id, reason: 'custom-conflict' });
      placed = { group: 'custom', id: result.id };
    } else {
      const record = rewrite(group);
      const embedded = rec(rec(rec(target.catalogs)[group])[kind]);
      const current = Object.hasOwn(embedded, found.id) ? embedded[found.id] : registeredCatalog(catalogGroupSource(target, group, catalogs), catalogs)?.[kind]?.[found.id];
      if (current === undefined || sameRecord(current, record)) {
        if (!Object.hasOwn(embedded, found.id)) {
          kindsOf(groups()[group] as Rec, kind)[found.id] = record;
          added.push({ group, kind, id: found.id, ...(catalogSource !== undefined ? { source: catalogSource } : {}) });
        }
        placed = { group, id: found.id };
      } else {
        // `<id>-2` and up: the target keeps its own revision under the plain id.
        const { id } = addCustom(kind, found.id, rewrite('custom'), true);
        renamed.push({ kind, from: reference, to: id, reason: 'catalog-revision' });
        placed = { group: 'custom', id };
      }
    }
    memo.set(key, placed);
    return placed;
  };

  const copied: unknown[] = [];
  for (const index of indexes) {
    const slide = structuredClone(sourceSlides[index]);
    const holder = { slides: [slide] };
    for (const site of catalogReferenceSites(holder, { records: false })) {
      const placed = place(site.kind, site.reference, `slides.${index}.${site.path.slice(2).join('.')}`);
      if (placed) setAt(holder as unknown as Rec, site.path, referenceTo(site.kind, placed.group, placed.id));
    }
    copied.push(holder.slides[0]);
  }
  targetSlides.splice(at, 0, ...copied);
  target.slides = targetSlides;
  if (!hadCatalogs && isRec(target.catalogs) && Object.keys(target.catalogs).length === 0) delete target.catalogs;
  return { document: target as unknown as Presentation, slides: copied.map((_, offset) => at + offset), renamed, addedGroups, added, unresolved };
}

// ------------------------------------------------------------------------------------------------ updateFromCatalog

/** A reference to update, by kind: `two-column` (a default record) or `acme:hero`. */
export interface CatalogRef {
  kind: CatalogKind;
  reference: string;
}
/** One embedded record whose registered catalog publishes different content. */
export interface CatalogRecordChange {
  kind: CatalogKind;
  /** The reference that names it: a bare id for `default`, `name:id` otherwise. */
  reference: string;
  group: string;
  id: string;
  source: string;
  /** The record as the document embeds it. */
  embedded: Record<string, unknown>;
  /** The catalog's current record, as it would be embedded. */
  current: Record<string, unknown>;
}
/** An RFC 6902 operation of `CatalogUpdate.patch`. */
export interface CatalogPatchOperation {
  op: 'replace';
  path: string;
  value: Record<string, unknown>;
}
/** A reviewable update: nothing is applied until the author applies `patch` (core `applyPatch`). */
export interface CatalogUpdate {
  changes: CatalogRecordChange[];
  patch: CatalogPatchOperation[];
}

const pointerPart = (part: string) => part.replaceAll('~', '~0').replaceAll('/', '~1');

/**
 * Compare the records a document embeds under `default` and its named groups with the current records of the catalogs
 * registered for their sources. Returns the differences and the patch that would adopt them; never changes the document.
 * `refs` limits the check to those references. `custom` records belong to the document and are never compared.
 */
export function updateFromCatalog(document: unknown, catalogs: readonly Catalog[], refs?: readonly CatalogRef[]): CatalogUpdate {
  const groups = rec(rec(document).catalogs);
  const options: CatalogOptions = { catalogs };
  const wanted = refs?.map((ref) => {
    const parsed = parseReference(ref.reference);
    return parsed ? { kind: ref.kind, group: parsed.group ?? 'default', id: parsed.id } : undefined;
  });
  const changes: CatalogRecordChange[] = [];
  for (const [group, value] of Object.entries(groups)) {
    if (group === 'custom' || !isRec(value)) continue;
    const catalogSource = catalogGroupSource(document, group, options);
    const registered = registeredCatalog(catalogSource, options);
    if (!registered || catalogSource === undefined) continue;
    for (const kind of catalogKinds)
      for (const [id, embedded] of Object.entries(rec(value[kind]))) {
        if (wanted && !wanted.some((entry) => entry && entry.kind === kind && entry.group === group && entry.id === id)) continue;
        const current = registered[kind]?.[id];
        if (current === undefined || sameRecord(embedded, current)) continue;
        changes.push({ kind, reference: group === 'default' ? id : `${group}:${id}`, group, id, source: catalogSource, embedded: rec(embedded), current: embeddedCopy(current) });
      }
  }
  return {
    changes,
    patch: changes.map((change) => ({ op: 'replace', path: `/catalogs/${pointerPart(change.group)}/${change.kind}/${pointerPart(change.id)}`, value: change.current })),
  };
}
