/**
 * Quick fixes for the schema findings that have an unambiguous repair, as RFC 6902 patches the host applies through its own undoable edit path
 * (`Finding.fixes`, kind `patch`): add a required property, change an enum value to the nearest allowed one, rename an unknown property to its near
 * miss, move it under `extensions`, wrap a string in a list, write a number as text, add the first slide. Never applied by core.
 *
 * Internal module: `validate` attaches them to `opf/schema` findings that carry no fixes of their own, and removedKeyRepair to the
 * findings of keys and values OPF 0.35 removed.
 */
import type { Finding, FindingFix, JsonPatchOperation } from "./generated/types/finding.js";
import { isRecord, nearest, pointerOf, readAt, segmentsOf } from "./finding-text-util.js";
import { starterValue } from "./finding-text.js";
import { schemaAtPath, schemaVariants } from "./schema-navigation.js";
import { REMOVED_DESIGN_KEYS } from "./design-hints.js";
import { cellsInReadingOrder, type GridCell, nearestGridCell } from "./grid-cells.js";

/** The most "Change to ..." fixes one enum finding carries. */
const MAX_CHANGES = 5;

/** A patch fix; `changesDrawing` (FindingFix) is written only when true: the fixed deck can draw differently from the release that wrote it. */
const patch = (id: string, title: string, operations: JsonPatchOperation[], safe = false, changesDrawing = false): FindingFix => ({ id, title, kind: "patch", safe, ...(changesDrawing ? { changesDrawing: true } : {}), patch: operations });

/**
 * OPF 0.35: how the fixes of the removed design keys (REMOVED_DESIGN_KEYS) are marked. Both fixes delete the key and write nothing in its
 * place: the engine composes the slide, so a slide the key shaped can draw differently (`changesDrawing`). `chartPrimary` never applied
 * to a slide with a layout, so deleting it from a layout record changes nothing. An author who wants a specific arrangement sets the
 * slide's `composition` (mode, weights).
 */
export const REMOVED_DESIGN_KEY_FIXES: Readonly<Record<string, { safe: boolean; changesDrawing: (segments: readonly string[]) => boolean }>> = Object.freeze({
  contentDirection: { safe: true, changesDrawing: () => true },
  chartPrimary: { safe: true, changesDrawing: (segments: readonly string[]) => !(segments[0] === "catalogs" && segments[2] === "layouts") },
});

/**
 * The operations that delete the removed design key at `segments`: the key, or its whole `design` object when the key is the only one it
 * holds, so the fix never leaves `"design": {}` (in a slide, the deck, a theme or a layout record). `fix` removes a design object that
 * fixes of the same round emptied together.
 */
export function removedDesignKeyOperations(document: unknown, segments: readonly string[]): JsonPatchOperation[] {
  const parent = segments.slice(0, -1), design = readAt(document, parent);
  const alone = isRecord(design) && Object.keys(design).length === 1;
  return [{ op: "remove", path: pointerOf(alone ? parent : segments) }];
}

const allowsKey = (document: unknown, segments: string[], key: string): boolean => {
  try {
    return schemaVariants(schemaAtPath(document, segments)).some((variant) => Object.hasOwn((variant.properties ?? {}) as object, key));
  } catch {
    return false;
  }
};

