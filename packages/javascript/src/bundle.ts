import { bareIdPattern, isRecord, visitContentPayloads } from "./content-walk.js";
import { catalogEntries } from "./generated/catalogs.js";
import type { CatalogKind } from "./generated/catalogs.js";

/**
 * Local catalog vendoring: resolve every catalog reference a presentation
 * uses and inline the resolved records into `catalogs.<kind>.records`, so the
 * document renders identically with no catalog lookups beyond itself.
 *
 * Resolution is local-only: inline records are kept as-is, ids that belong to
 * a kind's custom `source` are left to that source, and everything else
 * resolves against the bundled default catalogs. Every reference a record
 * carries is chased in turn — whether the record came from the bundled
 * catalogs or was already inline — so no inlined record dangles. Running the
 * bundle twice is a no-op.
 */

export interface BundleReport {
  /** Record ids inlined by this run, per kind, in output order. */
  added: Partial<Record<CatalogKind, string[]>>;
  /** Referenced ids that were already inline in the document, per kind. */
  alreadyInline: Partial<Record<CatalogKind, string[]>>;
  /** Kinds left untouched because the document declares a custom source. */
  keptSources: CatalogKind[];
  /**
   * Referenced bare ids that resolve nowhere locally, per kind — listed for
   * exactly the positions the validator warns about, so `unresolved` means
   * "the validator would warn about this": the string shorthand of
   * `narrative`, the design references `themes`, `colorSchemes` and
   * `fontSchemes` (string or `{ id }` form, at deck and slide level), and
   * `chart.type`.
   *
   * Every other reference — tones, purposes, audiences, languages, layouts,
   * social platforms, object-form narratives, and anything reached through a
   * record rather than written by the author — is still resolved and inlined
   * when it is found, and skipped in silence when it is not, because the
   * validator does not warn there either.
   *
   * Informational: unknown ids are warnings, never errors.
   */
  unresolved: Partial<Record<CatalogKind, string[]>>;
}

export interface BundleResult {
  presentation: unknown;
  report: BundleReport;
}

/** One queued reference, processed exactly once per (kind, id). */
interface PendingReference {
  kind: CatalogKind;
  id: string;
}

/**
 * The collected references: a worklist of what is still to resolve, every
 * referenced id per kind for the report, and the `kind:id` keys the validator
 * would warn about when unknown.
 */
interface Collector {
  queue: PendingReference[];
  referenced: Map<CatalogKind, Set<string>>;
  reportable: Set<string>;
}

function reportKey(kind: CatalogKind, id: string): string {
  return `${kind}:${id}`;
}

function referenceId(value: unknown): string | undefined {
  if (typeof value === "string" && bareIdPattern.test(value)) return value;
  if (isRecord(value) && typeof value.id === "string" && bareIdPattern.test(value.id)) return value.id;
  return undefined;
}

/**
 * Queue one reference. `reportable` marks the author-written positions the
 * validator warns about; references reached through a record carry false, and
 * an id that arrives both ways stays reportable.
 */
function addReference(collector: Collector, kind: CatalogKind, value: unknown, reportable: boolean): void {
  const id = referenceId(value);
  if (!id) return;
  if (reportable) collector.reportable.add(reportKey(kind, id));
  let ids = collector.referenced.get(kind);
  if (!ids) {
    ids = new Set<string>();
    collector.referenced.set(kind, ids);
  }
  if (ids.has(id)) return;
  ids.add(id);
  collector.queue.push({ kind, id });
}

// Design references are the author's own, and the validator's
// 'referenceObjectWarning' covers both the string and the '{ id }' form —
// including the schemes an inline theme object names.
function collectDesignReferences(collector: Collector, design: unknown): void {
  if (!isRecord(design)) return;
  addReference(collector, "themes", design.theme, true);
  addReference(collector, "colorSchemes", design.colorScheme, true);
  addReference(collector, "fontSchemes", design.fontScheme, true);
  if (isRecord(design.theme)) {
    addReference(collector, "colorSchemes", design.theme.colorScheme, true);
    addReference(collector, "fontSchemes", design.theme.fontScheme, true);
  }
}

// A chart type is a plain id string on whichever content payload carries the
// chart; the validator warns about that string alone.
function collectChartReference(collector: Collector, payload: Record<string, unknown>): void {
  if (!isRecord(payload.chart)) return;
  addReference(collector, "chartTypes", payload.chart.type, typeof payload.chart.type === "string");
}

