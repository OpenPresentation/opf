import { catalogEntries } from "./generated/catalogs.js";
import type { CatalogKind } from "./generated/catalogs.js";
import { promotedRegionKeys } from "./validator.js";

/**
 * Local catalog vendoring: resolve every catalog reference a presentation
 * uses and inline the resolved records into `catalogs.<kind>.records`, so the
 * document renders identically with no catalog lookups beyond itself.
 *
 * Resolution is local-only: inline records are kept as-is, kinds that declare
 * a custom `source` are left untouched (their ids belong to that source), and
 * everything else resolves against the bundled default catalogs. Running the
 * bundle twice is a no-op.
 */

export interface BundleReport {
  /** Record ids inlined by this run, per kind, in output order. */
  added: Partial<Record<CatalogKind, string[]>>;
  /** Referenced ids that were already inline in the document, per kind. */
  alreadyInline: Partial<Record<CatalogKind, string[]>>;
  /** Kinds left untouched because the document declares a custom source. */
  keptSources: CatalogKind[];
  /** Referenced bare ids that resolve nowhere locally, per kind. Informational: unknown ids are warnings, never errors. */
  unresolved: Partial<Record<CatalogKind, string[]>>;
}

export interface BundleResult {
  presentation: unknown;
  report: BundleReport;
}