/** The fixes of one `opf/schema` finding for `document`; empty when there is no unambiguous repair. */
export function schemaFixes(finding: Finding, document: unknown): FindingFix[] {
  const validation = finding.validation;
  if (finding.ruleId !== "opf/schema" || !validation) return [];
  const segments = segmentsOf(finding.path);
  const params = validation.params as Record<string, unknown>;
  switch (validation.keyword) {
    case "required": {
      const property = String(params.missingProperty ?? "");
      if (!property || !isRecord(readAt(document, segments)) || Object.hasOwn(readAt(document, segments) as object, property)) return [];
      const value = starterValue(document, segments, property);
      if (value === undefined) return [];
      return [patch(`add:${property}`, `Add \`${property}\``, [{ op: "add", path: pointerOf([...segments, property]), value }])];
    }
    case "enum": {
      const allowed = Array.isArray(params.allowedValues) ? (params.allowedValues as unknown[]) : [];
      if (!allowed.length || readAt(document, segments) === undefined) return [];
      const current = readAt(document, segments);
      // The near misses first (an alias such as middle to center, an edit distance of two), then the values in the order the schema lists them.
      const values = [...new Set([...nearest(current, allowed, MAX_CHANGES).close, ...allowed])].slice(0, MAX_CHANGES);
      return values.map((value) => patch(`change-to:${String(value)}`, `Change to ${String(value)}`, [{ op: "replace", path: finding.path, value }]));
    }
    case "additionalProperties": {
      const name = String(params.additionalProperty ?? segments.at(-1) ?? "");
      const parent = segments.slice(0, -1);
      const owner = readAt(document, parent);
      if (!name || !isRecord(owner) || !Object.hasOwn(owner, name)) return [];
      const fixes: FindingFix[] = [];
      for (const suggestion of finding.suggestions ?? []) {
        const target = String(suggestion.value);
        if (!Object.hasOwn(owner, target)) fixes.push(patch(`rename-to:${target}`, `Rename to ${target}`, [{ op: "move", from: finding.path, path: pointerOf([...parent, target]) }]));
      }
      if (allowsKey(document, parent, "extensions") && name !== "extensions") {
        const existing = owner.extensions;
        if (existing === undefined) fixes.push(patch("move-to-extensions", "Move into extensions", [{ op: "add", path: pointerOf([...parent, "extensions"]), value: {} }, { op: "move", from: finding.path, path: pointerOf([...parent, "extensions", name]) }]));
        else if (isRecord(existing) && !Object.hasOwn(existing, name)) fixes.push(patch("move-to-extensions", "Move into extensions", [{ op: "move", from: finding.path, path: pointerOf([...parent, "extensions", name]) }]));
      }
      return fixes;
    }
    case "type": {
      const current = readAt(document, segments);
      if (current === undefined) return [];
      if (params.type === "array" && (typeof current === "string" || isRecord(current))) return [patch("wrap-in-list", "Wrap in a list", [{ op: "replace", path: finding.path, value: [current] }], typeof current === "string")];
      if (params.type === "string" && (typeof current === "number" || typeof current === "boolean")) return [patch("convert-to-string", "Convert to string", [{ op: "replace", path: finding.path, value: String(current) }], true)];
      return [];
    }
    case "oneOf":
    case "anyOf": {
      const current = readAt(document, segments);
      const forms = (validation.alternatives ?? []).map((entry) => String(entry).split(":")[0]?.trim());
      if (forms.includes("string") && (typeof current === "number" || typeof current === "boolean")) return [patch("convert-to-string", "Convert to string", [{ op: "replace", path: finding.path, value: String(current) }], true)];
      return [];
    }
    case "minItems":
      if (finding.path === "/slides" && Array.isArray(readAt(document, segments)) && params.limit === 1) return [patch("add-slide", "Add a slide", [{ op: "add", path: "/slides/0", value: { title: "Slide title" } }])];
      return [];
    default:
      return [];
  }
}

/**
 * OPF 0.35: a removed design key (`contentDirection`, `chartPrimary`; REMOVED_DESIGN_KEYS) in a deck, slide, theme or layout `design`, a
 * layout region's removed `flow: "none"`, `listColumns`, `sequence`, `pyramidDirection`, `arrangement` `flow` / `vertical-flow` or
 * `role: "secondary"`: what replaced it, as the finding's help, and the fix where the conversion is mechanical (delete the design key or
 * `listColumns`; `none` becomes `max: 1`; `sequence` becomes `arrangement`; a pyramid's `pyramidDirection` becomes its arrangement;
 * `flow` becomes `process`). `secondary` gets two fixes, neither marked safe.
 * For `opf/schema` and `opf/catalog-record` findings, the document's own and its embedded records; undefined for any other finding.
 */
