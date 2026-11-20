/**
 * OPF 0.15 content references and their one resolution rule (FA-20). Catalog-free: this module reads the document's
 * own `catalogs` groups and the catalogs a host registers, never any bundled data, and it never fetches.
 *
 * A reference is a bare `id` or `name:id`. A bare id resolves in `catalogs.custom`, then in the records embedded
 * under `catalogs.default`, then in the registered catalog for `default.source` (the first registered catalog when
 * the document omits `default`; nothing when `default` is false). `name:id` resolves in `catalogs.<name>`, then in
 * the registered catalog for its source. A reference written inside an embedded record resolves in that record's
 * own group first.
 */

import type { IconSetLoader } from './icons.js';

/** The content kinds a catalog group holds, keyed by id. */
export const catalogKinds = ['layouts', 'themes', 'colorSchemes', 'fontSchemes', 'narratives', 'audiences', 'purposes', 'tones'] as const;
export type CatalogKind = (typeof catalogKinds)[number];

/** A content reference: a bare id or `name:id`. */
export const CATALOG_REFERENCE_PATTERN = /^(?:([a-z][a-z0-9-]*):)?([a-z][a-z0-9-]*)$/;
/** A catalog group name. `default` and `custom` are reserved. */
export const CATALOG_GROUP_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Records of one kind, keyed by id. */
export type CatalogRecordMap = Readonly<Record<string, Readonly<Record<string, unknown>>>>;
/** A catalog's records by kind, then by id: the shape of a document's `catalogs.<group>` without `source`. */
export type CatalogRecords = { readonly [K in CatalogKind]?: CatalogRecordMap };
/** A catalog a host registers. `source` is matched against `catalogs.<group>.source`. */
export interface Catalog extends CatalogRecords {
  /** The catalog's identity: an HTTPS URL or a `pkg:` reference. Never fetched. */
  readonly source: string;
  /**
   * LH-14: the icon sets an `icon` names as `<set>:<name>`, by set id: each the set's record (opf-icon-set/v1 without `$schema`
   * and `id`), or a function that loads it (`galleryIconSets()` of @openpresentation/gallery/icon-sets: `ensureIcons` calls it with
   * `{ icons: [names] }`, the icons a deck draws, and the gallery reads only those; a search asks `{ tags: true }`). See icons.ts.
   */
  readonly iconSets?: Readonly<Record<string, Readonly<Record<string, unknown>> | IconSetLoader>>;
}
/** The one option every entry point that resolves references accepts. */
export interface CatalogOptions {
  /**
   * Catalogs the host registered, matched by `source`. The first is the host default: bare ids use it when the
   * document omits `catalogs.default`. Omitted or empty: only the records the document embeds resolve.
   */
  catalogs?: readonly Catalog[];
}

/** A reference that resolved. */
export interface ResolvedReference {
  kind: CatalogKind;
  /** The reference as written. */
  reference: string;
  /** The record's key. */
  id: string;
  /** The group it resolved in: `custom`, `default` or a named group. */
  group: string;
  /** That group's source (the host default's source for an omitted `default`). */
  source?: string;
  /** `document` when the record is embedded, `host` when it came from a registered catalog. */
  origin: 'document' | 'host';
  record: Record<string, unknown>;
}

/**
 * Where a resolved record came from, without the record itself: what an engine records as provenance
 * (`resolveSlideContext().resolved.provenance`, `resolveDesignRecords().provenance`).
 */
export type RecordProvenance = Omit<ResolvedReference, 'record'>;

/** The provenance of a resolved reference. */
export function provenanceOf(found: ResolvedReference): RecordProvenance {
  const { record: _record, ...provenance } = found;
  return provenance;
}

/** Reported when a reference resolves nowhere. Never thrown, except under `strictReferences`. */
export interface UnresolvedReferenceDiagnostic {
  code: 'unresolved-reference';
  kind: CatalogKind;
  /** The reference as written, such as `acme:hero`. */
  reference: string;
  /** Where it is written, dotted: `slides.3.layout`, `design.theme`, `catalogs.acme.themes.brand.colorScheme`. */
  path: string;
  /** The group the reference names: its prefix, or `default` for a bare id. */
  group: string;
  /** That group's source, when one is known. */
  source?: string;
  /** What the engine uses instead: automatic composition (layouts) or the engine default record. */
  fallback: 'automatic' | 'engine-default';
  message: string;
}

