// FR-06: write the computed numbers of metrics linked to data into their written `value` and `delta`, so a reader that does not compute
// shows what the data gives. The safe fix of `metric-data-stale`, applied to a whole deck (`opf fill` runs it after the variables are filled).
// Browser-safe and light: it walks the slides itself instead of importing the composition engine.
import { resolveMetric } from "./metric-data.js";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const MAX_DEPTH = 32;

/**
 * The deck with every metric's written `value` and `delta` replaced by the number its `data` link computes (the fix of each
 * `metric-data-stale` warning). A deck with nothing stale is returned as it is; a deck is never changed in place.
 */
export function updateMetricLiterals<T>(document: T): T {
  if (!isRecord(document) || !Array.isArray(document.slides) || !isRecord(document.datasets)) return document;
  const edits: { keys: string[]; value: string | number }[] = [];
  const language = typeof document.language === "string" ? { language: document.language } : {};
  const walk = (payload: Record<string, unknown>, path: string, depth: number, ancestors: readonly unknown[]): void => {
    if (isRecord(payload.metric) && isRecord(payload.metric.data)) {
      for (const entry of resolveMetric(payload.metric, document, { path: `${path}/metric`, ...language }).diagnostics)
        for (const patch of entry.fix?.patch ?? []) edits.push({ keys: patch.path.split("/").slice(1).map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~")), value: patch.value });
    }
    if (depth >= MAX_DEPTH || ancestors.includes(payload) || !Array.isArray(payload.blocks)) return;
    payload.blocks.forEach((block, index) => { if (isRecord(block)) walk(block, `${path}/blocks/${index}`, depth + 1, [...ancestors, payload]); });
  };
  document.slides.forEach((slide, index) => { if (isRecord(slide)) walk(slide, `/slides/${index}`, 0, []); });
  if (!edits.length) return document;
  const copy = structuredClone(document) as Record<string, unknown>;
  for (const edit of edits) {
    let at: unknown = copy;
    for (const key of edit.keys.slice(0, -1)) at = Array.isArray(at) ? at[Number(key)] : isRecord(at) ? at[key] : undefined;
    if (isRecord(at)) at[edit.keys[edit.keys.length - 1]!] = edit.value;
  }
  return copy as T;
}