function collectSocialReferences(collector: Collector, holder: unknown): void {
  const entries = Array.isArray(holder) ? holder : [holder];
  for (const entry of entries) {
    if (!isRecord(entry) || !isRecord(entry.socials)) continue;
    for (const key of Object.keys(entry.socials)) addReference(collector, "socialPlatforms", key, false);
  }
}

// A beat's layout hint is the narrative's business rather than the author's:
// resolve it when it resolves, never report it when it does not.
function collectBeatReferences(collector: Collector, narrative: unknown): void {
  if (!isRecord(narrative) || !Array.isArray(narrative.beats)) return;
  for (const beat of narrative.beats) {
    if (isRecord(beat)) addReference(collector, "layouts", beat.layoutHint, false);
  }
}

// The Language object form names font schemes exactly as a resolved language
// record does, so the document's own language object is chased like one.
function collectLanguageReferences(collector: Collector, language: unknown): void {
  addReference(collector, "languages", language, false);
  if (!isRecord(language)) return;
  addReference(collector, "fontSchemes", language.fontScheme, false);
  addReference(collector, "fontSchemes", language.googleFontScheme, false);
}

function collectDocumentReferences(collector: Collector, document: Record<string, unknown>): void {
  // String shorthand only: an inline narrative object with an unknown id is a
  // legitimate fully-custom narrative, which is why the validator stays quiet
  // about it too.
  addReference(collector, "narratives", document.narrative, typeof document.narrative === "string");
  collectBeatReferences(collector, document.narrative);
  addReference(collector, "tones", document.tone, false);
  addReference(collector, "purposes", document.purpose, false);
  collectLanguageReferences(collector, document.language);
  const audiences = Array.isArray(document.audience) ? document.audience : [document.audience];
  for (const entry of audiences) addReference(collector, "audiences", entry, false);
  collectDesignReferences(collector, document.design);
  collectSocialReferences(collector, document.organization);
  collectSocialReferences(collector, document.speaker);

  if (!Array.isArray(document.slides)) return;
  for (const slide of document.slides) {
    if (!isRecord(slide)) continue;
    addReference(collector, "layouts", slide.layout, false);
    collectDesignReferences(collector, slide.design);
    // The slide doubles as its own root content payload, so it can carry a
    // chart directly; the shared walk covers its blocks and promoted regions.
    collectChartReference(collector, slide);
    visitContentPayloads(slide, "", (payload) => {
      collectChartReference(collector, payload);
    });
  }
}

// References that live inside a catalog record — resolved or already inline —
// so a bundled record never dangles: a theme names its color and font
// schemes, a narrative beat may hint a layout, a language names font schemes.
// None of them is author-written, so none of them is reportable.
function collectRecordReferences(collector: Collector, kind: CatalogKind, record: Record<string, unknown>): void {
  if (kind === "themes") {
    addReference(collector, "colorSchemes", record.colorScheme, false);
    addReference(collector, "fontSchemes", record.fontScheme, false);
  } else if (kind === "narratives") {
    collectBeatReferences(collector, record);
  } else if (kind === "languages") {
    addReference(collector, "fontSchemes", record.fontScheme, false);
    addReference(collector, "fontSchemes", record.googleFontScheme, false);
  }
}

// Built once on first use: the bundled catalogs keyed by kind and id.
let bundledIndex: Map<CatalogKind, Map<string, Record<string, unknown>>> | undefined;

function bundledCatalogIndex(): Map<CatalogKind, Map<string, Record<string, unknown>>> {
  if (bundledIndex) return bundledIndex;
  const index = new Map<CatalogKind, Map<string, Record<string, unknown>>>();
  for (const entry of catalogEntries) {
    const records = new Map<string, Record<string, unknown>>();
    for (const record of entry.records) {
      if (isRecord(record) && typeof record.id === "string") records.set(record.id, record);
    }
    index.set(entry.kind, records);
  }
  bundledIndex = index;
  return index;
}

function bundledRecord(kind: CatalogKind, id: string): Record<string, unknown> | undefined {
  const record = bundledCatalogIndex().get(kind)?.get(id);
  if (!record) return undefined;
  const clone = structuredClone(record);
  // Inline records mirror their companion schema sans '$schema'.
  delete clone.$schema;
  return clone;
}

/** What the document itself already says about one kind. */
interface KindState {
  /** A custom source in the validator's shape: one source, or a non-empty search path. */
  customSource: boolean;
  /** The records the document already inlines, by id. */
  inline: Map<string, Record<string, unknown>>;
}