/**
 * Whether deleting a region's `listColumns` can change how its long lists draw. Only `"auto"` on a region made for a list (`list` its first
 * accepted kind, without an arrangement or with `numbered`) keeps its rule: 0.35 gives such a region what `"auto"` did. `1` kept a long
 * list in one column, which may now take columns (`"columns": 1` on the list keeps one), and `"auto"` elsewhere becomes the guarded rule
 * (columns only when they set the list at least as large as one column) or one column in a region with `steps` or a diagram.
 */
function listColumnsChangeDrawing(region: unknown): boolean {
  if (!isRecord(region) || region.listColumns !== "auto") return true;
  const accepts = Array.isArray(region.accepts) ? region.accepts : [];
  // A 0.34 region says its sequence in `sequence` (use-arrangement moves it to `arrangement`).
  const arrangement = region.arrangement ?? region.sequence;
  return !(accepts[0] === "list" && (arrangement === undefined || arrangement === "numbered"));
}

/** OPF 0.35: what replaced a layout region's `listColumns` (removedKeyRepair). */
export const REMOVED_LIST_COLUMNS = "OPF 0.35 removed the region key listColumns. Delete it: a list of more than 6 entries flows into up to three columns in any region without an arrangement (or with the numbered one) when that sets it at least as large as one column; a list payload's own columns (1, 2, 3 or \"auto\") still chooses.";
export function removedKeyRepair(finding: Finding, document: unknown): { help: string; fixes: FindingFix[]; dropSuggestions?: true } | undefined {
  const validation = finding.validation;
  if (!validation || (finding.ruleId !== "opf/schema" && finding.ruleId !== "opf/catalog-record")) return undefined;
  const segments = segmentsOf(finding.path);
  if (validation.keyword === "additionalProperties" && segments.length === 3 && segments[0] === "slides" && readAt(document, segments) !== undefined && nearestGridCell(segments[2]!) !== undefined) return cellKeyRepair(document, segments.slice(0, 2), segments[2]!);
  const inRegion = segments.at(-3) === "regions";
  if (validation.keyword === "additionalProperties" && inRegion && (segments.at(-1) === "sequence" || segments.at(-1) === "pyramidDirection")) {
    const parent = segments.slice(0, -1), region = readAt(document, parent), value = readAt(document, segments);
    if (!isRecord(region) || value === undefined) return undefined;
    const arrangement = region.arrangement;
    if (segments.at(-1) === "sequence") {
      const help = `OPF 0.35 replaced the region key sequence with arrangement: a region has one arrangement, a sequence ("steps" or "numbered") or a diagram. Write "arrangement": ${JSON.stringify(value)} in its place.`;
      if (arrangement !== undefined || (value !== "steps" && value !== "numbered")) return { help: `${help}${arrangement !== undefined ? ` This region also has "arrangement": ${JSON.stringify(arrangement)}; keep one of the two.` : ""}`, fixes: [] };
      return { help, fixes: [patch("use-arrangement", `Write arrangement ${value}`, [{ op: "move", from: finding.path, path: pointerOf([...parent, "arrangement"]) }], true)] };
    }
    const help = 'OPF 0.35 removed the region key pyramidDirection: "arrangement": "inverted-pyramid" draws the pyramid upside down (what "down" did), and "arrangement": "pyramid" draws it upright ("up", the default).';
    if (arrangement !== "pyramid") return { help, fixes: [] };
    if (value === "down") return { help, fixes: [patch("use-inverted-pyramid", "Write arrangement inverted-pyramid", [{ op: "remove", path: finding.path }, { op: "replace", path: pointerOf([...parent, "arrangement"]), value: "inverted-pyramid" }], true)] };
    if (value === "up") return { help, fixes: [patch("use-pyramid", "Keep arrangement pyramid (upright)", [{ op: "remove", path: finding.path }], true)] };
    return { help, fixes: [] };
  }
  if (validation.keyword === "enum" && inRegion && segments.at(-1) === "arrangement") {
    const value = readAt(document, segments), renamed = value === "flow" ? "process" : value === "vertical-flow" ? "vertical-process" : undefined;
    if (renamed === undefined) return undefined;
    return { help: `OPF 0.35 renamed the arrangement "${String(value)}" to "${renamed}", PowerPoint's name (${renamed === "process" ? "Basic Process" : "Vertical Process"}); it draws the same.`, fixes: [patch("rename-arrangement", `Write arrangement ${renamed}`, [{ op: "replace", path: finding.path, value: renamed }], true)] };
  }
  // An embedded record copied before OPF 0.34 (a host's stale copy of a built-in layout) can still say left or right, which 0.34 renamed.
  const alignment = segments.at(-1);
  if (validation.keyword === "enum" && finding.ruleId === "opf/catalog-record" && segments.at(-2) === "design" && (alignment === "titleAlignment" || alignment === "contentAlignment")) {
    const value = readAt(document, segments), next = value === "left" ? "start" : value === "right" ? "end" : undefined;
    if (next === undefined) return undefined;
    return { help: `OPF 0.34 renamed the alignment "${String(value)}" to "${next}" (the start and end of the reading direction; the left and right edges of a left-to-right deck).`, fixes: [patch(`change-to:${next}`, `Change to ${next}`, [{ op: "replace", path: finding.path, value: next }], true)] };
  }
  if (validation.keyword === "enum" && inRegion && segments.at(-1) === "role" && readAt(document, segments) === "secondary") {
    return {
      help: 'OPF 0.35 removed the role "secondary" (bound after primary, before supporting): a region\'s role is "primary" (the default), "media" or "supporting". Write "supporting" for a region that takes what the primary regions leave, or "primary".',
      fixes: [patch("change-to:supporting", "Change to supporting", [{ op: "replace", path: finding.path, value: "supporting" }]), patch("change-to:primary", "Change to primary", [{ op: "replace", path: finding.path, value: "primary" }])],
    };
  }
  if (validation.keyword === "additionalProperties") {
    const name = segments.at(-1) ?? "";
    if (name === "listColumns" && segments.at(-3) === "regions" && readAt(document, segments) !== undefined) return { help: REMOVED_LIST_COLUMNS, fixes: [patch("remove:listColumns", "Delete listColumns", [{ op: "remove", path: finding.path }], true, listColumnsChangeDrawing(readAt(document, segments.slice(0, -1))))] };
    if (segments.at(-2) !== "design" || !Object.hasOwn(REMOVED_DESIGN_KEYS, name) || readAt(document, segments) === undefined) return undefined;
    const marks = REMOVED_DESIGN_KEY_FIXES[name] ?? { safe: true, changesDrawing: () => true };
    return { help: REMOVED_DESIGN_KEYS[name]!, fixes: [patch(`remove:${name}`, `Delete design.${name}`, removedDesignKeyOperations(document, segments), marks.safe, marks.changesDrawing(segments))] };
  }
  if (validation.keyword === "pattern" && segments.at(-1) === "region" && segments.at(-3) === "blocks" && segments[0] === "slides" && segments.length === 5) {
    const typed = readAt(document, segments), near = typeof typed === "string" ? nearestGridCell(typed) : undefined;
    if (!near?.help) return undefined;
    return { help: `${JSON.stringify(typed)} is no cell of the slide's grid. ${near.help}`, fixes: near.cell ? [patch(`change-to:${near.cell}`, `Change to ${near.cell}`, [{ op: "replace", path: finding.path, value: near.cell }])] : [] };
  }
  if (validation.keyword === "enum" && segments.at(-1) === "flow" && segments.at(-3) === "regions" && readAt(document, segments) === "none") {
    const parent = segments.slice(0, -1), region = readAt(document, parent);
    const help = 'OPF 0.35 removed flow "none": a region of one block says "max": 1 (blocks no region had room for still join it), and its flow is "auto", "grid", "row" or "column".';
    if (!isRecord(region) || (region.max !== undefined && region.max !== 1)) return { help, fixes: [] };
    return { help, fixes: [patch("use-max-1", "Write max 1 (a region of one block)", [{ op: "remove", path: finding.path }, { op: "add", path: pointerOf([...parent, "max"]), value: 1 }], true)] };
  }
  return undefined;
}

