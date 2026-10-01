import { OPFDataImportError, parseTabularData, resolveVariables, type ResolveVariablesOptions, type VariableDiagnostic } from "@openpresentation/opf";

/**
 * `opf fill`: turn a template (an incomplete OPF file) and data into decks.
 * Pure helpers; the command in index.ts owns files, validation and output.
 */

export type FillRecord = Record<string, unknown>;

const isPlainRecord = (value: unknown): value is FillRecord => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Records from a data file. JSON keeps rich values (text runs, lists, image objects):
 * an object is one record and an array of objects is one record each. CSV, TSV and
 * tabular JSON ({columns, rows} or a row matrix) give one record per row, keyed by
 * the header, with blank cells left unprovided.
 */
export function recordsFromData(raw: string, format: "csv" | "tsv" | "json", options: { delimiter?: string; header?: boolean } = {}): FillRecord[] {
  if (format === "json") {
    let value: unknown;
    try { value = JSON.parse(raw.replace(/^﻿/, "")); } catch { throw new OPFDataImportError("Invalid JSON data."); }
    if (isPlainRecord(value) && !("columns" in value && "rows" in value)) return [value];
    if (Array.isArray(value) && value.length && value.every(isPlainRecord)) return value;
    if (Array.isArray(value) && !value.length) throw new OPFDataImportError("Data contains no records.");
  }
  const table = parseTabularData(raw, { format, header: options.header, delimiter: options.delimiter });
  if (!table.rows.length) throw new OPFDataImportError("Data contains no records.");
  return table.rows.map((row) => Object.fromEntries(table.columns.map((column, index) => [column, row[index] === "" ? null : row[index]])));
}

export interface FilledDeck {
  /** 1-based position of the record. */
  index: number;
  record: FillRecord;
  presentation: Record<string, unknown>;
  diagnostics: VariableDiagnostic[];
  unfilled: string[];
  complete: boolean;
}

/** Resolve the template once per record. Pure. */
export function fillRecords(template: unknown, records: FillRecord[], options: ResolveVariablesOptions = {}): FilledDeck[] {
  if (!isPlainRecord(template)) throw new OPFDataImportError("The template must be a JSON object.");
  return records.map((record, offset) => {
    const result = resolveVariables(template, record, options);
    return { index: offset + 1, record, ...result };
  });
}

/** Deck file names for a multi-record fill: `{n}` is the padded 1-based index, `{column}` a slugified value. */
export function deckNames(decks: FilledDeck[], pattern = "deck-{n}"): string[] {
  const width = String(decks.length).length;
  const used = new Set<string>();
  return decks.map((deck) => {
    const name = pattern.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
      if (key === "n") return String(deck.index).padStart(width, "0");
      const value = deck.record[key];
      return value === undefined || value === null ? "" : slug(String(value));
    });
    let base = slug(name) || String(deck.index).padStart(width, "0");
    if (used.has(base)) {
      let suffix = 2;
      while (used.has(`${base}-${suffix}`)) suffix++;
      base = `${base}-${suffix}`;
    }
    used.add(base);
    return base;
  });
}

function slug(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
}

/**
 * Concatenate the slides of several filled decks into one deck: the first deck
 * supplies every deck-level field, and a repeated slide id gets the record index
 * appended so ids stay unique.
 */
export function combineDecks(decks: FilledDeck[]): Record<string, unknown> {
  const first = decks[0];
  if (!first) throw new OPFDataImportError("Nothing to combine.");
  const seen = new Set<string>();
  const slides: unknown[] = [];
  const assets: Record<string, unknown> = {};
  for (const deck of decks) {
    const deckSlides = Array.isArray(deck.presentation.slides) ? deck.presentation.slides : [];
    for (const slide of deckSlides) {
      if (isPlainRecord(slide) && typeof slide.id === "string") {
        let id = slide.id;
        if (seen.has(id)) {
          id = `${slide.id}-${deck.index}`;
          for (let suffix = 2; seen.has(id); suffix++) id = `${slide.id}-${deck.index}-${suffix}`;
        }
        seen.add(id);
        slides.push(id === slide.id ? slide : { ...slide, id });
      } else slides.push(slide);
    }
    if (isPlainRecord(deck.presentation.assets)) for (const [key, value] of Object.entries(deck.presentation.assets)) if (!(key in assets)) assets[key] = value;
  }
  return { ...first.presentation, ...(Object.keys(assets).length ? { assets } : {}), slides };
}

/** Diagnostics across decks, one entry per code, variable and path, with the records it hit. */
export function summarizeDiagnostics(decks: FilledDeck[]): (VariableDiagnostic & { records: number[] })[] {
  const merged = new Map<string, VariableDiagnostic & { records: number[] }>();
  for (const deck of decks) {
    for (const diagnostic of deck.diagnostics) {
      if (diagnostic.severity === "info") continue;
      const key = `${diagnostic.code}\u0000${diagnostic.id}\u0000${diagnostic.path}`;
      const entry = merged.get(key);
      if (entry) entry.records.push(deck.index);
      else merged.set(key, { ...diagnostic, records: [deck.index] });
    }
  }
  return [...merged.values()];
}