const bareIdPattern = /^[a-z0-9][a-z0-9-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function referenceId(value: unknown): string | undefined {
  if (typeof value === "string" && bareIdPattern.test(value)) return value;
  if (isRecord(value) && typeof value.id === "string" && bareIdPattern.test(value.id)) return value.id;
  return undefined;
}

type References = Map<CatalogKind, Set<string>>;

function addReference(references: References, kind: CatalogKind, value: unknown): void {
  const id = referenceId(value);
  if (!id) return;
  let ids = references.get(kind);
  if (!ids) {
    ids = new Set<string>();
    references.set(kind, ids);
  }
  ids.add(id);
}

function collectDesignReferences(references: References, design: unknown): void {
  if (!isRecord(design)) return;
  addReference(references, "themes", design.theme);
  addReference(references, "colorSchemes", design.colorScheme);
  addReference(references, "fontSchemes", design.fontScheme);
  if (isRecord(design.theme)) {
    addReference(references, "colorSchemes", design.theme.colorScheme);
    addReference(references, "fontSchemes", design.theme.fontScheme);
  }
}

function collectChartReferences(references: References, payload: unknown): void {
  if (!isRecord(payload)) return;
  if (isRecord(payload.chart)) addReference(references, "chartTypes", payload.chart.type);
  if (Array.isArray(payload.blocks)) for (const block of payload.blocks) collectChartReferences(references, block);
}

function collectSocialReferences(references: References, holder: unknown): void {
  const entries = Array.isArray(holder) ? holder : [holder];
  for (const entry of entries) {
    if (!isRecord(entry) || !isRecord(entry.socials)) continue;
    for (const key of Object.keys(entry.socials)) addReference(references, "socialPlatforms", key);
  }
}

function collectNarrativeReferences(references: References, narrative: unknown): void {
  addReference(references, "narratives", narrative);
  if (isRecord(narrative) && Array.isArray(narrative.beats)) {
    for (const beat of narrative.beats) {
      if (isRecord(beat)) addReference(references, "layouts", beat.layoutHint);
    }
  }
}

// Region keys come from the validator's canonical promoted-region list so the
// two modules can never drift.

function collectDocumentReferences(document: Record<string, unknown>): References {
  const references: References = new Map();

  collectNarrativeReferences(references, document.narrative);
  addReference(references, "tones", document.tone);
  addReference(references, "purposes", document.purpose);
  addReference(references, "languages", document.language);
  if (Array.isArray(document.audience)) {
    for (const entry of document.audience) addReference(references, "audiences", entry);
  } else {
    addReference(references, "audiences", document.audience);
  }
  collectDesignReferences(references, document.design);
  collectSocialReferences(references, document.organization);
  collectSocialReferences(references, document.speaker);

  if (Array.isArray(document.slides)) {
    for (const slide of document.slides) {
      if (!isRecord(slide)) continue;
      addReference(references, "layouts", slide.layout);
      collectDesignReferences(references, slide.design);
      collectChartReferences(references, slide);
      for (const key of promotedRegionKeys) {
        if (key in slide) collectChartReferences(references, slide[key]);
      }
    }
  }

  return references;
}

// References that live inside resolved catalog records themselves, so a
// bundled record never dangles: a theme names its color and font schemes, a
// narrative beat may hint a layout, a language may name font schemes.
function collectRecordReferences(references: References, kind: CatalogKind, record: Record<string, unknown>): void {
  if (kind === "themes") {
    addReference(references, "colorSchemes", record.colorScheme);
    addReference(references, "fontSchemes", record.fontScheme);
  } else if (kind === "narratives" && Array.isArray(record.beats)) {
    for (const beat of record.beats) {
      if (isRecord(beat)) addReference(references, "layouts", beat.layoutHint);
    }
  } else if (kind === "languages") {
    addReference(references, "fontSchemes", record.fontScheme);
    addReference(references, "fontSchemes", record.googleFontScheme);
  }
}

function bundledRecord(kind: CatalogKind, id: string): Record<string, unknown> | undefined {
  const entry = catalogEntries.find((candidate) => candidate.kind === kind);
  const record = entry?.records.find((candidate) => isRecord(candidate) && candidate.id === id);
  if (!isRecord(record)) return undefined;
  const clone = structuredClone(record) as Record<string, unknown>;
  // Inline records mirror their companion schema sans '$schema'.
  delete clone.$schema;
  return clone;
}

function inlineRecordIds(entry: unknown): Set<string> {
  const ids = new Set<string>();
  if (isRecord(entry) && Array.isArray(entry.records)) {
    for (const record of entry.records) {
      if (isRecord(record) && typeof record.id === "string") ids.add(record.id);
    }
  }
  return ids;
}

function hasCustomSource(entry: unknown): boolean {
  return isRecord(entry) && entry.source !== undefined;
}

function pushReportId(map: Partial<Record<CatalogKind, string[]>>, kind: CatalogKind, id: string): void {
  const list = map[kind];
  if (list) list.push(id);
  else map[kind] = [id];
}

/**
 * Resolve every catalog reference `value` uses and inline the resolved
 * records, returning a new document plus a report of what changed. The input
 * document is not modified. Ids that neither resolve locally nor belong to a
 * custom source are reported as unresolved, matching the validator's
 * unknown-id warnings.
 */
export function bundlePresentation(value: unknown): BundleResult {
  const report: BundleReport = { added: {}, alreadyInline: {}, keptSources: [], unresolved: {} };
  if (!isRecord(value)) {
    return { presentation: value, report };
  }

  const presentation = structuredClone(value) as Record<string, unknown>;
  const references = collectDocumentReferences(presentation);
  const catalogsField = isRecord(presentation.catalogs) ? presentation.catalogs : {};

  // Fixpoint over transitive record references (theme -> schemes, ...).
  const resolved = new Map<CatalogKind, Map<string, Record<string, unknown>>>();
  const visited = new Set<string>();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [kind, ids] of references) {
      for (const id of ids) {
        const key = `${kind}:${id}`;
        if (visited.has(key)) continue;
        visited.add(key);
        progressed = true;
        if (hasCustomSource(catalogsField[kind]) || inlineRecordIds(catalogsField[kind]).has(id)) continue;
        const record = bundledRecord(kind, id);
        if (!record) continue;
        let kindRecords = resolved.get(kind);
        if (!kindRecords) {
          kindRecords = new Map();
          resolved.set(kind, kindRecords);
        }
        kindRecords.set(id, record);
        collectRecordReferences(references, kind, record);
      }
    }
  }

  for (const [kind, ids] of references) {
    const entry = catalogsField[kind];
    if (hasCustomSource(entry)) {
      report.keptSources.push(kind);
      continue;
    }
    const inline = inlineRecordIds(entry);
    const kindResolved = resolved.get(kind);
    for (const id of [...ids].sort()) {
      if (inline.has(id)) {
        pushReportId(report.alreadyInline, kind, id);
      } else if (!kindResolved?.has(id)) {
        pushReportId(report.unresolved, kind, id);
      }
    }
  }
  report.keptSources.sort();

  for (const [kind, kindRecords] of resolved) {
    const addedIds = [...kindRecords.keys()].sort();
    if (!addedIds.length) continue;
    if (!isRecord(presentation.catalogs)) presentation.catalogs = {};
    const catalogs = presentation.catalogs as Record<string, unknown>;
    if (!isRecord(catalogs[kind])) catalogs[kind] = {};
    const entry = catalogs[kind] as Record<string, unknown>;
    if (!Array.isArray(entry.records)) entry.records = [];
    const records = entry.records as unknown[];
    for (const id of addedIds) records.push(kindRecords.get(id));
    report.added[kind] = addedIds;
  }

  return { presentation, report };
}