/** The fields that make a slide hold root content: with any of them, a slide had no promoted regions to move. */
const ROOT_CONTENT = ["type", "text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline", "diagram", "shape", "path", "blocks"];

/**
 * OPF 0.35: the slide keys of `slide` that named a cell of its 3 x 3 grid through 0.34 (the promoted regions `start`, `top:start`, ...,
 * and a key written like one: `left`, `start:top`), each with the cell it names, in reading order of the cells (keys of one cell in
 * the slide's key order).
 */
export function removedCellKeys(slide: unknown): { key: string; cell: GridCell }[] {
  if (!isRecord(slide)) return [];
  const found = Object.keys(slide).flatMap((key) => { const cell = nearestGridCell(key)?.cell; return cell ? [{ key, cell }] : []; });
  const order = cellsInReadingOrder(found);
  return order.flatMap((cell) => found.filter((entry) => entry.cell === cell));
}

/**
 * OPF 0.35: the blocks a slide's removed cell keys become (`removedCellKeys`), in reading order of their cells: each key's payload,
 * unchanged, with `region` naming its cell (after its `id`, when it has one). On a slide with a layout the blocks name no cell, so they
 * bind to the layout's regions by kind. Undefined when the slide cannot move them as they are: it has no such key, a key holds no payload
 * object, or the slide also holds root content or blocks (0.34 rejected that mix). Only the slide's own keys move; the payloads, their
 * text and their nested blocks are copied as written.
 */
