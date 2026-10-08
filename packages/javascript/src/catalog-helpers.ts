import {
  catalogGroupDeclared,
  catalogGroupSource,
  catalogKinds,
  CATALOG_GROUP_PATTERN,
  catalogReferenceSites,
  checkCatalogsOption,
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
  type ResolvedReference,
  type UnresolvedReferenceDiagnostic,
} from './catalog-refs.js';
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
  const catalogs = { catalogs: checkCatalogsOption(options.catalogs, 'embed') };
  const out = structuredClone(rec(document)) as Rec;
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
  /** Every record this call created under another id (`<id>-2` and up), so an author can review it. A reference rewritten to a record an earlier copy created, which this call reuses, is not a rename and is not listed. */
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
  const catalogs = { catalogs: checkCatalogsOption(options.catalogs, 'copySlides') };
  const source = rec(from);
  const target = structuredClone(rec(to)) as Rec;
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
      // A record an earlier copy already created (and this one reuses) is not a rename: only a record created under a new id is listed.
      if (result.id !== found.id && !result.reused) renamed.push({ kind, from: reference, to: result.id, reason: 'custom-conflict' });
      placed = { group: 'custom', id: result.id };
    } else {
      const record = rewrite(group);
      const embedded = rec(rec(rec(target.catalogs)[group])[kind]);
      const current = Object.hasOwn(embedded, found.id) ? embedded[found.id] : registeredCatalog(catalogGroupSource(target, group, catalogs), catalogs)?.[kind]?.[found.id];
      if (current === undefined || sameRecord(current, record)) {
        if (!Object.hasOwn(embedded, found.id)) {
          // An inherited default (the source document or the target omits catalogs.default) is written down with its source.
          if (!isRec(groups()[group])) groups()[group] = {};
          const holder = groups()[group] as Rec;
          if (typeof holder.source !== 'string' && catalogSource !== undefined) {
            const rest = { ...holder };
            for (const key of Object.keys(holder)) delete holder[key];
            Object.assign(holder, { source: catalogSource }, rest);
          }
          kindsOf(holder, kind)[found.id] = record;
          added.push({ group, kind, id: found.id, ...(catalogSource !== undefined ? { source: catalogSource } : {}) });
        }
        placed = { group, id: found.id };
      } else {
        // `<id>-2` and up: the target keeps its own revision under the plain id.
        const { id, reused } = addCustom(kind, found.id, rewrite('custom'), true);
        if (!reused) renamed.push({ kind, from: reference, to: id, reason: 'catalog-revision' });
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
  const options: CatalogOptions = { catalogs: checkCatalogsOption(catalogs, 'updateFromCatalog') };
  const groups = rec(rec(document).catalogs);
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

// ----------------------------------------------------------------------------------------------------- moveToCustom

/** Where a moved record was and where it is now. */
export interface MovedRecord {
  kind: CatalogKind;
  group: string;
  id: string;
  /** The reference that names it there: a bare id under `default` and `custom`, `name:id` in a named group. */
  reference: string;
}
/** Error codes of OPFMoveToCustomError. */
export type MoveToCustomErrorCode = 'invalid-reference' | 'already-custom' | 'not-embedded' | 'invalid-id';
export class OPFMoveToCustomError extends Error {
  readonly code: MoveToCustomErrorCode;
  constructor(code: MoveToCustomErrorCode, message: string) {
    super(message);
    this.name = 'OPFMoveToCustomError';
    this.code = code;
  }
}
/** An RFC 6902 operation of `MoveToCustomResult.patch`. */
export type MoveToCustomPatchOperation =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; value: string };
export interface MoveToCustomResult {
  /** The new document; the input is not mutated. */
  document: Presentation;
  from: MovedRecord;
  to: MovedRecord;
  /** The references rewritten to name the moved record, as JSON Pointers into the document. */
  references: string[];
  /** RFC 6902 operations that turn the input into `document` (apply with core `applyPatch`, for undo and review). */
  patch: MoveToCustomPatchOperation[];
  /** Present when `custom` already held a different record under the wanted id, so the record took `<id>-2` (and up). */
  renamed?: { from: string; to: string };
}

const pointerOf = (path: readonly (string | number)[]) => `/${path.map((part) => pointerPart(String(part))).join('/')}`;

/**
 * Move an embedded record from `catalogs.default` or a named group into `catalogs.custom`: the fix that
 * `opf/catalog-record-not-in-source` suggests for a record the group's catalog does not publish. Every reference that
 * resolved to the record (on slides, in the deck, inside other embedded records) is rewritten to name it in `custom`,
 * and the record's own references keep naming the records they named. The record keeps its id unless `custom` already
 * holds a different record under it, when it becomes `<id>-2` (and up); an identical custom record is reused.
 *
 * Fork: with `id`, the record is copied into `custom` under that id instead (an editor calls this on the first edit of a
 * record under `default` or a named group, then applies the edit to the copy). Every reference is rewritten to the copy,
 * so nothing references the original any more and it is dropped from its group. A different custom record under the
 * wanted id (the record's own, or `id`) makes it `<id>-2` and up, reported in `renamed`; an identical one is reused.
 *
 * Throws OPFMoveToCustomError (`invalid-reference`, `already-custom`, `not-embedded`, `invalid-id`).
 * Registered catalogs only matter for how the surrounding references resolve, so pass the host's `catalogs` as for
 * validate.
 */
export function moveToCustom(document: unknown, ref: CatalogRef, options: CatalogOptions & { id?: string } = {}): MoveToCustomResult {
  const catalogs = { catalogs: checkCatalogsOption(options.catalogs, 'moveToCustom') };
  const parsed = parseReference(ref.reference);
  if (!parsed || !(catalogKinds as readonly string[]).includes(ref.kind)) throw new OPFMoveToCustomError('invalid-reference', `moveToCustom: ${JSON.stringify(ref.reference)} is not a ${String(ref.kind)} reference (an id or name:id).`);
  const { kind } = ref;
  const fromGroup = parsed.group ?? 'default';
  if (fromGroup === 'custom') throw new OPFMoveToCustomError('already-custom', `moveToCustom: ${ref.reference} already names a record of catalogs.custom.`);
  const before = rec(document);
  const records = rec(rec(rec(before.catalogs)[fromGroup])[kind]);
  if (!Object.hasOwn(records, parsed.id)) throw new OPFMoveToCustomError('not-embedded', `moveToCustom: catalogs.${fromGroup}.${kind} does not embed ${JSON.stringify(parsed.id)}.`);
  const fromId = parsed.id;
  const record = rec(records[fromId]);

  // What every reference resolves to now, read before anything moves.
  const sites = catalogReferenceSites(before);
  const targets = sites.map((site) => resolveReference(before, site.kind, site.reference, { ...catalogs, ...(site.group !== undefined ? { group: site.group } : {}) }));
  const isMoved = (found: ResolvedReference | undefined) => found?.origin === 'document' && found.kind === kind && found.group === fromGroup && found.id === fromId;
  const inMoved = (site: CatalogReferenceSite) => site.path.length >= 4 && site.path[0] === 'catalogs' && site.path[1] === fromGroup && site.path[2] === kind && site.path[3] === fromId;

  const after = structuredClone(before) as Rec;
  const groups = after.catalogs as Rec;
  const custom = rec(groups.custom);
  const existing = rec(custom[kind]);
  // The moved record with its own references kept: each written so it names, from custom, what it named before.
  const moved = structuredClone(record);
  const ownSites = sites.map((site, index) => ({ site, found: targets[index] })).filter(({ site }) => inMoved(site));
  if (options.id !== undefined && (typeof options.id !== 'string' || !CATALOG_GROUP_PATTERN.test(options.id))) throw new OPFMoveToCustomError('invalid-id', `moveToCustom: the new id ${JSON.stringify(options.id)} is not a lowercase kebab-case id.`);
  const wanted = options.id ?? fromId;
  let toId = wanted;
  for (let n = 2; Object.hasOwn(existing, toId) && !sameRecord(existing[toId], moved); n++) toId = `${wanted}-${n}`;
  const reused = Object.hasOwn(existing, toId);

  // Remove the record, then add it to custom (creating the containers the patch needs).
  const patch: MoveToCustomPatchOperation[] = [];
  const fromRecords = (groups[fromGroup] as Rec)[kind] as Rec;
  delete fromRecords[fromId];
  patch.push({ op: 'remove', path: pointerOf(['catalogs', fromGroup, kind, fromId]) });
  if (Object.keys(fromRecords).length === 0) {
    delete (groups[fromGroup] as Rec)[kind];
    patch.push({ op: 'remove', path: pointerOf(['catalogs', fromGroup, kind]) });
  }
  if (!isRec(groups.custom)) {
    groups.custom = {};
    patch.push({ op: 'add', path: pointerOf(['catalogs', 'custom']), value: {} });
  }
  if (!isRec((groups.custom as Rec)[kind])) {
    (groups.custom as Rec)[kind] = {};
    patch.push({ op: 'add', path: pointerOf(['catalogs', 'custom', kind]), value: {} });
  }
  /** The shortest reference that names `group`/`id` in the new document, written in a record of `holder` (or a slide). */
  const referenceTo = (targetKind: CatalogKind, group: string, id: string, holder?: string): string => {
    const found = resolveReference(after, targetKind, id, { ...catalogs, ...(holder !== undefined ? { group: holder } : {}) });
    return found && found.group === group && found.id === id ? id : `${group}:${id}`;
  };
  if (!reused) {
    ((groups.custom as Rec)[kind] as Rec)[toId] = moved;
    for (const { site, found } of ownSites) {
      if (!found) continue;
      const target = isMoved(found) ? { group: 'custom', id: toId } : { group: found.group, id: found.id };
      setAt(moved, site.path.slice(4), referenceTo(site.kind, target.group, target.id, 'custom'));
    }
    patch.push({ op: 'add', path: pointerOf(['catalogs', 'custom', kind, toId]), value: structuredClone(moved) });
  }

  // Rewrite every other reference that named the moved record.
  const references: string[] = [];
  sites.forEach((site, index) => {
    if (inMoved(site) || !isMoved(targets[index])) return;
    const written = referenceTo(kind, 'custom', toId, site.group);
    if (written === site.reference) return;
    setAt(after, site.path, written);
    references.push(pointerOf(site.path));
    patch.push({ op: 'replace', path: pointerOf(site.path), value: written });
  });
  return {
    document: after as unknown as Presentation,
    from: { kind, group: fromGroup, id: fromId, reference: fromGroup === 'default' ? fromId : `${fromGroup}:${fromId}` },
    to: { kind, group: 'custom', id: toId, reference: toId },
    references,
    patch,
    ...(toId !== wanted ? { renamed: { from: wanted, to: toId } } : {}),
  };
}