/** Thrown by `resolveSlideContext` and `paginate` under `strictReferences` when a reference resolves nowhere. */
/**
 * Thrown by every entry point that takes the `catalogs` option when it is not an array of registered catalogs
 * (`{ source: string, <kind>: { <id>: record } }` with known kinds). `code` is always `invalid-catalogs`.
 */
export class OPFCatalogsOptionError extends TypeError {
  readonly code = 'invalid-catalogs';
  constructor(entry: string, detail: string) {
    super(`${entry}: the catalogs option must be an array of registered catalogs ({ source, <kind>: { <id>: record } } with known catalog kinds); ${detail}.`);
    this.name = 'OPFCatalogsOptionError';
  }
}

/** Check a `catalogs` option (undefined means none registered) and return the registered catalogs. Throws OPFCatalogsOptionError. */
export function checkCatalogsOption(catalogs: unknown, entry: string): readonly Catalog[] {
  if (catalogs === undefined) return [];
  if (!Array.isArray(catalogs)) throw new OPFCatalogsOptionError(entry, `got ${catalogs === null ? 'null' : typeof catalogs}`);
  catalogs.forEach((catalog, index) => {
    if (!isRec(catalog) || typeof catalog.source !== 'string') throw new OPFCatalogsOptionError(entry, `catalogs[${index}] is not an object with a string source`);
    for (const [kind, records] of Object.entries(catalog)) {
      if (kind === 'source') continue;
      // LH-14: a registered icon set is its record or a function that loads it.
      if (kind === 'iconSets') {
        if (!isRec(records) || Object.values(records).some((set) => typeof set !== 'function' && !isRec(set))) throw new OPFCatalogsOptionError(entry, `catalogs[${index}].iconSets is not an object of icon-set records or loaders keyed by id`);
        continue;
      }
      if (!(catalogKinds as readonly string[]).includes(kind)) throw new OPFCatalogsOptionError(entry, `catalogs[${index}].${kind} is not a catalog kind`);
      if (!isRec(records)) throw new OPFCatalogsOptionError(entry, `catalogs[${index}].${kind} is not an object of records keyed by id`);
    }
  });
  return catalogs as readonly Catalog[];
}

export class OPFUnresolvedReferenceError extends Error {
  readonly diagnostics: UnresolvedReferenceDiagnostic[];
  constructor(diagnostics: UnresolvedReferenceDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join(' '));
    this.name = 'OPFUnresolvedReferenceError';
    this.diagnostics = diagnostics;
  }
}

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value);
const rec = (value: unknown): Rec => (isRec(value) ? value : {});
const own = (value: Rec, key: string) => Object.hasOwn(value, key);

/** Split a reference into its group prefix and id; undefined for anything that is not a reference. */
export function parseReference(reference: unknown): { group?: string; id: string } | undefined {
  if (typeof reference !== 'string') return undefined;
  const match = CATALOG_REFERENCE_PATTERN.exec(reference);
  if (!match) return undefined;
  const [, group, id] = match;
  return group === undefined ? { id: id as string } : { group, id: id as string };
}

/** The document's `catalogs` object, or an empty one. */
function groupsOf(document: unknown): Rec {
  return rec(rec(document).catalogs);
}

/** Whether the document declares the group `name` (an object; `default: false` counts as declared and empty). */
export function catalogGroupDeclared(document: unknown, name: string): boolean {
  const groups = groupsOf(document);
  return own(groups, name) && (isRec(groups[name]) || (name === 'default' && groups[name] === false));
}

/**
 * The source of group `name` as resolution uses it: the group's own `source`, or for an omitted (or source-less)
 * `default` the first registered catalog's source. Undefined for `custom`, for `default: false` and for an
 * undeclared named group.
 */
