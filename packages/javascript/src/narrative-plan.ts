import { catalogs } from "./catalogs.js";

/**
 * Narrative plan checks (FA-02). A deck holds a pointer (`narrative`, a catalog id, URL or `pkg:` reference) and
 * links its slides to the plan's beats with `slides[].beat`. This module resolves the pointer the way every
 * catalog reference resolves, offline (inline `catalogs.narratives.records`, then loaded records, then the
 * bundled catalog), and reports where the deck and the plan disagree. Lint and the audit both use it. It never
 * fetches: a URL or `pkg:` reference, or an id no local source defines, resolves to nothing and is not checked.
 */

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === "object" && value !== null && !Array.isArray(value);

export interface ResolvedNarrative {
  record: Rec;
  /** Where the record came from, in resolution order. */
  origin: "document" | "loaded" | "built-in";
  /** The narrative record's beat ids, in order. */
  beats: string[];
}

/** The narrative record the document's `narrative` string names, from local sources only, or undefined. */
export function resolveNarrative(document: unknown, loaded: readonly unknown[] = []): ResolvedNarrative | undefined {
  if (!isRec(document) || typeof document.narrative !== "string") return undefined;
  const id = document.narrative;
  if (/^(?:https?:|pkg:)/i.test(id)) return undefined;
  const entry = isRec(document.catalogs) && isRec(document.catalogs.narratives) ? document.catalogs.narratives : {};
  const sources: [ResolvedNarrative["origin"], readonly unknown[]][] = [
    ["document", Array.isArray(entry.records) ? entry.records : []],
    ["loaded", loaded],
    ["built-in", catalogs.narratives as readonly unknown[]],
  ];
  for (const [origin, records] of sources) {
    const record = records.find((candidate) => isRec(candidate) && candidate.id === id);
    if (isRec(record)) {
      const beats = Array.isArray(record.beats) ? record.beats.flatMap((beat) => (isRec(beat) && typeof beat.id === "string" ? [beat.id] : [])) : [];
      return { record, origin, beats };
    }
  }
  return undefined;
}

export interface BeatReference {
  /** JSON Pointer of the beat value (`/slides/2/beat` or `/slides/2/beat/1`). */
  path: string;
  slide: number;
  beat: string;
}

/** Every beat id the slides name, in document order. */
export function slideBeatReferences(document: unknown): BeatReference[] {
  if (!isRec(document) || !Array.isArray(document.slides)) return [];
  const references: BeatReference[] = [];
  document.slides.forEach((slide, index) => {
    if (!isRec(slide)) return;
    const path = `/slides/${index}/beat`;
    if (typeof slide.beat === "string") references.push({ path, slide: index, beat: slide.beat });
    else if (Array.isArray(slide.beat))
      slide.beat.forEach((beat, at) => {
        if (typeof beat === "string") references.push({ path: `${path}/${at}`, slide: index, beat });
      });
  });
  return references;
}

/** References to a beat the resolved narrative does not define. */
export function unknownBeatReferences(document: unknown, narrative: ResolvedNarrative): BeatReference[] {
  const known = new Set(narrative.beats);
  return slideBeatReferences(document).filter((reference) => !known.has(reference.beat));
}

/**
 * The narrative's beats that no slide references. Empty when no slide references any beat at all: a deck that
 * does not link its slides to the plan has not asked for a coverage check.
 */
export function unreferencedBeats(document: unknown, narrative: ResolvedNarrative): { beat: string; index: number }[] {
  const referenced = new Set(slideBeatReferences(document).map((reference) => reference.beat));
  if (referenced.size === 0) return [];
  return narrative.beats.flatMap((beat, index) => (referenced.has(beat) ? [] : [{ beat, index }]));
}

export interface DurationRange {
  min?: number;
  max?: number;
}

/** A record's `duration` range with only its finite positive bounds, or undefined. */
export function durationRange(record: unknown): DurationRange | undefined {
  if (!isRec(record) || !isRec(record.duration)) return undefined;
  const bound = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined);
  const min = bound(record.duration.min),
    max = bound(record.duration.max);
  return min === undefined && max === undefined ? undefined : { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

/** True when a record's own range is inverted (`min` greater than `max`). */
export function durationRangeInverted(record: unknown): boolean {
  const range = durationRange(record);
  return range?.min !== undefined && range.max !== undefined && range.min > range.max;
}

/** The root `duration` and the range of the resolved narrative when the target lies outside it. */
export function durationOutsideNarrative(document: unknown, narrative: ResolvedNarrative): { duration: number; range: DurationRange } | undefined {
  if (!isRec(document) || typeof document.duration !== "number" || !Number.isFinite(document.duration)) return undefined;
  const range = durationRange(narrative.record);
  if (!range || durationRangeInverted(narrative.record)) return undefined;
  const duration = document.duration;
  if ((range.min !== undefined && duration < range.min) || (range.max !== undefined && duration > range.max)) return { duration, range };
  return undefined;
}

/** `10-30 minutes`, `at least 10 minutes` or `at most 30 minutes`. */
export function describeDurationRange(range: DurationRange): string {
  if (range.min !== undefined && range.max !== undefined) return `${range.min}-${range.max} minutes`;
  return range.min !== undefined ? `at least ${range.min} minutes` : `at most ${range.max} minutes`;
}
