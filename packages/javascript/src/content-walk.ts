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