export function cellKeysAsBlocks(slide: unknown): { keys: string[]; blocks: Record<string, unknown>[] } | undefined {
  const keys = removedCellKeys(slide);
  if (!keys.length || !isRecord(slide) || ROOT_CONTENT.some((field) => slide[field] !== undefined) || keys.some(({ key }) => !isRecord(slide[key]))) return undefined;
  const placed = slide.layout === undefined;
  const blocks = keys.map(({ key, cell }) => {
    const { id, region: _ignored, ...rest } = slide[key] as Record<string, unknown>;
    return { ...(id !== undefined ? { id } : {}), ...(placed ? { region: cell } : {}), ...rest };
  });
  return { keys: keys.map(({ key }) => key), blocks };
}

function cellKeyRepair(document: unknown, slideSegments: string[], key: string): { help: string; fixes: FindingFix[]; dropSuggestions: true } {
  const slide = readAt(document, slideSegments), near = nearestGridCell(key)!;
  const layout = isRecord(slide) && slide.layout !== undefined;
  const example = near.cell ? `{ "region": "${near.cell}", ... }` : '{ "region": "top:start", ... }';
  const help = `OPF 0.35 removed the slide keys that placed content in the cells of a slide's 3 x 3 grid (the promoted regions): a block of the slide's blocks names its cell with "region", as ${example}. Blocks that name the same cell stack in it, and a slide places every block in a cell or none.`
    + (layout ? " This slide also has a layout, and a cell word names no region of a layout: the fix keeps the layout and moves each cell's content into a block without region, which binds to the layout's regions by kind, so the slide draws on its layout. To keep a grid of cells instead, remove layout and name the cells on the blocks." : "")
    + (near.help ? ` ${near.help}` : "");
  const moved = near.cell ? cellKeysAsBlocks(slide) : undefined;
  if (!moved) return { help, fixes: [], dropSuggestions: true };
  const operations: JsonPatchOperation[] = [...moved.keys.map((name) => ({ op: "remove" as const, path: pointerOf([...slideSegments, name]) })), { op: "add", path: pointerOf([...slideSegments, "blocks"]), value: moved.blocks }];
  return { help, fixes: [layout ? patch("cells-to-layout-blocks", "Move the regions into blocks of the layout", operations, true, true) : patch("cells-to-blocks", "Move the regions into blocks with region", operations, true)], dropSuggestions: true };
}
