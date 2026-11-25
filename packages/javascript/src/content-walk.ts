import { MAX_COMPOSITION_DEPTH } from "./composition.js";

/**
 * Shared structure walk over the content payloads of a slide. Semantic checks,
 * reference warnings and pagination all need the same traversal; keeping one
 * implementation is what stops them from drifting apart, and a typed walk is
 * what keeps them out of `extensions` passthrough data.
 *
 * Internal module: not part of the package exports.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Append one JSON-pointer segment, escaping '~' and '/' in the key. */
export function pathFor(parentPath: string, key: string): string {
  return parentPath === "/" ? `/${key}` : `${parentPath}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

export const bareIdPattern = /^[a-z0-9][a-z0-9-]*$/;

export { cellBlocks, cellsInReadingOrder, gridCellSpan, gridCells, isGridCell, nearestGridCell, type CellBlock, type GridCell } from "./grid-cells.js";

export type ContentPayloadVisitor = (payload: Record<string, unknown>, path: string) => void;

/**
 * Visit every content payload below `slide`: each block, recursively through
 * nested group blocks (a block placed in a cell of the slide's grid is one of
 * its blocks).
 *
 * The slide itself is not visited: it doubles as its own root content payload,
 * so a caller that also cares about the root applies its check to the slide
 * object directly before walking.
 *
 * Nesting stops where `contentDepthIssues` would already have rejected the
 * document — at `MAX_COMPOSITION_DEPTH` levels or the first cycle — so the walk
 * terminates on any input, valid or not.
 */
export function visitContentPayloads(
  slide: Record<string, unknown>,
  slidePath: string,
  visit: ContentPayloadVisitor,
): void {
  const walk = (
    payload: Record<string, unknown>,
    path: string,
    depth: number,
    ancestors: readonly unknown[],
  ): void => {
    visit(payload, path);
    if (!Array.isArray(payload.blocks) || depth >= MAX_COMPOSITION_DEPTH || ancestors.includes(payload)) return;
    const nested = [...ancestors, payload];
    const blocksPath = pathFor(path, "blocks");
    payload.blocks.forEach((block, index) => {
      if (isRecord(block)) walk(block, `${blocksPath}/${index}`, depth + 1, nested);
    });
  };

  if (Array.isArray(slide.blocks)) {
    const blocksPath = pathFor(slidePath, "blocks");
    slide.blocks.forEach((block, index) => {
      if (isRecord(block)) walk(block, `${blocksPath}/${index}`, 0, []);
    });
  }
}

/** The entries of a payload that can carry an `id` of their own (FR-02): list items, bullets, timeline events and inline table rows. */
export type ItemKind = "item" | "bullet" | "event" | "row";

/** One such entry: its kind, its JSON Pointer (index form) and the value as written (a string, runs, an array row or an object). */
export type ItemVisitor = (kind: ItemKind, value: unknown, pointer: string) => void;

/**
 * Visit the id-bearing entries of ONE payload (a slide, which is its own root payload, or a block): `items`, `bullets`, the events of
 * `timeline` (array or object form) and the rows of an inline `table`. Nested blocks are not entered (walk them with
 * `visitContentPayloads`); dataset and chart data rows are data and never visited. A dataset-backed table has no rows.
 */
export function visitPayloadItems(payload: Record<string, unknown>, path: string, visit: ItemVisitor): void {
  const each = (kind: ItemKind, list: unknown, listPath: string): void => {
    if (Array.isArray(list)) list.forEach((entry, index) => { visit(kind, entry, `${listPath}/${index}`); });
  };
  each("item", payload.items, pathFor(path, "items"));
  each("bullet", payload.bullets, pathFor(path, "bullets"));
  const timeline = payload.timeline;
  if (Array.isArray(timeline)) each("event", timeline, pathFor(path, "timeline"));
  else if (isRecord(timeline)) each("event", timeline.events, pathFor(pathFor(path, "timeline"), "events"));
  if (isRecord(payload.table)) each("row", payload.table.rows, pathFor(pathFor(path, "table"), "rows"));
}

/** The `id` of an entry as written: the object form's non-empty string `id` (an array row has none). */
export function entryId(value: unknown): string | undefined {
  return isRecord(value) && typeof value.id === "string" && value.id !== "" ? value.id : undefined;
}