export function catalogGroupSource(document: unknown, name: string, options: CatalogOptions = {}): string | undefined {
  if (name === 'custom') return undefined;
  const group = groupsOf(document)[name];
  if (name === 'default') {
    if (group === false) return undefined;
    const source = rec(group).source;
    return typeof source === 'string' ? source : options.catalogs?.[0]?.source;
  }
  const source = rec(group).source;
  return typeof source === 'string' ? source : undefined;
}

/** The registered catalog for `source`, if any. */
export function registeredCatalog(source: string | undefined, options: CatalogOptions = {}): Catalog | undefined {
  if (source === undefined) return undefined;
  return options.catalogs?.find((catalog) => catalog?.source === source);
}

/** Look `id` up in one group: its embedded records, then the registered catalog for its source. */
export function lookupInGroup(document: unknown, kind: CatalogKind, group: string, id: string, reference: string, options: CatalogOptions = {}): ResolvedReference | undefined {
  const groups = groupsOf(document);
  if (group === 'default' && groups.default === false) return undefined;
  if (group !== 'default' && group !== 'custom' && !isRec(groups[group])) return undefined;
  const source = catalogGroupSource(document, group, options);
  const embedded = rec(rec(groups[group])[kind]);
  if (own(embedded, id) && isRec(embedded[id])) {
    return { kind, reference, id, group, ...(source !== undefined ? { source } : {}), origin: 'document', record: embedded[id] as Rec };
  }
  if (group === 'custom') return undefined;
  const hosted = registeredCatalog(source, options)?.[kind];
  if (hosted && own(hosted as Rec, id) && isRec(hosted[id])) {
    return { kind, reference, id, group, ...(source !== undefined ? { source } : {}), origin: 'host', record: hosted[id] as Rec };
  }
  return undefined;
}

/**
 * Resolve one reference. `group` is the group of the record the reference is written in, which is searched first.
 * Undefined when the reference is malformed, names an undeclared group or resolves nowhere.
 */
export function resolveReference(document: unknown, kind: CatalogKind, reference: unknown, options: CatalogOptions & { group?: string } = {}): ResolvedReference | undefined {
  checkCatalogsOption(options.catalogs, 'resolveReference');
  const parsed = parseReference(reference);
  if (!parsed) return undefined;
  const written = reference as string;
  if (parsed.group !== undefined) return lookupInGroup(document, kind, parsed.group, parsed.id, written, options);
  const order = [...new Set([options.group, 'custom', 'default'].filter((group): group is string => typeof group === 'string'))];
  for (const group of order) {
    const found = lookupInGroup(document, kind, group, parsed.id, written, options);
    if (found) return found;
  }
  return undefined;
}

const KIND_NOUNS: Record<CatalogKind, string> = {
  layouts: 'Layout',
  themes: 'Theme',
  colorSchemes: 'Color scheme',
  fontSchemes: 'Font scheme',
  narratives: 'Narrative',
  audiences: 'Audience',
  purposes: 'Purpose',
  tones: 'Tone',
};

/** True for `layout: "auto"`, which OPF 0.35 removed: omitting `layout` is automatic composition. */
export const removedLayoutAuto = (kind: CatalogKind, reference: string): boolean => kind === 'layouts' && reference === 'auto';

/**
 * The gallery layouts OPF 0.35 removed, by the layout that replaced each: `process` draws a short list as `flow` did, and `agenda-split` is
 * `agenda` with `design.titlePosition: "start"` (titlePositionOfRenamedLayout).
 */
const RENAMED_LAYOUTS: Readonly<Record<string, string>> = Object.freeze({ flow: 'process', 'vertical-flow': 'vertical-process', 'agenda-split': 'agenda' });
/** The removed gallery layouts whose replacement draws them only with a title position the slide sets: `agenda-split` was `agenda` with its title beside. */
const RENAMED_TITLE_POSITIONS: Readonly<Record<string, 'start'>> = Object.freeze({ 'agenda-split': 'start' });

/**
 * The `design.titlePosition` a slide needs on the layout that replaced a removed gallery layout to draw as before: `start` for `agenda-split`
 * (bare or `default:`); undefined for any other reference.
 */