function readKindState(catalogsField: Record<string, unknown>, kind: CatalogKind): KindState {
  const entry = catalogsField[kind];
  const inline = new Map<string, Record<string, unknown>>();
  if (!isRecord(entry)) return { customSource: false, inline };
  if (Array.isArray(entry.records)) {
    for (const record of entry.records) {
      if (isRecord(record) && typeof record.id === "string") inline.set(record.id, record);
    }
  }
  const customSource = typeof entry.source === "string" || (Array.isArray(entry.source) && entry.source.length > 0);
  return { customSource, inline };
}

// Read once per kind, before any record is inlined, so the state always
// describes the document as the author wrote it.
function kindState(
  states: Map<CatalogKind, KindState>,
  catalogsField: Record<string, unknown>,
  kind: CatalogKind,
): KindState {
  const cached = states.get(kind);
  if (cached) return cached;
  const state = readKindState(catalogsField, kind);
  states.set(kind, state);
  return state;
}

function pushReportId(map: Partial<Record<CatalogKind, string[]>>, kind: CatalogKind, id: string): void {
  const list = map[kind];
  if (list) list.push(id);
  else map[kind] = [id];
}

/**
 * Resolve every catalog reference `value` uses and inline the resolved
 * records, returning a new document plus a report of what changed. The input
 * document is not modified.
 *
 * Anything that is not an object, and any document whose `catalogs` is
 * present but not an object, is returned unchanged with an all-empty report:
 * bundling there would have to overwrite that field, and schema-invalid input
 * deserves a defined no-op over silent data loss. The CLI validates before
 * bundling, so only a direct library call can reach that case.
 *
 * Ids that resolve nowhere are reported as unresolved for the positions the
 * validator warns about, and silently skipped elsewhere; see
 * `BundleReport.unresolved`.
 */
export function bundlePresentation(value: unknown): BundleResult {
  const report: BundleReport = { added: {}, alreadyInline: {}, keptSources: [], unresolved: {} };
  if (!isRecord(value)) {
    return { presentation: value, report };
  }

  const presentation = structuredClone(value) as Record<string, unknown>;
  if (presentation.catalogs !== undefined && !isRecord(presentation.catalogs)) {
    return { presentation, report };
  }
  const catalogsField = isRecord(presentation.catalogs) ? presentation.catalogs : {};

  const collector: Collector = { queue: [], referenced: new Map(), reportable: new Set() };
  collectDocumentReferences(collector, presentation);

  // Worklist over every collected reference: resolving one appends whatever it
  // references in turn (theme -> schemes, ...), and the queue grows until the
  // transitive closure is covered.
  const states = new Map<CatalogKind, KindState>();
  const resolved = new Map<CatalogKind, Map<string, Record<string, unknown>>>();
  for (let index = 0; index < collector.queue.length; index += 1) {
    const pending = collector.queue[index];
    if (!pending) continue;
    const { kind, id } = pending;
    const state = kindState(states, catalogsField, kind);
    // An id the document already inlines needs no record of ours, but the
    // record it inlines may reference others — including out of a kind whose
    // own ids belong to a custom source.
    const inlineRecord = state.inline.get(id);
    if (inlineRecord) {
      collectRecordReferences(collector, kind, inlineRecord);
      continue;
    }
    if (state.customSource) continue;
    const record = bundledRecord(kind, id);
    if (!record) continue;
    let kindRecords = resolved.get(kind);
    if (!kindRecords) {
      kindRecords = new Map<string, Record<string, unknown>>();
      resolved.set(kind, kindRecords);
    }
    kindRecords.set(id, record);
    collectRecordReferences(collector, kind, record);
  }

  // Classify every referenced id and inline what resolved, kind by kind.
  for (const [kind, ids] of collector.referenced) {
    const state = kindState(states, catalogsField, kind);
    if (state.customSource) report.keptSources.push(kind);
    const kindResolved = resolved.get(kind);
    const addedIds: string[] = [];
    for (const id of [...ids].sort()) {
      if (state.inline.has(id)) pushReportId(report.alreadyInline, kind, id);
      else if (kindResolved?.has(id)) addedIds.push(id);
      else if (!state.customSource && collector.reportable.has(reportKey(kind, id))) {
        pushReportId(report.unresolved, kind, id);
      }
    }
    if (!addedIds.length) continue;
    if (!isRecord(presentation.catalogs)) presentation.catalogs = {};
    const catalogs = presentation.catalogs as Record<string, unknown>;
    if (!isRecord(catalogs[kind])) catalogs[kind] = {};
    const entry = catalogs[kind] as Record<string, unknown>;
    if (!Array.isArray(entry.records)) entry.records = [];
    const records = entry.records as unknown[];
    for (const id of addedIds) records.push(kindResolved?.get(id));
    report.added[kind] = addedIds;
  }
  report.keptSources.sort();

  return { presentation, report };
}