export function renamedLayoutTitlePosition(kind: CatalogKind, reference: string): 'start' | undefined {
  const parsed = kind === 'layouts' ? parseReference(reference) : undefined;
  if (!parsed || (parsed.group !== undefined && parsed.group !== 'default') || !Object.hasOwn(RENAMED_TITLE_POSITIONS, parsed.id)) return undefined;
  return RENAMED_TITLE_POSITIONS[parsed.id];
}

/**
 * The removed gallery layouts whose replacement can draw a slide differently (the fix `rename-layout` is marked `changesDrawing`): `agenda-split`
 * drew its title column at half the width, `agenda` with `titlePosition: "start"` at two fifths; `flow` drew any list as boxes joined by
 * arrows, `process` draws a list that Basic Process cannot hold at its size (entries of three or more words, more than 8) as numbered steps.
 * `vertical-flow` is `vertical-process` renamed and draws the same.
 */
const RENAMED_LAYOUTS_CHANGE_DRAWING: ReadonlySet<string> = new Set(['flow', 'agenda-split']);

/** Whether moving a slide from a gallery layout OPF 0.35 removed to its replacement (renamedLayout) can change how it draws. */
export function renamedLayoutChangesDrawing(kind: CatalogKind, reference: string): boolean {
  const parsed = kind === 'layouts' ? parseReference(reference) : undefined;
  return parsed !== undefined && (parsed.group === undefined || parsed.group === 'default') && RENAMED_LAYOUTS_CHANGE_DRAWING.has(parsed.id);
}

/**
 * The reference that replaced a bare or `default:` reference to a gallery layout OPF 0.35 removed (`flow` is `process`, `vertical-flow`
 * is `vertical-process`, `agenda-split` is `agenda`), with the same group prefix; undefined for any other reference.
 */
export function renamedLayout(kind: CatalogKind, reference: string): string | undefined {
  const parsed = kind === 'layouts' ? parseReference(reference) : undefined;
  if (!parsed || (parsed.group !== undefined && parsed.group !== 'default') || !Object.hasOwn(RENAMED_LAYOUTS, parsed.id)) return undefined;
  return `${parsed.group !== undefined ? 'default:' : ''}${RENAMED_LAYOUTS[parsed.id]}`;
}

/** The diagnostic for a reference that resolves nowhere, naming the reference and the source it was looked for in. */
export function unresolvedReference(document: unknown, kind: CatalogKind, reference: string, path: string, options: CatalogOptions = {}): UnresolvedReferenceDiagnostic {
  const parsed = parseReference(reference);
  const group = parsed?.group ?? 'default';
  const source = catalogGroupSource(document, group, options);
  const noun = KIND_NOUNS[kind];
  const where = parsed?.group !== undefined && !catalogGroupDeclared(document, parsed.group)
    ? `the document declares no catalogs.${parsed.group} group`
    : group === 'custom'
      ? 'it is not in catalogs.custom'
      : group === 'default' && groupsOf(document).default === false
        ? 'it is not in catalogs.custom and catalogs.default is false'
        : source === undefined
          ? `it is not embedded in catalogs.${group === 'default' ? 'custom or catalogs.default' : group} and no catalog is registered for it`
          : `it is not embedded in catalogs.${group === 'default' ? 'custom or catalogs.default' : group} and the catalog registered for ${source} ${registeredCatalog(source, options) ? 'has no such record' : 'is not registered'}`;
  const fallback = kind === 'layouts' ? 'automatic' : 'engine-default';
  // OPF 0.35 removed `layout: "auto"`: it is an ordinary reference now, and the message says what replaced it.
  const renamed = renamedLayout(kind, reference), position = renamedLayoutTitlePosition(kind, reference);
  const removed = removedLayoutAuto(kind, reference)
    ? `OPF 0.35 removed layout 'auto' (omit layout for automatic composition)`
    : renamed !== undefined
      ? `OPF 0.35 removed layout '${reference}' (use '${renamed}'${position ? ` with design.titlePosition '${position}'` : ''})`
      : where;
  return {
    code: 'unresolved-reference',
    kind,
    reference,
    path,
    group,
    ...(source !== undefined ? { source } : {}),
    fallback,
    message: `${noun} '${reference}' resolves nowhere: ${removed}; ${fallback === 'automatic' ? 'the slide composes automatically' : 'the engine default is used'}.`,
  };
}

/** One place a document writes a content reference. */
export interface CatalogReferenceSite {
  kind: CatalogKind;
  /** The reference as written. */
  reference: string;
  /** JSON Pointer segments of the string. */
  path: readonly (string | number)[];
  /** For a reference written inside an embedded record: that record's group, searched first. */
  group?: string;
}

const pushReference = (sites: CatalogReferenceSite[], kind: CatalogKind, value: unknown, path: (string | number)[], group?: string) => {
  if (typeof value === 'string' && parseReference(value)) sites.push({ kind, reference: value, path, ...(group !== undefined ? { group } : {}) });
};
/** A string reference, or the `id` of an object reference. */
const pushObjectReference = (sites: CatalogReferenceSite[], kind: CatalogKind, value: unknown, path: (string | number)[], group?: string) => {
  if (typeof value === 'string') pushReference(sites, kind, value, path, group);
  else if (isRec(value)) pushReference(sites, kind, value.id, [...path, 'id'], group);
};
function designSites(sites: CatalogReferenceSite[], design: unknown, path: (string | number)[]) {
  if (!isRec(design)) return;
  pushReference(sites, 'themes', design.theme, [...path, 'theme']);
  pushObjectReference(sites, 'colorSchemes', design.colorScheme, [...path, 'colorScheme']);
  pushObjectReference(sites, 'fontSchemes', design.fontScheme, [...path, 'fontScheme']);
}

function languageSites(sites: CatalogReferenceSite[], language: unknown, path: (string | number)[]) {
  if (!isRec(language)) return;
  pushReference(sites, 'fontSchemes', language.fontScheme, [...path, 'fontScheme']);
  pushReference(sites, 'fontSchemes', language.googleFontScheme, [...path, 'googleFontScheme']);
}

/** The references written inside one embedded or registered record, resolved in `group` first. */
export function recordReferenceSites(kind: CatalogKind, record: unknown, path: (string | number)[], group?: string): CatalogReferenceSite[] {
  const sites: CatalogReferenceSite[] = [];
  if (kind === 'themes' && isRec(record)) {
    pushObjectReference(sites, 'colorSchemes', record.colorScheme, [...path, 'colorScheme'], group);
    pushObjectReference(sites, 'fontSchemes', record.fontScheme, [...path, 'fontScheme'], group);
  }
  return sites;
}

/**
 * Every content reference a document writes, in document order: the root narrative, audience, purpose and tone, the
 * deck and slide languages' font schemes, their designs, each slide's layout, and (with `records`) the references
 * inside embedded records. Free-form audience and purpose text is not a reference and is not listed.
 */
export function catalogReferenceSites(document: unknown, options: { records?: boolean; slides?: boolean } = {}): CatalogReferenceSite[] {
  const deck = rec(document);
  const sites: CatalogReferenceSite[] = [];
  pushReference(sites, 'narratives', deck.narrative, ['narrative']);
  if (Array.isArray(deck.audience)) deck.audience.forEach((entry, index) => {
    pushObjectReference(sites, 'audiences', entry, ['audience', index]);
  });
  else pushObjectReference(sites, 'audiences', deck.audience, ['audience']);
  pushObjectReference(sites, 'purposes', deck.purpose, ['purpose']);
  pushObjectReference(sites, 'tones', deck.tone, ['tone']);
  languageSites(sites, deck.language, ['language']);
  designSites(sites, deck.design, ['design']);
  if (options.slides !== false && Array.isArray(deck.slides))
    deck.slides.forEach((slide, index) => {
      if (!isRec(slide)) return;
      pushReference(sites, 'layouts', slide.layout, ['slides', index, 'layout']);
      languageSites(sites, slide.language, ['slides', index, 'language']);
      designSites(sites, slide.design, ['slides', index, 'design']);
    });
  if (options.records !== false)
    for (const [group, value] of Object.entries(groupsOf(document))) {
      if (!isRec(value)) continue;
      for (const kind of catalogKinds)
        for (const [id, record] of Object.entries(rec(value[kind]))) sites.push(...recordReferenceSites(kind, record, ['catalogs', group, kind, id], group));
    }
  return sites;
}

/** A dotted path (`slides.3.layout`) for a JSON Pointer segment list. */
export const dottedPath = (path: readonly (string | number)[]) => path.join('.');
/** A JSON Pointer for a segment list. */
export const pointerPath = (path: readonly (string | number)[]) =>
  path.length ? `/${path.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}` : '';

/** Records a picker can offer for `kind`: the document's embedded records, then those of the registered catalogs its groups name, with the reference to write for each. */
export function catalogRecords(document: unknown, kind: CatalogKind, options: CatalogOptions = {}): ResolvedReference[] {
  checkCatalogsOption(options.catalogs, 'catalogRecords');
  const result: ResolvedReference[] = [];
  const seen = new Set<string>();
  const add = (entry: ResolvedReference) => {
    if (seen.has(entry.reference)) return;
    seen.add(entry.reference);
    result.push(entry);
  };
  const groups = groupsOf(document);
  const names = [...new Set(['custom', 'default', ...Object.keys(groups)])];
  for (const group of names) {
    if (group === 'default' && groups.default === false) continue;
    if (group !== 'custom' && group !== 'default' && !isRec(groups[group])) continue;
    const prefix = group === 'custom' || group === 'default' ? '' : `${group}:`;
    for (const id of Object.keys(rec(rec(groups[group])[kind]))) {
      const found = lookupInGroup(document, kind, group, id, `${prefix}${id}`, options);
      if (found) add(found);
    }
    if (group === 'custom') continue;
    const hosted = registeredCatalog(catalogGroupSource(document, group, options), options)?.[kind];
    for (const id of Object.keys(hosted ?? {})) {
      const found = lookupInGroup(document, kind, group, id, `${prefix}${id}`, options);
      if (found) add(found);
    }
  }
  return result;
}

/** A record as a document embeds it: no `$schema`, `id` or `x-*` display metadata. */
export function embeddedCopy(record: unknown): Record<string, unknown> {
  return Object.fromEntries(Object.entries(rec(record)).filter(([key]) => key !== '$schema' && key !== 'id' && !key.startsWith('x-')).map(([key, value]) => [key, structuredClone(value)]));
}

/**
 * Whether `candidate` is a plausible respelling of the unknown catalog id `reference`, for "did you mean": the two share a word of
 * three letters or more (`two-colum`, `two-column`), start with the same three letters (`tabel`, `table`), are the same letters in
 * another order (`cvoer`, `cover`), or share at least half their letter pairs (`taable`, `table`). An edit distance alone pointed a
 * title slide at `table` (`title`: two edits, one shared letter pair); those two share none of these, so `title` gets no suggestion.
 */
export function relatedName(reference: string, candidate: string): boolean {
  // A catalog group prefix (`acme:`) is not part of the name.
  const bare = (value: string) => value.slice(value.lastIndexOf(':') + 1).toLowerCase();
  const a = bare(reference), b = bare(candidate);
  if (a === b) return true;
  const words = (value: string) => value.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3);
  const other = new Set(words(b));
  if (words(a).some((word) => other.has(word))) return true;
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  if (prefix >= Math.min(3, a.length, b.length)) return true;
  if (a.length === b.length && [...a].sort().join('') === [...b].sort().join('')) return true;
  const pairs = (value: string) => Array.from({ length: Math.max(0, value.length - 1) }, (_, index) => value.slice(index, index + 2));
  const left = pairs(a), right = pairs(b), pool = [...right];
  let shared = 0;
  for (const pair of left) { const at = pool.indexOf(pair); if (at >= 0) { shared++; pool.splice(at, 1); } }
  return left.length + right.length > 0 && (2 * shared) / (left.length + right.length) >= 0.5;
}
